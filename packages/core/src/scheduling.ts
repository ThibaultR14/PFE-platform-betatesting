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
