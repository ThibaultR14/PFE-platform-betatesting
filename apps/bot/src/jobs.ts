import type { PrismaClient } from "@microbeta/db";
import type { JobHandlers, JobName, JobSender } from "@microbeta/jobs";
import type { DmSender } from "./messaging";
import { schedulerTick } from "./microtest/scheduler-tick";
import { sendMicroTest } from "./microtest/send-microtest";
import { sendWelcome } from "./welcome/send-welcome";

// Les handlers pas encore écrits loguent la tâche reçue. Chacun sera remplacé par la vraie
// logique dans son issue (reminder #26, reply #28, fallback-email #30).

const log =
  (name: JobName) =>
  async (payload: unknown, { jobId }: { jobId: string }): Promise<void> => {
    console.log(`[jobs] ${name} reçue (id ${jobId}) :`, JSON.stringify(payload));
  };

export interface JobDeps {
  prisma: PrismaClient;
  /** `null` quand Discord n'est pas configuré : les tâches qui écrivent aux testeurs échouent. */
  dm: DmSender | null;
  /** Pour placer des tâches depuis une tâche (le scheduler place les `send-microtest`). */
  jobs: JobSender;
  webUrl: string | null;
  testerLinkSecret: string | null;
}

export function createJobHandlers({
  prisma,
  dm,
  jobs,
  webUrl,
  testerLinkSecret,
}: JobDeps): JobHandlers {
  return {
    "send-welcome": async ({ testerId }, { jobId }) => {
      const outcome = await sendWelcome({ prisma, dm: requireDm(dm, "accueil"), webUrl }, testerId);
      console.log(`[jobs] send-welcome ${jobId} (testeur ${testerId}) : ${outcome}`);
    },
    "send-microtest": async ({ assignmentId }, { jobId }) => {
      const outcome = await sendMicroTest(
        { prisma, dm: requireDm(dm, "micro-test"), webUrl, testerLinkSecret },
        assignmentId,
      );
      console.log(`[jobs] send-microtest ${jobId} (assignment ${assignmentId}) : ${outcome}`);
    },
    reminder: log("reminder"),
    reply: log("reply"),
    "fallback-email": log("fallback-email"),
    "scheduler-tick": async () => {
      // Sans Discord, les envois ne peuvent pas aboutir : inutile de remplir la file.
      if (!dm) return;
      const { due, enqueued } = await schedulerTick({ prisma, jobs });
      // Silencieux quand il n'y a rien à faire : il tourne chaque minute.
      if (due > 0) {
        console.log(
          `[jobs] scheduler-tick : ${due} micro-test(s) à envoyer, ${enqueued} placé(s).`,
        );
      }
    },
  };
}

/** Échec plutôt que réussite silencieuse : la tâche reste visible et sera réessayée. */
function requireDm(dm: DmSender | null, what: string): DmSender {
  if (!dm) {
    throw new Error(`Discord n'est pas configuré (variables DISCORD_*) : ${what} non envoyé.`);
  }
  return dm;
}
