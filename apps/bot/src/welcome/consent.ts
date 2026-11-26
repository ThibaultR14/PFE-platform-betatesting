import { firstAssignment } from "@microbeta/core";
import type { PrismaClient } from "@microbeta/db";

/**
 * Résultat d'un clic sur « J'accepte de participer » :
 * - `accepted` : l'accord vient d'être enregistré (et le premier micro-test planifié) ;
 * - `alreadyAccepted` : l'accord était déjà enregistré (double clic, ancien message…) ;
 * - `optedOut` : le testeur a quitté la campagne, on ne le réinscrit pas ;
 * - `notYou` : la personne qui clique n'est pas le testeur invité ;
 * - `unknownTester` : le testeur n'existe plus (données supprimées).
 */
export type ConsentResult =
  "accepted" | "alreadyAccepted" | "optedOut" | "notYou" | "unknownTester";

/**
 * Enregistre l'accord du testeur et planifie son premier micro-test, une seule fois.
 * Deux clics simultanés : la mise à jour conditionnelle verrouille la ligne du testeur, le second
 * clic attend la fin du premier puis ne trouve plus de testeur sans accord, et ne fait rien.
 * La contrainte unique `(testerId, microTestId)` d'`Assignment` sert de seconde barrière.
 */
export async function acceptConsent(
  prisma: PrismaClient,
  testerId: string,
  discordUserId: string,
  now: Date = new Date(),
): Promise<ConsentResult> {
  const tester = await prisma.tester.findUnique({
    where: { id: testerId },
    select: { discordUserId: true, campaignId: true },
  });
  if (!tester) return "unknownTester";
  if (tester.discordUserId !== discordUserId) return "notYou";

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.tester.updateMany({
      where: { id: testerId, status: "INVITED", consentAt: null },
      data: { status: "ACTIVE", consentAt: now },
    });
    if (count === 0) {
      const current = await tx.tester.findUnique({
        where: { id: testerId },
        select: { status: true },
      });
      if (!current) return "unknownTester";
      return current.status === "OPTED_OUT" ? "optedOut" : "alreadyAccepted";
    }

    const microTests = await tx.microTest.findMany({
      where: { campaignId: tester.campaignId, archivedAt: null },
      select: { id: true, position: true, archivedAt: true },
    });
    const planned = firstAssignment(microTests, now);
    if (planned) {
      await tx.assignment.createMany({
        data: [{ testerId, microTestId: planned.microTestId, scheduledAt: planned.scheduledAt }],
        skipDuplicates: true,
      });
    }
    return "accepted";
  });
}
