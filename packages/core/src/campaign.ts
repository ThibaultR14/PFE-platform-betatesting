/** Ce que le résumé de durée a besoin de savoir d'un micro-test. */
export interface TimedMicroTest {
  estimatedMinutes: number;
  archivedAt: Date | null;
}

export interface DurationSummary {
  /** Nombre de micro-tests non archivés. */
  count: number;
  /** Durée moyenne d'un micro-test, arrondie à la minute (0 sans micro-test). */
  minutesPerTest: number;
  /** Durée totale de la campagne pour un testeur. */
  totalMinutes: number;
}

/** Ce que la campagne demande à un testeur, pour le lui annoncer dans le message d'accueil. */
export function durationSummary(microTests: readonly TimedMicroTest[]): DurationSummary {
  const active = microTests.filter((mt) => mt.archivedAt === null);
  const totalMinutes = active.reduce((sum, mt) => sum + mt.estimatedMinutes, 0);
  return {
    count: active.length,
    minutesPerTest: active.length === 0 ? 0 : Math.round(totalMinutes / active.length),
    totalMinutes,
  };
}
