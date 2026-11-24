import type { SendOptions } from "pg-boss";
import {
  defaultSingletonKeys,
  parseJobPayload,
  type JobName,
  type JobPayload,
} from "./definitions";

/** Ce dont `enqueue` a besoin de pg-boss : permet de le tester avec un faux. */
export interface JobSender {
  send(name: string, data: object, options: SendOptions): Promise<string | null>;
}

export interface EnqueueOptions {
  /** Remplace la clé anti-doublon par défaut (voir `defaultSingletonKeys`). */
  singletonKey?: string;
  /** Date (ou délai en secondes) avant laquelle la tâche ne part pas. */
  startAfter?: Date | number;
}

/**
 * Place une tâche dans sa file, après avoir validé son payload.
 * Renvoie l'id de la tâche, ou `null` si une tâche avec la même `singletonKey`
 * est déjà en attente ou en cours (rien n'est créé).
 */
export async function enqueue<N extends JobName>(
  boss: JobSender,
  name: N,
  payload: JobPayload<N>,
  options: EnqueueOptions = {},
): Promise<string | null> {
  const data = parseJobPayload(name, payload);
  const singletonKey = options.singletonKey ?? defaultSingletonKeys[name](data);

  return boss.send(name, data, {
    singletonKey,
    ...(options.startAfter === undefined ? {} : { startAfter: options.startAfter }),
  });
}
