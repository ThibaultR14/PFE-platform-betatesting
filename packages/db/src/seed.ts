import type { PrismaClient } from "./generated/prisma/client";
import type { QuestionType } from "./generated/prisma/enums";

/** Volumes créés par `seed()`. Le test d'intégration s'y réfère. */
export const SEED_COUNTS = {
  user: 1,
  campaign: 1,
  microTest: 3,
  question: 10,
  questionTemplate: 8,
  tester: 5,
  assignment: 8,
  answer: 16,
  testerQuestion: 2,
  aiUsage: 3,
  outboundMessage: 5,
} as const;

interface QuestionSeed {
  type: QuestionType;
  prompt: string;
  options?: string[];
}

const MICRO_TESTS: { title: string; instructions: string; questions: QuestionSeed[] }[] = [
  {
    title: "Premier lancement",
    instructions: "Installez l'appli et créez votre compte.",
    questions: [
      { type: "RATING", prompt: "À quel point l'inscription a-t-elle été facile ?" },
      { type: "TEXT", prompt: "Qu'est-ce qui vous a bloqué, même un peu ?" },
      { type: "YESNO", prompt: "Avez-vous compris à quoi sert l'appli dès l'écran d'accueil ?" },
      {
        type: "SINGLE",
        prompt: "Sur quel appareil testez-vous ?",
        options: ["iPhone", "Android", "Ordinateur"],
      },
    ],
  },
  {
    title: "Publier un trajet",
    instructions: "Publiez un trajet fictif pour demain matin.",
    questions: [
      {
        type: "MULTI",
        prompt: "Quelles informations ont manqué dans le formulaire ?",
        options: ["Prix", "Bagages", "Points d'arrêt", "Rien"],
      },
      { type: "RATING", prompt: "Publier un trajet était-il rapide ?" },
      { type: "TEXT", prompt: "Que changeriez-vous en priorité ?" },
    ],
  },
  {
    title: "Réserver une place",
    instructions: "Cherchez un trajet vers le campus et réservez une place.",
    questions: [
      { type: "RATING", prompt: "La recherche de trajet était-elle claire ?" },
      { type: "YESNO", prompt: "Recommanderiez-vous l'appli à un ami ?" },
      { type: "TEXT", prompt: "Un dernier commentaire ?" },
    ],
  },
];

const TEMPLATES: (QuestionSeed & { category: string })[] = [
  { category: "Facilité", type: "RATING", prompt: "À quel point cette étape était-elle facile ?" },
  { category: "Facilité", type: "TEXT", prompt: "Qu'est-ce qui vous a bloqué ?" },
  { category: "Satisfaction", type: "RATING", prompt: "Dans l'ensemble, êtes-vous satisfait ?" },
  { category: "Recommandation", type: "YESNO", prompt: "Recommanderiez-vous ce produit ?" },
  {
    category: "Recommandation",
    type: "SINGLE",
    prompt: "Quelle probabilité de recommander ce produit (NPS) ?",
    options: ["0-6", "7-8", "9-10"],
  },
  {
    category: "Compréhension",
    type: "YESNO",
    prompt: "Avez-vous compris ce qu'on attendait de vous ?",
  },
  { category: "Priorités", type: "TEXT", prompt: "Que changeriez-vous en premier ?" },
  {
    category: "Contexte",
    type: "SINGLE",
    prompt: "Sur quel appareil testez-vous ?",
    options: ["iPhone", "Android", "Ordinateur", "Tablette"],
  },
];

