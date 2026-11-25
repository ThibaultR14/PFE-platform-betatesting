import { createBoss, registerWorkers, scheduleTick, startBoss } from "@microbeta/jobs";
import type { Client } from "discord.js";
import { loadConfig, type DiscordConfig } from "./config";
import { startDiscord } from "./discord/client";
import { commands } from "./discord/commands";
import { loggingHandlers } from "./jobs";
import { createShutdown, type ShutdownStep } from "./shutdown";

// Point d'entrée du bot : connecte Discord (si configuré), puis démarre pg-boss et les workers.
// Les handlers ne font que loguer pour l'instant.
const config = loadConfig();

// Discord d'abord : un token refusé arrête le bot avant qu'il ne prenne des tâches.
const discord = config.discord ? await connectDiscord(config.discord) : null;

const boss = createBoss(config.databaseUrl);
boss.on("error", (error) => console.error("[pg-boss]", error));

await startBoss(boss);
await registerWorkers(boss, loggingHandlers, {
  onInvalidPayload: (error, jobId) =>
    console.error(`[jobs] tâche ${jobId} rejetée :`, error.message),
  onHandlerError: (name, error, jobId) =>
    console.error(`[jobs] ${name} ${jobId} a échoué :`, error),
});
await scheduleTick(boss);
console.log(
  `[bot] workers pg-boss démarrés${discord ? "" : " (sans Discord : variables DISCORD_* absentes)"}.`,
);

const steps: ShutdownStep[] = [];
if (discord) steps.push({ name: "Discord", run: () => discord.destroy() });
steps.push({ name: "pg-boss", run: () => boss.stop({ graceful: true, timeout: 10_000 }) });

const shutdown = createShutdown(steps, { timeoutMs: 15_000, exit: (code) => process.exit(code) });
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function connectDiscord(discordConfig: DiscordConfig): Promise<Client> {
  try {
    return await startDiscord(discordConfig, commands);
  } catch (error) {
    console.error(
      "[bot] Connexion à Discord impossible. Vérifier DISCORD_BOT_TOKEN et DISCORD_APPLICATION_ID dans .env :",
      error,
    );
    process.exit(1);
  }
}
