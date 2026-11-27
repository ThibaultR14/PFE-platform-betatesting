import { nextAssignment, type PlannedAssignment } from "@microbeta/core";
import type { Prisma } from "@microbeta/db";

/**
 * Planifie le micro-test suivant d'un testeur (`core.nextAssignment`), dans la transaction reçue.
 * `skipDuplicates` sur l'unicité `(testerId, microTestId)` : rejouée, la planification ne crée
 * pas de doublon. Renvoie ce qui a été planifié, `null` s'il ne reste aucun micro-test.
 */
export async function planNextAssignment(
  tx: Prisma.TransactionClient,
  {
    testerId,
    campaignId,
    from,
    cadenceHours,
  }: {
    testerId: string;
    campaignId: string;
    from: Date;
    cadenceHours: number;
  },
): Promise<PlannedAssignment | null> {
  // Requêtes l'une après l'autre : une transaction n'a qu'une connexion.
  const microTests = await tx.microTest.findMany({
    where: { campaignId },
    select: { id: true, position: true, archivedAt: true },
  });
  const assigned = await tx.assignment.findMany({
    where: { testerId },
    select: { microTestId: true },
  });
  const planned = nextAssignment(
    microTests,
    new Set(assigned.map((a) => a.microTestId)),
    from,
    cadenceHours,
  );
  if (planned) {
    await tx.assignment.createMany({
      data: [{ testerId, microTestId: planned.microTestId, scheduledAt: planned.scheduledAt }],
      skipDuplicates: true,
    });
  }
  return planned;
}
