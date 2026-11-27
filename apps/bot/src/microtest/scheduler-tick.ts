import {
  PENDING_ASSIGNMENT_STATUS,
  SENDABLE_CAMPAIGN_STATUS,
  SENDABLE_TESTER_STATUS,
  selectDue,
} from "@microbeta/core";
import type { PrismaClient } from "@microbeta/db";
import { enqueue, type JobSender } from "@microbeta/jobs";

/** Assignments traités au plus par tick (un tick par minute) : les plus anciens d'abord. */
export const TICK_BATCH_SIZE = 100;

export interface SchedulerTickDeps {
  prisma: PrismaClient;
  /** Le `boss` pg-boss, ou un faux dans les tests. */
  jobs: JobSender;
}

export interface SchedulerTickResult {
  /** Assignments à envoyer trouvés. */
  due: number;
  /** Tâches `send-microtest` créées (une tâche déjà en attente pour le même assignment n'est pas recréée). */
  enqueued: number;
}

/**
 * Tâche `scheduler-tick` : place une tâche `send-microtest` pour chaque assignment à envoyer.
 * La requête reprend les conditions de `core.isDue` : sans ce filtre, des assignments en attente
 * pour des testeurs en pause rempliraient chaque lot et bloqueraient les autres. `selectDue`
 * reste la règle de référence, appliquée au résultat, et `send-microtest` la revérifie à l'envoi.
 */
export async function schedulerTick(
  { prisma, jobs }: SchedulerTickDeps,
  now: Date = new Date(),
): Promise<SchedulerTickResult> {
  const rows = await prisma.assignment.findMany({
    where: {
      status: PENDING_ASSIGNMENT_STATUS,
      scheduledAt: { lte: now },
      tester: { status: SENDABLE_TESTER_STATUS, consentAt: { not: null } },
      microTest: {
        archivedAt: null,
        // Sans question active, il n'y a rien à envoyer : inutile de créer une tâche chaque minute.
        questions: { some: { archivedAt: null } },
        campaign: {
          status: SENDABLE_CAMPAIGN_STATUS,
          OR: [{ deadline: null }, { deadline: { gt: now } }],
        },
      },
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      tester: { select: { status: true, consentAt: true } },
      microTest: {
        select: { archivedAt: true, campaign: { select: { status: true, deadline: true } } },
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    take: TICK_BATCH_SIZE,
  });

  const due = selectDue(
    rows.map((row) => ({ ...row, campaign: row.microTest.campaign })),
    now,
  );

  let enqueued = 0;
  for (const assignment of due) {
    const jobId = await enqueue(jobs, "send-microtest", { assignmentId: assignment.id });
    if (jobId) enqueued += 1;
  }
  return { due: due.length, enqueued };
}
