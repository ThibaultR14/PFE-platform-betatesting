import { createBoss, registerWorkers, scheduleTick, startBoss } from "@microbeta/jobs";
import { loadConfig } from "./config";
import { loggingHandlers } from "./jobs";

// Point d'entrée du bot : démarre pg-boss et les workers.
// Le client discord.js est branché dans #22 ; les handlers ne font que loguer pour l'instant.
const config = loadConfig();
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
  `[bot] workers pg-boss démarrés${config.discord ? "" : " (sans Discord : variables DISCORD_* absentes)"}.`,
);

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[bot] ${signal} reçu, arrêt en cours…`);
  await boss.stop({ graceful: true, timeout: 10_000 });
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
