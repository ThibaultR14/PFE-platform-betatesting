import {
  PENDING_ASSIGNMENT_STATUS,
  SENDABLE_CAMPAIGN_STATUS,
  SENDABLE_TESTER_STATUS,
  selectDue,
} from "@microbeta/core";
import type { PrismaClient } from "@microbeta/db";
import { enqueue, type JobSender } from "@microbeta/jobs";
import { planNextAssignment } from "./next-assignment";

/** Assignments traités au plus par tick (un tick par minute) : les plus anciens d'abord. */
export const TICK_BATCH_SIZE = 100;

export interface SchedulerTickDeps {
  prisma: PrismaClient;
  /** Le `boss` pg-boss, ou un faux dans les tests. */
  jobs: JobSender;
}

export interface SchedulerTickResult {
  /** Assignments passés (SKIPPED) parce que leur micro-test a été archivé après leur planification. */
  skipped: number;
  /** Assignments à envoyer trouvés. */
  due: number;
  /** Tâches `send-microtest` créées (une tâche déjà en attente pour le même assignment n'est pas recréée). */
  enqueued: number;
}

/**
 * Tâche `scheduler-tick` :
 * 1. passe les assignments dont le micro-test a été archivé après leur planification
 *    (`skipArchived`), sinon le testeur ne recevrait plus jamais rien ;
 * 2. place une tâche `send-microtest` pour chaque assignment à envoyer.
 * La requête reprend les conditions de `core.isDue` : sans ce filtre, des assignments en attente
 * pour des testeurs en pause rempliraient chaque lot et bloqueraient les autres. `selectDue`
 * reste la règle de référence, appliquée au résultat, et `send-microtest` la revérifie à l'envoi.
 */
export async function schedulerTick(
  { prisma, jobs }: SchedulerTickDeps,
  now: Date = new Date(),
): Promise<SchedulerTickResult> {
  // D'abord : le micro-test planifié à la place peut être à envoyer dès ce tick.
  const skipped = await skipArchived(prisma);

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
  return { skipped, due: due.length, enqueued };
}

/**
 * Passe en SKIPPED les assignments SCHEDULED dont le micro-test a été archivé, et planifie à leur
 * place le micro-test suivant, **à la même date** : le délai entre deux micro-tests a déjà été
 * respecté. Les testeurs désinscrits sont laissés de côté. La mise à jour conditionnelle
 * (`status = SCHEDULED`) évite un doublon si deux ticks se chevauchent. Renvoie le nombre passé.
 */
export async function skipArchived(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.assignment.findMany({
    where: {
      status: PENDING_ASSIGNMENT_STATUS,
      microTest: { archivedAt: { not: null } },
      tester: { status: { not: "OPTED_OUT" } },
    },
    select: {
      id: true,
      testerId: true,
      scheduledAt: true,
      microTest: { select: { campaignId: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    take: TICK_BATCH_SIZE,
  });

  let skipped = 0;
  for (const row of rows) {
    const done = await prisma.$transaction(async (tx) => {
      const { count } = await tx.assignment.updateMany({
        where: { id: row.id, status: PENDING_ASSIGNMENT_STATUS },
        data: { status: "SKIPPED" },
      });
      if (count === 0) return false;
      await planNextAssignment(tx, {
        testerId: row.testerId,
        campaignId: row.microTest.campaignId,
        from: row.scheduledAt,
        cadenceHours: 0,
      });
      return true;
    });
    if (done) skipped += 1;
  }
  return skipped;
}
