import { PgBoss } from "pg-boss";
import { JOB_NAMES, type JobName } from "./definitions";

export { PgBoss };

/** Crée une instance pg-boss (tables dans le schéma Postgres `pgboss`). À démarrer avec `startBoss`. */
export function createBoss(connectionString: string): PgBoss {
  if (!connectionString) {
    throw new Error("DATABASE_URL manquante : impossible de démarrer pg-boss.");
  }
  return new PgBoss(connectionString);
}

/**
 * Relances de chaque file. `retryLimit` = nombre de nouvelles tentatives après le premier essai
 * (3 → 4 essais au total).
 */
const QUEUE_OPTIONS: Record<JobName, { retryLimit: number }> = {
  "send-welcome": { retryLimit: 3 },
  "send-microtest": { retryLimit: 3 },
  reminder: { retryLimit: 3 },
  reply: { retryLimit: 3 },
  "fallback-email": { retryLimit: 3 },
  // Pas de relance : le tick suivant passe une minute plus tard.
  "scheduler-tick": { retryLimit: 0 },
};

const POLICY = "exclusive";

/**
 * Crée les files, ou met à jour les réglages de relance de celles qui existent.
 * Peut être appelé à chaque démarrage. pg-boss ne permet pas de changer la politique d'une file :
 * une file existante qui n'est pas `exclusive` fait échouer le démarrage plutôt que de perdre
 * silencieusement le dédoublonnage.
 */
export async function ensureQueues(boss: PgBoss): Promise<void> {
  for (const name of JOB_NAMES) {
    const retry = {
      retryLimit: QUEUE_OPTIONS[name].retryLimit,
      retryDelay: 30,
      retryBackoff: true,
    };
    const existing = await boss.getQueue(name);
    if (!existing) {
      await boss.createQueue(name, { policy: POLICY, ...retry });
      continue;
    }
    if (existing.policy !== POLICY) {
      throw new Error(
        `La file pg-boss "${name}" a la politique "${existing.policy}" au lieu de "${POLICY}". ` +
          `Supprimer la file (boss.deleteQueue) pour qu'elle soit recréée.`,
      );
    }
    await boss.updateQueue(name, retry);
  }
}

/** Démarre pg-boss (crée ou migre son schéma) et les files. */
export async function startBoss(boss: PgBoss): Promise<PgBoss> {
  await boss.start();
  await ensureQueues(boss);
  return boss;
}
