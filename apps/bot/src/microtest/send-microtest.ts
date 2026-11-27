import { isDue } from "@microbeta/core";
import type { PrismaClient } from "@microbeta/db";
import { DmUnavailableError, type DmSender } from "../messaging";
import { buildMicroTestMessage } from "./message";
import { testerWebLink, type WebLinkConfig } from "./web-link";

export interface SendMicroTestDeps extends WebLinkConfig {
  prisma: PrismaClient;
  dm: DmSender;
}

/**
 * Ce qu'a fait la tâche :
 * - `sent` : micro-test envoyé, assignment passé en SENT ;
 * - `unreachable` : Discord refuse le message privé, le testeur passe UNREACHABLE (sans nouvel essai) ;
 * - les autres valeurs : rien n'est envoyé, et c'est normal (tâche rejouée, testeur en pause…).
 */
export type SendMicroTestOutcome =
  "sent" | "unreachable" | "unknownAssignment" | "alreadySent" | "notDue" | "noQuestion";

/**
 * Tâche `send-microtest` : envoie l'intro du micro-test et sa première question, avec ses boutons
 * de réponse, au testeur.
 * Elle peut être rejouée sans doublon : elle relit l'assignment et n'envoie rien s'il n'est plus
 * SCHEDULED, ni si la règle d'envoi (`core.isDue`) ne s'applique plus (testeur en pause entre le
 * tick et l'envoi, campagne en pause…).
 * Une erreur passagère (réseau, Discord indisponible) est relancée, pour que pg-boss réessaie.
 */
export async function sendMicroTest(
  { prisma, dm, webUrl, testerLinkSecret }: SendMicroTestDeps,
  assignmentId: string,
  now: Date = new Date(),
): Promise<SendMicroTestOutcome> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      tester: { select: { id: true, status: true, consentAt: true, discordUserId: true } },
      microTest: {
        include: {
          campaign: { select: { status: true, deadline: true } },
          questions: {
            where: { archivedAt: null },
            orderBy: [{ position: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });

  if (!assignment) return "unknownAssignment";
  if (assignment.status !== "SCHEDULED") return "alreadySent";
  const { tester, microTest } = assignment;
  if (!isDue({ ...assignment, campaign: microTest.campaign }, now)) return "notDue";
  const [first] = microTest.questions;
  if (!first) return "noQuestion";

  const webLink = await testerWebLink({ webUrl, testerLinkSecret }, tester.id, assignmentId, now);

  const message = buildMicroTestMessage({
    assignmentId,
    title: microTest.title,
    instructions: microTest.instructions,
    estimatedMinutes: microTest.estimatedMinutes,
    questionCount: microTest.questions.length,
    question: first,
    webLink,
  });

  try {
    await dm.send(tester.discordUserId, message);
  } catch (error) {
    const failed = prisma.outboundMessage.create({
      data: { testerId: tester.id, kind: "MICROTEST", status: "FAILED", error: errorText(error) },
    });
    if (error instanceof DmUnavailableError) {
      // Sans ce changement de statut, le scheduler réessaierait chaque minute. L'email de
      // secours viendra avec #30.
      await prisma.$transaction([
        failed,
        prisma.tester.updateMany({
          where: { id: tester.id, status: "ACTIVE" },
          data: { status: "UNREACHABLE" },
        }),
      ]);
      return "unreachable";
    }
    await failed;
    throw error;
  }

  await prisma.$transaction([
    prisma.assignment.updateMany({
      where: { id: assignmentId, status: "SCHEDULED" },
      data: { status: "SENT", sentAt: now, currentQuestionIdx: 0 },
    }),
    prisma.outboundMessage.create({
      data: { testerId: tester.id, kind: "MICROTEST", status: "SENT" },
    }),
  ]);
  return "sent";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
