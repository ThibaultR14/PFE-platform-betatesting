import type { JobResult, PgBoss } from "pg-boss";
import {
  InvalidJobPayloadError,
  JOB_NAMES,
  parseJobPayload,
  type JobName,
  type JobPayload,
} from "./definitions";

export interface JobContext {
  jobId: string;
  /** Nombre de nouvelles tentatives déjà faites (0 au premier essai). */
  retryCount: number;
}

/**
 * Un handler par tâche. Il doit pouvoir être rejoué sans doublon :
 * relire l'état en BDD avant d'agir, et ne rien faire si c'est déjà fait.
 * Lever une erreur fait relancer la tâche (selon `retryLimit`).
 */
export type JobHandlers = {
  [N in JobName]: (payload: JobPayload<N>, context: JobContext) => Promise<void>;
};

export interface RegisterOptions {
  /** Appelé quand une tâche reçue a un payload invalide (elle part en échec sans relance). */
  onInvalidPayload?: (error: InvalidJobPayloadError, jobId: string) => void;
  /** Appelé quand un handler lève une erreur (la tâche sera relancée selon `retryLimit`). */
  onHandlerError?: (name: JobName, error: unknown, jobId: string) => void;
}

/**
 * Branche un worker par tâche. Le payload est revalidé à la réception : une tâche écrite
 * à la main ou par une ancienne version du code part en échec définitif, sans appeler le handler.
 */
export async function registerWorkers(
  boss: PgBoss,
  handlers: JobHandlers,
  options: RegisterOptions = {},
): Promise<void> {
  for (const name of JOB_NAMES) {
    await registerWorker(boss, name, handlers[name], options);
  }
}

async function registerWorker<N extends JobName>(
  boss: PgBoss,
  name: N,
  handler: JobHandlers[N],
  options: RegisterOptions,
): Promise<void> {
  await boss.work<unknown>(name, { perJobResults: true }, async (jobs) => {
    const results: JobResult[] = [];
    for (const job of jobs) {
      let payload: JobPayload<N>;
      try {
        payload = parseJobPayload(name, job.data);
      } catch (error) {
        if (!(error instanceof InvalidJobPayloadError)) throw error;
        options.onInvalidPayload?.(error, job.id);
        // `deadletter` : échec définitif, sans consommer les relances.
        results.push({ id: job.id, status: "deadletter", output: { error: error.message } });
        continue;
      }
      try {
        await handler(payload, { jobId: job.id, retryCount: job.retryCount });
        results.push({ id: job.id, status: "completed" });
      } catch (error) {
        options.onHandlerError?.(name, error, job.id);
        const message = error instanceof Error ? error.message : String(error);
        results.push({ id: job.id, status: "failed", output: { error: message } });
      }
    }
    return results;
  });
}

/** Planifie `scheduler-tick` toutes les minutes (idempotent : remplace la planification existante). */
export async function scheduleTick(boss: PgBoss): Promise<void> {
  await boss.schedule("scheduler-tick", "* * * * *", {}, { tz: "UTC" });
}
