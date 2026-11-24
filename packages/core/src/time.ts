const HOUR_MS = 60 * 60 * 1000;

/** Ajoute un nombre d'heures (entier ou décimal) à une date, sans la muter. */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

/** Nombre d'heures écoulées entre deux dates (négatif si `to` est avant `from`). */
export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / HOUR_MS;
}
