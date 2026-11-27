/** Ce que la planification a besoin de savoir d'un micro-test. */
export interface SchedulableMicroTest {
  id: string;
  position: number;
  archivedAt: Date | null;
}

export interface PlannedAssignment {
  microTestId: string;
  scheduledAt: Date;
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
  const first = microTests
    .filter((mt) => mt.archivedAt === null)
    // À position égale, l'id départage : le résultat ne dépend pas de l'ordre reçu.
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))[0];
  if (!first) return null;
  return { microTestId: first.id, scheduledAt: new Date(consentAt.getTime()) };
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
    (campaign.deadline === null || campaign.deadline.getTime() > now.getTime()) &&
    microTest.archivedAt === null
  );
}

/** Garde les assignments à envoyer maintenant (voir `isDue`), dans l'ordre reçu. */
export function selectDue<T extends DueCandidate>(candidates: readonly T[], now: Date): T[] {
  return candidates.filter((candidate) => isDue(candidate, now));
}
