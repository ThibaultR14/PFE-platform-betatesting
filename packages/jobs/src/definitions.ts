import { z } from "zod";

// Contrat des tâches entre le site (qui les envoie) et le bot (qui les exécute).
// Toute nouvelle tâche s'ajoute ici : schéma du payload et clé anti-doublon.

const id = z.string().min(1);

export const jobSchemas = {
  "send-welcome": z.object({ testerId: id }).strict(),
  "send-microtest": z.object({ assignmentId: id }).strict(),
  reminder: z
    .object({ assignmentId: id, reminderNumber: z.union([z.literal(1), z.literal(2)]) })
    .strict(),
  reply: z.object({ testerQuestionId: id }).strict(),
  "fallback-email": z.object({ testerId: id }).strict(),
  "scheduler-tick": z.object({}).strict(),
} as const;

export type JobName = keyof typeof jobSchemas;
export type JobPayload<N extends JobName> = z.infer<(typeof jobSchemas)[N]>;

export const JOB_NAMES = Object.keys(jobSchemas) as JobName[];

/**
 * Clé anti-doublon par défaut : deux envois avec la même clé tant que la première tâche
 * est en attente ou en cours ne créent qu'une seule tâche (politique `exclusive`).
 * Il n'existe pas de « sans clé » : pg-boss traite l'absence de clé comme une clé vide commune
 * à toute la file, ce qui bloquerait toutes les autres tâches de la file.
 * Une tâche planifiée (`startAfter`) garde sa clé jusqu'à son exécution : pour un envoi immédiat
 * en plus (ex. « relancer maintenant », #26), passer une autre clé.
 */
export const defaultSingletonKeys: { [N in JobName]: (payload: JobPayload<N>) => string } = {
  "send-welcome": (p) => `send-welcome:${p.testerId}`,
  "send-microtest": (p) => `send-microtest:${p.assignmentId}`,
  reminder: (p) => `reminder:${p.assignmentId}:${p.reminderNumber}`,
  reply: (p) => `reply:${p.testerQuestionId}`,
  "fallback-email": (p) => `fallback-email:${p.testerId}`,
  // Au plus un tick en attente ou en cours : un tick du cron qui chevauche le précédent est ignoré.
  "scheduler-tick": () => "scheduler-tick",
};

/** Valide un payload. Lève une `InvalidJobPayloadError` qui détaille le problème. */
export function parseJobPayload<N extends JobName>(name: N, payload: unknown): JobPayload<N> {
  const result = jobSchemas[name].safeParse(payload);
  if (!result.success) {
    throw new InvalidJobPayloadError(name, z.prettifyError(result.error));
  }
  return result.data as JobPayload<N>;
}

export class InvalidJobPayloadError extends Error {
  constructor(
    readonly jobName: JobName,
    readonly details: string,
  ) {
    super(`Payload invalide pour la tâche "${jobName}" :\n${details}`);
    this.name = "InvalidJobPayloadError";
  }
}
