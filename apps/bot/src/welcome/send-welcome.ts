import { durationSummary } from "@microbeta/core";
import type { PrismaClient } from "@microbeta/db";
import { DmUnavailableError, type DmSender } from "../messaging";
import { buildWelcomeMessage } from "./message";

export interface SendWelcomeDeps {
  prisma: PrismaClient;
  dm: DmSender;
  webUrl: string | null;
}

/**
 * Ce qu'a fait la tâche :
 * - `sent` : message envoyé ;
 * - `unreachable` : Discord refuse le message privé (enregistré en échec, sans nouvel essai) ;
 * - les autres valeurs : rien n'est envoyé, et c'est normal (tâche rejouée, testeur parti…).
 */
export type SendWelcomeOutcome =
  "sent" | "unreachable" | "unknownTester" | "notInvited" | "campaignNotActive" | "alreadySent";

/**
 * Tâche `send-welcome` : envoie au testeur le message d'accueil avec le bouton d'accord.
 * Elle peut être rejouée sans doublon : elle relit l'état en BDD et ne renvoie rien si l'accueil
 * est déjà parti ou si le testeur n'est plus en attente d'accord.
 * Une erreur passagère (réseau, Discord indisponible) est relancée, pour que pg-boss réessaie.
 */
export async function sendWelcome(
  { prisma, dm, webUrl }: SendWelcomeDeps,
  testerId: string,
): Promise<SendWelcomeOutcome> {
  const tester = await prisma.tester.findUnique({
    where: { id: testerId },
    include: {
      campaign: {
        include: {
          owner: { select: { name: true } },
          microTests: { where: { archivedAt: null } },
        },
      },
      outboundMessages: { where: { kind: "WELCOME", status: "SENT" }, take: 1 },
    },
  });

  if (!tester) return "unknownTester";
  if (tester.status !== "INVITED" || tester.consentAt !== null) return "notInvited";
  if (tester.campaign.status !== "ACTIVE") return "campaignNotActive";
  if (tester.outboundMessages.length > 0) return "alreadySent";

  const { campaign } = tester;
  const message = buildWelcomeMessage({
    testerId: tester.id,
    campaignName: campaign.name,
    ownerName: campaign.owner.name,
    welcomeMessage: campaign.welcomeMessage,
    productUrl: campaign.productUrl,
    duration: durationSummary(campaign.microTests),
    webUrl,
  });

  try {
    await dm.send(tester.discordUserId, message);
  } catch (error) {
    await prisma.outboundMessage.create({
      data: { testerId, kind: "WELCOME", status: "FAILED", error: errorText(error) },
    });
    if (error instanceof DmUnavailableError) return "unreachable";
    throw error;
  }

  await prisma.outboundMessage.create({ data: { testerId, kind: "WELCOME", status: "SENT" } });
  return "sent";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
