/** Ce qu'il faut pour ranger les micro-tests et les questions d'une campagne. */
export interface Ordered {
  id: string;
  position: number;
  archivedAt: Date | null;
}

/**
 * Éléments non archivés, rangés par `position`. À position égale, l'id départage : le résultat
 * ne dépend pas de l'ordre reçu. Ne modifie pas la liste reçue.
 */
export function activeInOrder<T extends Ordered>(items: readonly T[]): T[] {
  return items
    .filter((item) => item.archivedAt === null)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
