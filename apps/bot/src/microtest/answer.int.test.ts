import { createPrismaClient, type TesterStatus } from "@microbeta/db";
import type { JobSender } from "@microbeta/jobs";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { recordAnswer, type AnswerRequest } from "./answer";
import { schedulerTick } from "./scheduler-tick";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");
const now = new Date("2026-11-27T12:00:00Z");
const HOUR_MS = 60 * 60 * 1000;
const ownerIds: string[] = [];

/**
 * Une campagne de deux micro-tests (rythme 48 h). Le n°1 a deux questions actives (une note
 * obligatoire, un texte facultatif) et une archivée. Le testeur a reçu le n°1 (assignment SENT).
 */
async function fixture(
  options: {
    testerStatus?: TesterStatus;
    secondMicroTest?: boolean;
    deadline?: Date | null;
    assignmentStatus?: "SCHEDULED" | "SENT";
  } = {},
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const owner = await prisma.user.create({ data: { discordId: `owner-${suffix}`, name: "Léa" } });
  ownerIds.push(owner.id);
  const campaign = await prisma.campaign.create({
    data: {
      ownerId: owner.id,
      name: "Appli de covoiturage",
      productDescription: "Covoiturage entre étudiants",
      inviteCode: `TEST-${suffix}`,
      status: "ACTIVE",
      cadenceHours: 48,
      deadline: options.deadline ?? null,
    },
  });
  const first = await prisma.microTest.create({
    data: {
      campaignId: campaign.id,
      position: 0,
      title: "Publier un trajet",
      questions: {
        create: [
          { position: 0, type: "TEXT", prompt: "Ancienne question", archivedAt: now },
          { position: 1, type: "RATING", prompt: "Est-ce facile ?" },
          { position: 2, type: "TEXT", prompt: "Qu'est-ce qui t'a bloqué ?", required: false },
        ],
      },
    },
    include: { questions: { where: { archivedAt: null }, orderBy: { position: "asc" } } },
  });
  const second =
    options.secondMicroTest === false
      ? null
      : await prisma.microTest.create({
          data: {
            campaignId: campaign.id,
            position: 1,
            title: "Réserver une place",
            questions: { create: [{ position: 0, type: "YESNO", prompt: "As-tu réservé ?" }] },
          },
        });
  const tester = await prisma.tester.create({
    data: {
      campaignId: campaign.id,
      discordUserId: `3000${suffix.replace(/\D/g, "").slice(0, 14)}`,
      displayName: "Alice",
      source: "GUILD",
      status: options.testerStatus ?? "ACTIVE",
      consentAt: new Date(now.getTime() - 24 * HOUR_MS),
    },
  });
  const sent = (options.assignmentStatus ?? "SENT") === "SENT";
  const assignment = await prisma.assignment.create({
    data: {
      testerId: tester.id,
      microTestId: first.id,
      scheduledAt: new Date(now.getTime() - 2 * HOUR_MS),
      status: sent ? "SENT" : "SCHEDULED",
      sentAt: sent ? new Date(now.getTime() - HOUR_MS) : null,
    },
  });
  const [rating, text] = first.questions;
  if (!rating || !text) throw new Error("fixture : questions manquantes");

  /** Réponse du testeur à une question de son micro-test n°1. */
  const request = (
    question: { id: string; version: number },
    input: AnswerRequest["input"],
  ): AnswerRequest => ({
    assignmentId: assignment.id,
    questionId: question.id,
    version: question.version,
    discordUserId: tester.discordUserId,
    input,
  });
  return { campaign, first, second, tester, assignment, rating, text, request };
}

const answersOf = (assignmentId: string) =>
  prisma.answer.findMany({ where: { assignmentId }, orderBy: { createdAt: "asc" } });
const assignmentsOf = (testerId: string) =>
  prisma.assignment.findMany({ where: { testerId }, orderBy: { scheduledAt: "asc" } });