/** Réponse déterministe et plausible pour une question donnée. */
function answerValue(q: QuestionSeed, seed: number): string | number | boolean | string[] {
  switch (q.type) {
    case "RATING":
      return 2 + (seed % 4); // 2 à 5
    case "YESNO":
      return seed % 3 !== 0;
    case "SINGLE":
      return q.options?.[seed % q.options.length] ?? "";
    case "MULTI":
      return q.options?.slice(0, 1 + (seed % 2)) ?? [];
    case "TEXT":
      return (
        ["Le bouton suivant était caché.", "RAS, très fluide.", "Trop de champs."][seed % 3] ?? ""
      );
  }
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Vide toutes les tables métier puis insère un jeu de démo cohérent.
 * Peut être relancé sans risque. Refuse de tourner en production.
 */
export async function seed(prisma: PrismaClient, now: Date = new Date()): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed refusé : NODE_ENV=production. Ce script efface toutes les données.");
  }
  const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);

  // Ordre : des tables dépendantes vers les tables parentes.
  await prisma.$transaction([
    prisma.outboundMessage.deleteMany(),
    prisma.testerQuestion.deleteMany(),
    prisma.answer.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.tester.deleteMany(),
    prisma.question.deleteMany(),
    prisma.microTest.deleteMany(),
    prisma.aiUsage.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.user.deleteMany(),
    prisma.questionTemplate.deleteMany(),
  ]);

  await prisma.questionTemplate.createMany({
    data: TEMPLATES.map(({ category, type, prompt, options }) => ({
      category,
      type,
      prompt,
      ...(options ? { options } : {}),
    })),
  });

  const owner = await prisma.user.create({
    data: { discordId: "100000000000000001", name: "Léa (porteuse démo)", plan: "PRO" },
  });

  const campaign = await prisma.campaign.create({
    data: {
      ownerId: owner.id,
      name: "Appli de covoiturage étudiant",
      productDescription:
        "Une appli mobile qui met en relation les étudiants d'un même campus pour partager leurs trajets.",
      productUrl: "https://example.com/covoit",
      welcomeMessage: "Merci de nous aider à améliorer l'appli !",
      deadline: new Date(now.getTime() + 14 * DAY),
      status: "ACTIVE",
      inviteCode: "DEMO-COVOIT",
    },
  });

  const microTests = await Promise.all(
    MICRO_TESTS.map((mt, position) =>
      prisma.microTest.create({
        data: {
          campaignId: campaign.id,
          position,
          title: mt.title,
          instructions: mt.instructions,
          questions: {
            create: mt.questions.map((q, i) => ({
              position: i,
              type: q.type,
              prompt: q.prompt,
              ...(q.options ? { options: q.options } : {}),
            })),
          },
        },
        include: { questions: { orderBy: { position: "asc" } } },
      }),
    ),
  );

  const testerDefs = [
    { name: "Alice", status: "ACTIVE", email: null },
    { name: "Bob", status: "ACTIVE", email: null },
    { name: "Chloé", status: "INACTIVE", email: null },
    { name: "David", status: "UNREACHABLE", email: "david@example.com" },
    { name: "Emma", status: "OPTED_OUT", email: null },
  ] as const;

  const testers = await Promise.all(
    testerDefs.map((t, i) =>
      prisma.tester.create({
        data: {
          campaignId: campaign.id,
          discordUserId: `20000000000000000${i}`,
          displayName: t.name,
          email: t.email,
          source: i % 2 === 0 ? "INVITE_LINK" : "GUILD",
          status: t.status,
          consentAt: daysAgo(10),
        },
      }),
    ),
  );
  const [alice, bob, chloe, david, emma] = testers;
  const [mt1, mt2, mt3] = microTests;
  if (!alice || !bob || !chloe || !david || !emma || !mt1 || !mt2 || !mt3) {
    throw new Error("Seed incohérent");
  }

  /** Crée un assignment et, s'il y a lieu, les `answered` premières réponses. */
  async function assign(
    tester: (typeof testers)[number],
    mt: (typeof microTests)[number],
    status: "SCHEDULED" | "SENT" | "IN_PROGRESS" | "COMPLETED",
    sentDaysAgo: number,
    answered = 0,
    reminderCount = 0,
  ) {
    const assignment = await prisma.assignment.create({
      data: {
        testerId: tester.id,
        microTestId: mt.id,
        status,
        scheduledAt: daysAgo(sentDaysAgo),
        sentAt: status === "SCHEDULED" ? null : daysAgo(sentDaysAgo),
        completedAt: status === "COMPLETED" ? daysAgo(sentDaysAgo - 0.5) : null,
        currentQuestionIdx: answered,
        reminderCount,
        lastReminderAt: reminderCount > 0 ? daysAgo(1) : null,
      },
    });
    const seedIdx = testers.indexOf(tester);
    for (const q of mt.questions.slice(0, answered)) {
      const qSeed: QuestionSeed = {
        type: q.type,
        prompt: q.prompt,
        ...(Array.isArray(q.options) ? { options: q.options as string[] } : {}),
      };
      await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: q.id,
          questionSnapshot: {
            type: q.type,
            prompt: q.prompt,
            options: qSeed.options ?? null,
            version: q.version,
          },
          value: answerValue(qSeed, seedIdx + q.position),
          channel: seedIdx === 1 ? "WEB" : "DISCORD",
        },
      });
    }
  }

  await assign(alice, mt1, "COMPLETED", 9, mt1.questions.length);
  await assign(alice, mt2, "COMPLETED", 6, mt2.questions.length);
  await assign(alice, mt3, "SENT", 1);
  await assign(bob, mt1, "COMPLETED", 9, mt1.questions.length);
  await assign(bob, mt2, "IN_PROGRESS", 2, 1);
  await assign(chloe, mt1, "SENT", 8, 0, 2);
  await assign(david, mt1, "SCHEDULED", 0);
  await assign(emma, mt1, "COMPLETED", 9, mt1.questions.length);

  await prisma.testerQuestion.createMany({
    data: [
      { testerId: bob.id, body: "Faut-il un vrai permis pour publier un trajet ?", status: "OPEN" },
      {
        testerId: alice.id,
        body: "L'appli sera-t-elle dispo sur Android ?",
        reply: "Oui, la version Android arrive le mois prochain.",
        repliedAt: daysAgo(3),
        status: "ANSWERED",
      },
    ],
  });

  await prisma.aiUsage.createMany({
    data: [
      {
        userId: owner.id,
        campaignId: campaign.id,
        kind: "GENERATE",
        model: "claude-sonnet-5-5",
        inputTokens: 3100,
        outputTokens: 9800,
        costUsd: "0.104200",
      },
      {
        userId: owner.id,
        campaignId: campaign.id,
        kind: "SPLIT",
        model: "claude-haiku-5-5",
        inputTokens: 8200,
        outputTokens: 4600,
        costUsd: "0.003120",
      },
      {
        userId: owner.id,
        campaignId: campaign.id,
        kind: "GENERATE",
        model: "claude-haiku-5-5",
        inputTokens: 2900,
        outputTokens: 10200,
        costUsd: "0.005390",
      },
    ],
  });

  await prisma.outboundMessage.createMany({
    data: [
      { testerId: alice.id, kind: "WELCOME", status: "SENT" },
      { testerId: alice.id, kind: "MICROTEST", status: "SENT" },
      { testerId: chloe.id, kind: "REMINDER", status: "SENT" },
      {
        testerId: david.id,
        kind: "MICROTEST",
        status: "FAILED",
        error: "DiscordAPIError[50007]: Cannot send messages to this user",
      },
      { testerId: david.id, kind: "FALLBACK_EMAIL", status: "SENT" },
    ],
  });
}
