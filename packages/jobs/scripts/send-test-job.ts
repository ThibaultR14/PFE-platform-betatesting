// Envoie une tâche de test (`send-welcome`) : le bot lancé avec `pnpm dev` doit la loguer.
// Usage : pnpm jobs:send-test [testerId]
import path from "node:path";
import { config } from "dotenv";
import { createBoss, enqueue, startBoss } from "../src/index";

config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const testerId = process.argv[2] ?? `test-${Date.now()}`;
const boss = await startBoss(createBoss(process.env.DATABASE_URL ?? ""));
try {
  const id = await enqueue(boss, "send-welcome", { testerId });
  console.log(
    id
      ? `Tâche send-welcome envoyée (id ${id}, testerId ${testerId}).`
      : `Tâche ignorée : une tâche send-welcome pour ${testerId} est déjà en attente.`,
  );
} finally {
  await boss.stop({ graceful: false });
}