afterEach(async () => {
  // Supprimer le porteur supprime ses campagnes, testeurs, assignments et réponses.
  await prisma.user.deleteMany({ where: { id: { in: ownerIds.splice(0) } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("recordAnswer", () => {
  it("micro-test répondu jusqu'au bout : réponses copiées, COMPLETED, suivant planifié", async () => {
    const { assignment, tester, rating, text, second, request } = await fixture();

    const firstAnswer = await recordAnswer(
      prisma,
      request(rating, { kind: "rating", rating: 4 }),
      now,
    );
    expect(firstAnswer).toMatchObject({
      status: "recorded",
      value: 4,
      then: { kind: "question", step: { question: { id: text.id }, number: 2, count: 2 } },
    });
    expect(
      await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } }),
    ).toMatchObject({ status: "IN_PROGRESS", currentQuestionIdx: 1 });

    const last = await recordAnswer(
      prisma,
      request(text, { kind: "text", text: " Le menu " }),
      now,
    );
    const nextAt = new Date(now.getTime() + 48 * HOUR_MS);
    expect(last).toMatchObject({ status: "recorded", then: { kind: "completed", nextAt } });

    expect(await answersOf(assignment.id)).toMatchObject([
      {
        questionId: rating.id,
        value: 4,
        channel: "DISCORD",
        questionSnapshot: { type: "RATING", prompt: "Est-ce facile ?", options: null, version: 1 },
      },
      { questionId: text.id, value: "Le menu", channel: "DISCORD" },
    ]);
    expect(await assignmentsOf(tester.id)).toMatchObject([
      { id: assignment.id, status: "COMPLETED", completedAt: now, currentQuestionIdx: 2 },
      { microTestId: second?.id, status: "SCHEDULED", scheduledAt: nextAt },
    ]);
  });

  it("dernier micro-test : COMPLETED, aucun assignment créé", async () => {
    const { tester, rating, text, request } = await fixture({ secondMicroTest: false });
    await recordAnswer(prisma, request(rating, { kind: "rating", rating: 5 }), now);
    const last = await recordAnswer(prisma, request(text, { kind: "skip" }), now);

    expect(last).toMatchObject({ status: "recorded", then: { kind: "completed", nextAt: null } });
    expect(await assignmentsOf(tester.id)).toMatchObject([{ status: "COMPLETED" }]);
  });

  it("suivant après la date limite : annoncé comme le dernier", async () => {
    const deadline = new Date(now.getTime() + 24 * HOUR_MS);
    const { rating, text, request } = await fixture({ deadline });
    await recordAnswer(prisma, request(rating, { kind: "rating", rating: 5 }), now);
    const last = await recordAnswer(prisma, request(text, { kind: "skip" }), now);
    expect(last).toMatchObject({ then: { kind: "completed", nextAt: null } });
  });

  it("question facultative passée : une Answer dont la valeur est null", async () => {
    const { assignment, rating, text, request } = await fixture();
    await recordAnswer(prisma, request(rating, { kind: "rating", rating: 3 }), now);
    expect(await recordAnswer(prisma, request(text, { kind: "skip" }), now)).toMatchObject({
      status: "recorded",
      value: null,
    });
    const answers = await answersOf(assignment.id);
    expect(answers[1]).toMatchObject({ questionId: text.id, value: null });
  });

  it("passer une question obligatoire, ou une note hors limites : refusé", async () => {
    const { assignment, rating, request } = await fixture();
    expect(await recordAnswer(prisma, request(rating, { kind: "skip" }), now)).toEqual({
      status: "invalid",
      error: "required",
    });
    expect(await recordAnswer(prisma, request(rating, { kind: "rating", rating: 9 }), now)).toEqual(
      { status: "invalid", error: "outOfRange" },
    );
    expect(await answersOf(assignment.id)).toHaveLength(0);
  });

  it("même réponse envoyée deux fois : une seule Answer, la première est gardée", async () => {
    const { assignment, rating, request } = await fixture();
    await recordAnswer(prisma, request(rating, { kind: "rating", rating: 2 }), now);
    expect(await recordAnswer(prisma, request(rating, { kind: "rating", rating: 5 }), now)).toEqual(
      { status: "alreadyAnswered" },
    );
    expect(await answersOf(assignment.id)).toMatchObject([{ value: 2 }]);
  });

  it("deux clics simultanés sur la même question : une seule Answer", async () => {
    const { assignment, rating, request } = await fixture();
    const results = await Promise.all([
      recordAnswer(prisma, request(rating, { kind: "rating", rating: 2 }), now),
      recordAnswer(prisma, request(rating, { kind: "rating", rating: 2 }), now),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["alreadyAnswered", "recorded"]);
    expect(await answersOf(assignment.id)).toHaveLength(1);
  });

  it("deux réponses simultanées aux deux dernières questions : terminé une seule fois", async () => {
    const { tester, rating, text, request } = await fixture();
    const results = await Promise.all([
      recordAnswer(prisma, request(rating, { kind: "rating", rating: 4 }), now),
      recordAnswer(prisma, request(text, { kind: "text", text: "Rien" }), now),
    ]);

    expect(results.map((r) => r.status)).toEqual(["recorded", "recorded"]);
    const completed = results.filter((r) => "then" in r && r.then.kind === "completed");
    expect(completed).toHaveLength(1);
    const assignments = await assignmentsOf(tester.id);
    expect(assignments).toHaveLength(2);
    expect(assignments[0]?.status).toBe("COMPLETED");
  });

  it("question modifiée depuis l'envoi : rien n'est enregistré, la version à jour est reposée", async () => {
    const { assignment, rating, request } = await fixture();
    await prisma.question.update({
      where: { id: rating.id },
      data: { prompt: "Est-ce rapide ?", version: 2 },
    });

    const result = await recordAnswer(prisma, request(rating, { kind: "rating", rating: 4 }), now);

    expect(result).toMatchObject({
      status: "stale",
      then: { kind: "question", step: { question: { id: rating.id, version: 2 } } },
    });
    expect(await answersOf(assignment.id)).toHaveLength(0);
  });

  it("dernière question archivée pendant que le testeur y répondait : micro-test terminé", async () => {
    const { assignment, rating, text, request } = await fixture();
    await recordAnswer(prisma, request(rating, { kind: "rating", rating: 4 }), now);
    await prisma.question.update({ where: { id: text.id }, data: { archivedAt: now } });

    const result = await recordAnswer(prisma, request(text, { kind: "text", text: "Rien" }), now);

    expect(result).toMatchObject({ status: "stale", then: { kind: "completed" } });
    expect(
      await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } }),
    ).toMatchObject({ status: "COMPLETED" });
  });

  it("testeur en pause : il peut finir le micro-test en cours", async () => {
    const { rating, request } = await fixture({ testerStatus: "PAUSED" });
    expect(
      (await recordAnswer(prisma, request(rating, { kind: "rating", rating: 4 }), now)).status,
    ).toBe("recorded");
  });

  it("refuse : testeur désinscrit, autre utilisateur, micro-test pas envoyé ou inconnu", async () => {
    const optedOut = await fixture({ testerStatus: "OPTED_OUT" });
    const input = { kind: "rating", rating: 4 } as const;
    expect(await recordAnswer(prisma, optedOut.request(optedOut.rating, input), now)).toEqual({
      status: "optedOut",
    });

    const other = await fixture();
    expect(
      await recordAnswer(
        prisma,
        { ...other.request(other.rating, input), discordUserId: "999999999999999999" },
        now,
      ),
    ).toEqual({ status: "notYou" });

    const scheduled = await fixture({ assignmentStatus: "SCHEDULED" });
    expect(await recordAnswer(prisma, scheduled.request(scheduled.rating, input), now)).toEqual({
      status: "notSent",
    });

    expect(
      await recordAnswer(prisma, { ...other.request(other.rating, input), assignmentId: "x" }, now),
    ).toEqual({ status: "unknownAssignment" });
  });

  it("micro-test déjà terminé : alreadyCompleted", async () => {
    const { rating, text, request } = await fixture();
    await recordAnswer(prisma, request(rating, { kind: "rating", rating: 4 }), now);
    await recordAnswer(prisma, request(text, { kind: "skip" }), now);
    expect(await recordAnswer(prisma, request(rating, { kind: "rating", rating: 1 }), now)).toEqual(
      { status: "alreadyCompleted" },
    );
  });
});

