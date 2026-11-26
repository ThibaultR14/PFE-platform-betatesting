// Test manuel de l'accueil (#23) : crée un testeur INVITED dans la campagne de démo, avec TON
// compte Discord, puis lance la tâche send-welcome. Le bot lancé avec `pnpm dev` envoie le message.
// Usage : pnpm --filter @microbeta/bot welcome:test <ton Discord ID> [--reset]
//   --reset : remet le testeur en attente d'accord (supprime ses assignments et son journal d'envois).
// Prérequis : `pnpm db:seed` (campagne DEMO-COVOIT) et un serveur en commun avec le bot.
import { createPrismaClient } from "@microbeta/db";
import { createBoss, enqueue, startBoss } from "@microbeta/jobs";

const DEMO_INVITE_CODE = "DEMO-COVOIT";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const discordUserId = args.find((arg) => !arg.startsWith("--")) ?? "";
if (!/^\d{17,20}$/.test(discordUserId)) {
  console.error(
    "Usage : pnpm --filter @microbeta/bot welcome:test <ton Discord ID> [--reset]\n" +
      "Ton Discord ID : Paramètres > Avancés > Mode développeur, puis clic droit sur ton profil > Copier l'identifiant.",
  );
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL ?? "";
const prisma = createPrismaClient(databaseUrl);
const boss = createBoss(databaseUrl);
try {
  const campaign = await prisma.campaign.findUnique({ where: { inviteCode: DEMO_INVITE_CODE } });
  if (!campaign) throw new Error(`Campagne ${DEMO_INVITE_CODE} introuvable : lancer pnpm db:seed.`);

  const tester = await prisma.tester.upsert({
    where: { campaignId_discordUserId: { campaignId: campaign.id, discordUserId } },
    create: {
      campaignId: campaign.id,
      discordUserId,
      displayName: "Testeur manuel",
      source: "GUILD",
    },
    update: {},
  });
  if (reset) {
    await prisma.$transaction([
      prisma.assignment.deleteMany({ where: { testerId: tester.id } }),
      prisma.outboundMessage.deleteMany({ where: { testerId: tester.id } }),
      prisma.tester.update({
        where: { id: tester.id },
        data: { status: "INVITED", consentAt: null },
      }),
    ]);
  }

  await startBoss(boss);
  const jobId = await enqueue(boss, "send-welcome", { testerId: tester.id });
  console.log(
    jobId
      ? `send-welcome envoyée (testeur ${tester.id}${reset ? ", remis à zéro" : ""}).`
      : `send-welcome déjà en attente pour le testeur ${tester.id}.`,
  );
} finally {
  await boss.stop({ graceful: false }).catch(() => {});
  await prisma.$disconnect();
}
