import {
  beforeDeadline,
  nextQuestion,
  parseAnswer,
  questionSnapshot,
  type AnswerError,
  type AnswerInput,
  type AnswerValue,
  type QuestionStep,
} from "@microbeta/core";
import { Prisma, type PrismaClient, type QuestionModel } from "@microbeta/db";
import { planNextAssignment } from "./next-assignment";

/** Une réponse reçue de Discord, pour la question affichée au testeur. */
export interface AnswerRequest {
  assignmentId: string;
  questionId: string;
  /** Version de la question affichée : si elle a changé depuis, la réponse n'est pas enregistrée. */
  version: number;
  /** L'utilisateur Discord qui a cliqué. */
  discordUserId: string;
  input: AnswerInput;
}

/**
 * La suite, après une réponse :
 * - `question` : la question à poser maintenant ;
 * - `completed` : le micro-test est terminé. `nextAt` est la date du suivant, ou `null` s'il n'y en
 *   a pas (dernier micro-test, ou suivant qui tomberait après la date limite de la campagne).
 */
export type AfterAnswer =
  | { kind: "question"; step: QuestionStep<QuestionModel> }
  | { kind: "completed"; nextAt: Date | null };

/**
 * Résultat d'une réponse :
 * - `recorded` : réponse enregistrée, avec la suite ;
 * - `stale` : la question a été modifiée ou archivée depuis l'envoi, rien n'est enregistré ; la
 *   suite est la question à poser à la place (ou la fin, s'il n'en reste aucune) ;
 * - les autres : rien n'est enregistré, et le testeur reçoit un message éphémère.
 */
export type RecordAnswerResult =
  | { status: "recorded"; testerId: string; value: AnswerValue; then: AfterAnswer }
  | { status: "stale"; testerId: string; then: AfterAnswer }
  | { status: "invalid"; error: AnswerError }
  | {
      status:
        | "alreadyAnswered"
        | "alreadyCompleted"
        | "notSent"
        | "optedOut"
        | "notYou"
        | "unknownAssignment";
    };

/** Statuts d'un assignment envoyé, qui attend des réponses. */
const ANSWERABLE = new Set(["SENT", "IN_PROGRESS"]);

/**
 * Enregistre la réponse à une question d'un micro-test, puis passe à la question suivante, ou
 * termine le micro-test et planifie le suivant (`completedAt + cadenceHours`).
 *
 * Tout se passe dans une transaction qui commence par verrouiller l'assignment (`FOR UPDATE`) :
 * deux réponses simultanées (double clic, ou Discord et la page web en même temps) passent l'une
 * après l'autre, et la seconde voit la première. Sans ce verrou, chacune pourrait croire qu'il
 * reste une question, et le micro-test ne serait jamais terminé.
 * Un testeur en pause peut finir le micro-test en cours : la pause bloque seulement les envois.
 */
export async function recordAnswer(
  prisma: PrismaClient,
  request: AnswerRequest,
  now: Date = new Date(),
): Promise<RecordAnswerResult> {
  const { assignmentId, questionId } = request;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Assignment" WHERE id = ${assignmentId} FOR UPDATE`;

    // Une relation au plus par requête, et les requêtes l'une après l'autre : avec plusieurs
    // `include`, Prisma lance ses sous-requêtes en parallèle sur l'unique connexion de la
    // transaction, ce que `pg` déconseille (et refusera dans pg@9).
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        status: true,
        microTestId: true,
        tester: { select: { id: true, discordUserId: true, status: true } },
      },
    });
    if (!assignment) return { status: "unknownAssignment" };
    const { tester } = assignment;
    if (tester.discordUserId !== request.discordUserId) return { status: "notYou" };
    if (tester.status === "OPTED_OUT") return { status: "optedOut" };
    if (assignment.status === "SCHEDULED") return { status: "notSent" };
    if (!ANSWERABLE.has(assignment.status)) return { status: "alreadyCompleted" };

    const answers = await tx.answer.findMany({
      where: { assignmentId },
      select: { questionId: true },
    });
    const answered = new Set(answers.map((a) => a.questionId));
    if (answered.has(questionId)) return { status: "alreadyAnswered" };

    const microTest = await tx.microTest.findUniqueOrThrow({
      where: { id: assignment.microTestId },
      select: { campaignId: true, campaign: { select: { cadenceHours: true, deadline: true } } },
    });
    const questions = await tx.question.findMany({
      where: { microTestId: assignment.microTestId, archivedAt: null },
    });

    /** Passe à la question suivante, ou termine le micro-test et planifie le suivant. */
    const advance = async (): Promise<AfterAnswer> => {
      const step = nextQuestion(questions, answered);
      if (step) {
        await tx.assignment.update({
          where: { id: assignmentId },
          data: { status: "IN_PROGRESS", currentQuestionIdx: step.index },
        });
        return { kind: "question", step };
      }
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: "COMPLETED",
          completedAt: now,
          currentQuestionIdx: questions.length,
        },
      });
      const planned = await planNextAssignment(tx, {
        testerId: tester.id,
        campaignId: microTest.campaignId,
        from: now,
        cadenceHours: microTest.campaign.cadenceHours,
      });
      const nextAt =
        planned && beforeDeadline(microTest.campaign.deadline, planned.scheduledAt)
          ? planned.scheduledAt
          : null;
      return { kind: "completed", nextAt };
    };

    const question = questions.find((q) => q.id === questionId);
    if (!question || question.version !== request.version) {
      // S'il ne reste aucune question (la dernière vient d'être archivée), le micro-test se
      // termine ici : sinon il resterait ouvert pour toujours.
      return { status: "stale", testerId: tester.id, then: await advance() };
    }

    const parsed = parseAnswer(question, request.input);
    if (!parsed.ok) return { status: "invalid", error: parsed.error };

    // `skipDuplicates` : une réponse arrivée entre-temps par un autre chemin n'est pas remplacée.
    const { count } = await tx.answer.createMany({
      data: [
        {
          assignmentId,
          questionId,
          questionSnapshot: questionSnapshot(question),
          value: parsed.value === null ? Prisma.JsonNull : parsed.value,
          channel: "DISCORD",
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) return { status: "alreadyAnswered" };
    answered.add(questionId);
    return { status: "recorded", testerId: tester.id, value: parsed.value, then: await advance() };
  });
}
