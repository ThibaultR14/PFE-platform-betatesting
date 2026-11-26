import { createPrismaClient, type TesterStatus } from "@microbeta/db";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { DmUnavailableError, type DmMessage, type DmSender } from "../messaging";
import { acceptConsent } from "./consent";
import { sendWelcome } from "./send-welcome";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");
const TESTER_DISCORD_ID = "300000000000000001";
const ownerIds: string[] = [];

/** Une campagne avec deux micro-tests actifs (positions 1 et 2) et un archivé (position 0). */
async function fixture(
  options: {
    campaignStatus?: "ACTIVE" | "DRAFT";
    testerStatus?: TesterStatus;
    microTests?: boolean;
  } = {},
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const owner = await prisma.user.create({ data: { discordId: `owner-${suffix}`, name: "Léa" } });
  ownerIds.push(owner.id);
  const campaign = await prisma.campaign.create({
    data: {
      ownerId: owner.id,
      name: "Appli de covoiturage",
      productDescription: "Covoiturage entre étudiants",
      productUrl: "https://covoit.example",
      inviteCode: `TEST-${suffix}`,
      status: options.campaignStatus ?? "ACTIVE",
    },
  });
  const microTests =
    options.microTests === false
      ? []
      : await Promise.all(
          [
            { position: 0, archivedAt: new Date("2026-11-01T00:00:00Z") },
            { position: 1, archivedAt: null },
            { position: 2, archivedAt: null },
          ].map((mt) =>
            prisma.microTest.create({
              data: { campaignId: campaign.id, title: `Micro-test ${mt.position}`, ...mt },
            }),
          ),
        );
  const tester = await prisma.tester.create({
    data: {
      campaignId: campaign.id,
      discordUserId: TESTER_DISCORD_ID,
      displayName: "Alice",
      source: "GUILD",
      status: options.testerStatus ?? "INVITED",
    },
  });
  return { campaign, microTests, tester };
}

function fakeDm(impl?: (discordUserId: string, message: DmMessage) => Promise<void>) {
  const send = vi.fn(impl ?? (async () => {}));
  const dm: DmSender = { send };
  return { dm, send };
}

const welcomeLog = (testerId: string) =>
  prisma.outboundMessage.findMany({ where: { testerId, kind: "WELCOME" } });

