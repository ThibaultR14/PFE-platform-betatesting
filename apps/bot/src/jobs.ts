import type { PrismaClient } from "@microbeta/db";
import type { JobHandlers, JobName } from "@microbeta/jobs";
import type { DmSender } from "./messaging";
import { sendWelcome } from "./welcome/send-welcome";

// Les handlers pas encore écrits loguent la tâche reçue. Chacun sera remplacé par la vraie
// logique dans son issue (send-microtest #24, reminder #26, reply #28, fallback-email #30,
// scheduler-tick #24).

const log =
  (name: JobName) =>
  async (payload: unknown, { jobId }: { jobId: string }): Promise<void> => {
    console.log(`[jobs] ${name} reçue (id ${jobId}) :`, JSON.stringify(payload));
  };

export interface JobDeps {
  prisma: PrismaClient;
  /** `null` quand Discord n'est pas configuré : les tâches qui écrivent aux testeurs échouent. */
  dm: DmSender | null;
  webUrl: string | null;
}

export function createJobHandlers({ prisma, dm, webUrl }: JobDeps): JobHandlers {
  return {
    "send-welcome": async ({ testerId }, { jobId }) => {
      if (!dm) {
        // Échec plutôt que réussite silencieuse : la tâche reste visible et sera réessayée.
        throw new Error("Discord n'est pas configuré (variables DISCORD_*) : accueil non envoyé.");
      }
      const outcome = await sendWelcome({ prisma, dm, webUrl }, testerId);
      console.log(`[jobs] send-welcome ${jobId} (testeur ${testerId}) : ${outcome}`);
    },
    "send-microtest": log("send-microtest"),
    reminder: log("reminder"),
    reply: log("reply"),
    "fallback-email": log("fallback-email"),
    // Silencieux : il tourne chaque minute.
    "scheduler-tick": async () => {},
  };
}
