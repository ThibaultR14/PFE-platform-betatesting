import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "./client";
import { SEED_COUNTS, seed } from "./seed";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");

async function countAll() {
  return {
    user: await prisma.user.count(),
    campaign: await prisma.campaign.count(),
    microTest: await prisma.microTest.count(),
    question: await prisma.question.count(),
    questionTemplate: await prisma.questionTemplate.count(),
    tester: await prisma.tester.count(),
    assignment: await prisma.assignment.count(),
    answer: await prisma.answer.count(),
    testerQuestion: await prisma.testerQuestion.count(),
    aiUsage: await prisma.aiUsage.count(),
    outboundMessage: await prisma.outboundMessage.count(),
  };
}

describe("seed", () => {
  beforeAll(async () => {
    await seed(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("crée les volumes attendus", async () => {
    expect(await countAll()).toEqual(SEED_COUNTS);
  });

  it("peut être relancé sans dupliquer les données", async () => {
    await seed(prisma);
    expect(await countAll()).toEqual(SEED_COUNTS);
  });

  it("couvre les 5 types de question", async () => {
    const types = await prisma.question.findMany({ distinct: ["type"], select: { type: true } });
    expect(types.map((t) => t.type).sort()).toEqual(["MULTI", "RATING", "SINGLE", "TEXT", "YESNO"]);
  });

  it("met des testeurs dans des statuts variés", async () => {
    const statuses = await prisma.tester.findMany({ select: { status: true } });
    expect(new Set(statuses.map((s) => s.status))).toEqual(
      new Set(["ACTIVE", "INACTIVE", "UNREACHABLE", "OPTED_OUT"]),
    );
  });

  it("garde une copie de la question dans chaque réponse", async () => {
    const answers = await prisma.answer.findMany({ include: { question: true } });
    for (const answer of answers) {
      expect(answer.questionSnapshot).toMatchObject({
        type: answer.question.type,
        prompt: answer.question.prompt,
        version: answer.question.version,
      });
    }
  });

  it("supprime toutes les données d'un testeur avec lui (RGPD)", async () => {
    const alice = await prisma.tester.findFirstOrThrow({ where: { displayName: "Alice" } });
    const aliceAssignmentIds = (
      await prisma.assignment.findMany({ where: { testerId: alice.id }, select: { id: true } })
    ).map((a) => a.id);
    const aliceAnswers = await prisma.answer.count({
      where: { assignmentId: { in: aliceAssignmentIds } },
    });
    expect(aliceAnswers).toBeGreaterThan(0);
    const totalBefore = await prisma.answer.count();

    await prisma.tester.delete({ where: { id: alice.id } });

    // Compte global : prouve que les réponses ont bien disparu de la table.
    expect(await prisma.answer.count()).toBe(totalBefore - aliceAnswers);
    expect(await prisma.answer.count({ where: { assignmentId: { in: aliceAssignmentIds } } })).toBe(
      0,
    );
    expect(await prisma.assignment.count({ where: { testerId: alice.id } })).toBe(0);
    expect(await prisma.testerQuestion.count({ where: { testerId: alice.id } })).toBe(0);
    expect(await prisma.outboundMessage.count({ where: { testerId: alice.id } })).toBe(0);

    await seed(prisma); // remet la base dans l'état attendu
  });

  it("refuse de supprimer une question déjà répondue (on l'archive)", async () => {
    const answered = await prisma.question.findFirstOrThrow({ where: { answers: { some: {} } } });
    await expect(prisma.question.delete({ where: { id: answered.id } })).rejects.toThrow();
    expect(await prisma.answer.count()).toBe(SEED_COUNTS.answer);
  });

  it("refuse de supprimer un micro-test déjà envoyé (on l'archive)", async () => {
    const sent = await prisma.microTest.findFirstOrThrow({ where: { assignments: { some: {} } } });
    await expect(prisma.microTest.delete({ where: { id: sent.id } })).rejects.toThrow();
    expect(await prisma.assignment.count()).toBe(SEED_COUNTS.assignment);
  });

  it("supprime une campagne et tout ce qui en dépend, mais garde les coûts IA", async () => {
    const campaign = await prisma.campaign.findFirstOrThrow();
    await prisma.campaign.delete({ where: { id: campaign.id } });

    expect(await prisma.microTest.count()).toBe(0);
    expect(await prisma.question.count()).toBe(0);
    expect(await prisma.tester.count()).toBe(0);
    expect(await prisma.assignment.count()).toBe(0);
    expect(await prisma.answer.count()).toBe(0);
    const aiUsages = await prisma.aiUsage.findMany();
    expect(aiUsages).toHaveLength(SEED_COUNTS.aiUsage);
    expect(aiUsages.every((u) => u.campaignId === null)).toBe(true);

    await seed(prisma);
  });

  it("refuse de tourner en production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await expect(seed(prisma)).rejects.toThrow("NODE_ENV=production");
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