afterEach(async () => {
  // Supprimer le porteur supprime ses campagnes, testeurs, assignments et journaux d'envoi.
  await prisma.user.deleteMany({ where: { id: { in: ownerIds.splice(0) } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("send-welcome", () => {
  it("envoie l'accueil avec le bouton d'accord, et rien d'autre avant l'accord", async () => {
    const { tester } = await fixture();
    const { dm, send } = fakeDm();

    expect(await sendWelcome({ prisma, dm, webUrl: null }, tester.id)).toBe("sent");

    expect(send).toHaveBeenCalledOnce();
    const [discordUserId, message] = send.mock.calls[0] ?? [];
    expect(discordUserId).toBe(TESTER_DISCORD_ID);
    expect(message?.content).toContain("**2 micro-tests**");
    expect(JSON.stringify(message?.components)).toContain(`consent:${tester.id}`);

    expect(await welcomeLog(tester.id)).toMatchObject([{ status: "SENT" }]);
    expect(await prisma.assignment.count({ where: { testerId: tester.id } })).toBe(0);
    const after = await prisma.tester.findUniqueOrThrow({ where: { id: tester.id } });
    expect(after).toMatchObject({ status: "INVITED", consentAt: null });
  });

  it("rejouée, n'envoie pas un second message", async () => {
    const { tester } = await fixture();
    const { dm, send } = fakeDm();
    await sendWelcome({ prisma, dm, webUrl: null }, tester.id);

    expect(await sendWelcome({ prisma, dm, webUrl: null }, tester.id)).toBe("alreadySent");
    expect(send).toHaveBeenCalledOnce();
    expect(await welcomeLog(tester.id)).toHaveLength(1);
  });

  it("n'écrit pas à un testeur désinscrit ni pour une campagne non lancée", async () => {
    const { dm, send } = fakeDm();
    const optedOut = await fixture({ testerStatus: "OPTED_OUT" });
    expect(await sendWelcome({ prisma, dm, webUrl: null }, optedOut.tester.id)).toBe("notInvited");
    const draft = await fixture({ campaignStatus: "DRAFT" });
    expect(await sendWelcome({ prisma, dm, webUrl: null }, draft.tester.id)).toBe(
      "campaignNotActive",
    );
    expect(await sendWelcome({ prisma, dm, webUrl: null }, "inconnu")).toBe("unknownTester");
    expect(send).not.toHaveBeenCalled();
  });

  it("messages privés fermés : échec enregistré, sans nouvel essai", async () => {
    const { tester } = await fixture();
    const { dm } = fakeDm(async (id) => {
      throw new DmUnavailableError(id, "50007 Cannot send messages to this user");
    });

    expect(await sendWelcome({ prisma, dm, webUrl: null }, tester.id)).toBe("unreachable");
    expect(await welcomeLog(tester.id)).toMatchObject([
      { status: "FAILED", error: expect.stringContaining("50007") },
    ]);
  });

  it("erreur passagère : échec enregistré, et l'erreur remonte pour que pg-boss réessaie", async () => {
    const { tester } = await fixture();
    const { dm } = fakeDm(async () => {
      throw new Error("ECONNRESET");
    });

    await expect(sendWelcome({ prisma, dm, webUrl: null }, tester.id)).rejects.toThrow(
      "ECONNRESET",
    );
    expect(await welcomeLog(tester.id)).toMatchObject([{ status: "FAILED", error: "ECONNRESET" }]);

    // Le nouvel essai envoie bien le message : un échec n'est pas un envoi.
    const retry = fakeDm();
    expect(await sendWelcome({ prisma, dm: retry.dm, webUrl: null }, tester.id)).toBe("sent");
  });
});

describe("acceptConsent", () => {
  it("enregistre l'accord et planifie le premier micro-test actif", async () => {
    const { tester, microTests } = await fixture();
    const now = new Date("2026-11-26T10:00:00Z");

    expect(await acceptConsent(prisma, tester.id, TESTER_DISCORD_ID, now)).toBe("accepted");

    const after = await prisma.tester.findUniqueOrThrow({ where: { id: tester.id } });
    expect(after).toMatchObject({ status: "ACTIVE", consentAt: now });
    const assignments = await prisma.assignment.findMany({ where: { testerId: tester.id } });
    expect(assignments).toMatchObject([
      { microTestId: microTests[1]?.id, status: "SCHEDULED", scheduledAt: now },
    ]);
  });

  it("double clic simultané : un seul assignment", async () => {
    const { tester } = await fixture();

    const results = await Promise.all([
      acceptConsent(prisma, tester.id, TESTER_DISCORD_ID),
      acceptConsent(prisma, tester.id, TESTER_DISCORD_ID),
      acceptConsent(prisma, tester.id, TESTER_DISCORD_ID),
    ]);

    expect(results.sort()).toEqual(["accepted", "alreadyAccepted", "alreadyAccepted"]);
    expect(await prisma.assignment.count({ where: { testerId: tester.id } })).toBe(1);
  });

  it("clic tardif : l'accord déjà donné ne change pas", async () => {
    const { tester } = await fixture();
    const first = new Date("2026-11-26T10:00:00Z");
    await acceptConsent(prisma, tester.id, TESTER_DISCORD_ID, first);

    expect(
      await acceptConsent(prisma, tester.id, TESTER_DISCORD_ID, new Date("2026-11-27T10:00:00Z")),
    ).toBe("alreadyAccepted");
    const after = await prisma.tester.findUniqueOrThrow({ where: { id: tester.id } });
    expect(after.consentAt).toEqual(first);
  });

  it("ne réinscrit pas un testeur désinscrit", async () => {
    const { tester } = await fixture({ testerStatus: "OPTED_OUT" });
    expect(await acceptConsent(prisma, tester.id, TESTER_DISCORD_ID)).toBe("optedOut");
    expect(await prisma.assignment.count({ where: { testerId: tester.id } })).toBe(0);
  });

  it("refuse le clic d'un autre utilisateur Discord", async () => {
    const { tester } = await fixture();
    expect(await acceptConsent(prisma, tester.id, "399999999999999999")).toBe("notYou");
    const after = await prisma.tester.findUniqueOrThrow({ where: { id: tester.id } });
    expect(after).toMatchObject({ status: "INVITED", consentAt: null });
  });

  it("campagne sans micro-test : accord enregistré, aucun assignment", async () => {
    const { tester } = await fixture({ microTests: false });
    expect(await acceptConsent(prisma, tester.id, TESTER_DISCORD_ID)).toBe("accepted");
    expect(await prisma.assignment.count({ where: { testerId: tester.id } })).toBe(0);
  });

  it("testeur supprimé", async () => {
    expect(await acceptConsent(prisma, "inconnu", TESTER_DISCORD_ID)).toBe("unknownTester");
  });
});
