import type { JobHandlers, JobName } from "@microbeta/jobs";

// Handlers provisoires : ils loguent la tâche reçue. Chacun sera remplacé par la vraie
// logique dans son issue (send-welcome #23, send-microtest #24, reminder #26, reply #28,
// fallback-email #30, scheduler-tick #24).

const log =
  (name: JobName) =>
  async (payload: unknown, { jobId }: { jobId: string }): Promise<void> => {
    console.log(`[jobs] ${name} reçue (id ${jobId}) :`, JSON.stringify(payload));
  };

export const loggingHandlers: JobHandlers = {
  "send-welcome": log("send-welcome"),
  "send-microtest": log("send-microtest"),
  reminder: log("reminder"),
  reply: log("reply"),
  "fallback-email": log("fallback-email"),
  // Silencieux : il tourne chaque minute.
  "scheduler-tick": async () => {},
};
