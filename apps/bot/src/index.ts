import { createPrismaClient, type PrismaClient } from "@microbeta/db";
import { createBoss, registerWorkers, scheduleTick, startBoss } from "@microbeta/jobs";
import type { Client } from "discord.js";
import { loadConfig, type DiscordConfig } from "./config";
import { createComponents } from "./discord/buttons";
import { startDiscord } from "./discord/client";
import { commands } from "./discord/commands";
import { discordDmSender } from "./discord/dm";
import { createJobHandlers } from "./jobs";
import { createShutdown, type ShutdownStep } from "./shutdown";

// Point d'entrée du bot : connecte Discord (si configuré), puis démarre pg-boss et les workers.
const config = loadConfig();
if (!config.webUrl) {
  console.warn(
    "[bot] PUBLIC_WEB_URL absente : les messages aux testeurs n'auront pas de lien vers le site (confidentialité…).",
  );
}
if (!config.testerLinkSecret) {
  console.warn(
    "[bot] TESTER_LINK_SECRET absente : les micro-tests n'auront pas de bouton « Répondre sur le web ».",
  );
}

const prisma = createPrismaClient(config.databaseUrl);

// Discord d'abord : un token refusé arrête le bot avant qu'il ne prenne des tâches.
const discord = config.discord ? await connectDiscord(config.discord, prisma) : null;

const boss = createBoss(config.databaseUrl);
boss.on("error", (error) => console.error("[pg-boss]", error));

await startBoss(boss);
const handlers = createJobHandlers({
  prisma,
  dm: discord ? discordDmSender(discord) : null,
  jobs: boss,
  webUrl: config.webUrl,
  testerLinkSecret: config.testerLinkSecret,
});
await registerWorkers(boss, handlers, {
  onInvalidPayload: (error, jobId) =>
    console.error(`[jobs] tâche ${jobId} rejetée :`, error.message),
  onHandlerError: (name, error, jobId) =>
    console.error(`[jobs] ${name} ${jobId} a échoué :`, error),
});
await scheduleTick(boss);
console.log(
  `[bot] workers pg-boss démarrés${discord ? "" : " (sans Discord : variables DISCORD_* absentes)"}.`,
);

// Discord, puis pg-boss (les tâches en cours peuvent encore utiliser la BDD), puis la BDD.
const steps: ShutdownStep[] = [];
if (discord) steps.push({ name: "Discord", run: () => discord.destroy() });
steps.push({ name: "pg-boss", run: () => boss.stop({ graceful: true, timeout: 10_000 }) });
steps.push({ name: "Prisma", run: () => prisma.$disconnect() });

const shutdown = createShutdown(steps, { timeoutMs: 15_000, exit: (code) => process.exit(code) });
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function connectDiscord(discordConfig: DiscordConfig, db: PrismaClient): Promise<Client> {
  try {
    return await startDiscord(discordConfig, commands, (client) =>
      createComponents({
        prisma: db,
        dm: discordDmSender(client),
        webUrl: config.webUrl,
        testerLinkSecret: config.testerLinkSecret,
      }),
    );
  } catch (error) {
    console.error(
      "[bot] Connexion à Discord impossible. Vérifier DISCORD_BOT_TOKEN et DISCORD_APPLICATION_ID dans .env :",
      error,
    );
    process.exit(1);
  }
}
