import { activeInOrder, type Ordered } from "./order";
import { addHours } from "./time";

/** Ce que la planification a besoin de savoir d'un micro-test. */
export type SchedulableMicroTest = Ordered;

export interface PlannedAssignment {
  microTestId: string;
  scheduledAt: Date;
}

/**
 * Prochain micro-test d'un testeur : le premier micro-test non archivé (ordre `position`, puis
 * `id`) qui n'a pas encore d'assignment pour lui. Un micro-test ajouté en cours de campagne, même
 * avant ceux déjà faits, est donc envoyé aussi. `null` quand il n'en reste plus.
 */
export function nextMicroTest<T extends SchedulableMicroTest>(
  microTests: readonly T[],
  assignedMicroTestIds: ReadonlySet<string>,
): T | null {
  return activeInOrder(microTests).find((mt) => !assignedMicroTestIds.has(mt.id)) ?? null;
}

/**
 * Premier micro-test à envoyer à un testeur qui vient de donner son accord : le micro-test
 * non archivé de plus petite `position`, planifié à la date de l'accord (le rythme de la campagne
 * ne s'applique qu'entre deux micro-tests). `null` si la campagne n'a aucun micro-test actif.
 */
export function firstAssignment(
  microTests: readonly SchedulableMicroTest[],
  consentAt: Date,
): PlannedAssignment | null {
  return nextAssignment(microTests, new Set(), consentAt, 0);
}

/**
 * Assignment suivant, quand un micro-test vient d'être terminé (ou passé) : le prochain
 * micro-test (`nextMicroTest`), planifié `cadenceHours` après `from`. `null` après le dernier.
 */
export function nextAssignment(
  microTests: readonly SchedulableMicroTest[],
  assignedMicroTestIds: ReadonlySet<string>,
  from: Date,
  cadenceHours: number,
): PlannedAssignment | null {
  const next = nextMicroTest(microTests, assignedMicroTestIds);
  if (!next) return null;
  return { microTestId: next.id, scheduledAt: addHours(from, cadenceHours) };
}

/** Vrai si `date` tombe avant la date limite de la campagne (ou s'il n'y en a pas). */
export function beforeDeadline(deadline: Date | null, date: Date): boolean {
  return deadline === null || date.getTime() < deadline.getTime();
}

/** Seul statut de testeur à qui l'on envoie un micro-test (accord donné, ni en pause ni parti). */
export const SENDABLE_TESTER_STATUS = "ACTIVE";
/** Seul statut de campagne pour lequel des micro-tests partent. */
export const SENDABLE_CAMPAIGN_STATUS = "ACTIVE";
/** Statut d'un assignment planifié, pas encore envoyé. */
export const PENDING_ASSIGNMENT_STATUS = "SCHEDULED";

/** Ce que la règle d'envoi a besoin de savoir d'un assignment et de ce qui l'entoure. */
export interface DueCandidate {
  status: string;
  scheduledAt: Date;
  tester: { status: string; consentAt: Date | null };
  campaign: { status: string; deadline: Date | null };
  microTest: { archivedAt: Date | null };
}

/**
 * Vrai si le micro-test de cet assignment doit partir maintenant : planifié et arrivé à échéance,
 * testeur actif qui a donné son accord, campagne lancée dont la date limite n'est pas passée,
 * micro-test non archivé. Un testeur en pause, inactif, injoignable ou désinscrit ne reçoit rien.
 */
export function isDue(candidate: DueCandidate, now: Date): boolean {
  const { tester, campaign, microTest } = candidate;
  return (
    candidate.status === PENDING_ASSIGNMENT_STATUS &&
    candidate.scheduledAt.getTime() <= now.getTime() &&
    tester.status === SENDABLE_TESTER_STATUS &&
    tester.consentAt !== null &&
    campaign.status === SENDABLE_CAMPAIGN_STATUS &&
    beforeDeadline(campaign.deadline, now) &&
    microTest.archivedAt === null
  );
}

/** Garde les assignments à envoyer maintenant (voir `isDue`), dans l'ordre reçu. */
export function selectDue<T extends DueCandidate>(candidates: readonly T[], now: Date): T[] {
  return candidates.filter((candidate) => isDue(candidate, now));
}