describe("scheduler-tick : micro-test archivé après sa planification", () => {
  /** Faux pg-boss : accepte toutes les tâches. */
  const jobs: JobSender = { send: async () => "job" };

  it("passe l'assignment en SKIPPED et planifie le suivant à la même date, une seule fois", async () => {
    const { first, second, tester, assignment } = await fixture({ assignmentStatus: "SCHEDULED" });
    await prisma.microTest.update({ where: { id: first.id }, data: { archivedAt: now } });

    const result = await schedulerTick({ prisma, jobs }, now);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    await schedulerTick({ prisma, jobs }, now);

    expect(await assignmentsOf(tester.id)).toMatchObject([
      { id: assignment.id, status: "SKIPPED" },
      { microTestId: second?.id, status: "SCHEDULED", scheduledAt: assignment.scheduledAt },
    ]);
    expect(await assignmentsOf(tester.id)).toHaveLength(2);
  });

  it("laisse de côté les testeurs désinscrits", async () => {
    const { first, tester } = await fixture({
      assignmentStatus: "SCHEDULED",
      testerStatus: "OPTED_OUT",
    });
    await prisma.microTest.update({ where: { id: first.id }, data: { archivedAt: now } });

    await schedulerTick({ prisma, jobs }, now);

    expect(await assignmentsOf(tester.id)).toMatchObject([{ status: "SCHEDULED" }]);
  });
});
