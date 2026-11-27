import { verifyTesterLink } from "@microbeta/core";
import { createPrismaClient, type CampaignStatus, type TesterStatus } from "@microbeta/db";
import type { JobSender } from "@microbeta/jobs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { DmUnavailableError, type DmMessage, type DmSender } from "../messaging";
import { schedulerTick } from "./scheduler-tick";
import { sendMicroTest, type SendMicroTestDeps } from "./send-microtest";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");
const SECRET = "s".repeat(32);
const WEB_URL = "https://microbeta.app";
const now = new Date("2026-11-27T12:00:00Z");
const HOUR_MS = 60 * 60 * 1000;
const ownerIds: string[] = [];

/**
 * Un testeur qui a donné son accord, et un assignment SCHEDULED pour un micro-test de deux
 * questions actives (plus une archivée), arrivé à échéance une heure avant `now`.
 */
async function fixture(
  options: {
    campaignStatus?: CampaignStatus;
    deadline?: Date | null;
    testerStatus?: TesterStatus;
    scheduledAt?: Date;
    questions?: boolean;
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
      inviteCode: `TEST-${suffix}`,
      status: options.campaignStatus ?? "ACTIVE",
      deadline: options.deadline ?? null,
    },
  });
  const microTest = await prisma.microTest.create({
    data: {
      campaignId: campaign.id,
      position: 0,
      title: "Publier un trajet",
      instructions: "Publie un trajet vers le campus.",
      estimatedMinutes: 5,
      questions: {
        create:
          options.questions === false
            ? []
            : [
                { position: 0, type: "TEXT", prompt: "Ancienne question", archivedAt: now },
                { position: 1, type: "RATING", prompt: "Est-ce facile ?" },
                { position: 2, type: "TEXT", prompt: "Qu'est-ce qui t'a bloqué ?" },
              ],
      },
    },
  });
  const tester = await prisma.tester.create({
    data: {
      campaignId: campaign.id,
      discordUserId: `3000${suffix.replace(/\D/g, "").slice(0, 14)}`,
      displayName: "Alice",
      source: "GUILD",
      status: options.testerStatus ?? "ACTIVE",
      consentAt: new Date(now.getTime() - 24 * HOUR_MS),
    },
  });
  const assignment = await prisma.assignment.create({
    data: {
      testerId: tester.id,
      microTestId: microTest.id,
      scheduledAt: options.scheduledAt ?? new Date(now.getTime() - HOUR_MS),
    },
  });
  return { campaign, microTest, tester, assignment };
}

function fakeDm(impl?: (discordUserId: string, message: DmMessage) => Promise<void>) {
  const send = vi.fn(impl ?? (async () => {}));
  const dm: DmSender = { send };
  return { dm, send };
}

/** Faux pg-boss : retient les tâches placées, et refuse une clé déjà en attente (`exclusive`). */
function fakeJobs() {
  const keys = new Set<string>();
  const sent: { name: string; data: object }[] = [];
  const jobs: JobSender = {
    async send(name, data, options) {
      const key = options.singletonKey ?? "";
      if (keys.has(key)) return null;
      keys.add(key);
      sent.push({ name, data });
      return `job-${sent.length}`;
    },
  };
  const assignmentIds = () =>
    sent
      .filter((job) => job.name === "send-microtest")
      .map((job) => (job.data as { assignmentId: string }).assignmentId);
  return { jobs, assignmentIds };
}

const deps = (dm: DmSender): SendMicroTestDeps => ({
  prisma,
  dm,
  webUrl: WEB_URL,
  testerLinkSecret: SECRET,
});

const microTestLog = (testerId: string) =>
  prisma.outboundMessage.findMany({ where: { testerId, kind: "MICROTEST" } });

afterEach(async () => {
  // Supprimer le porteur supprime ses campagnes, testeurs, assignments et journaux d'envoi.
  await prisma.user.deleteMany({ where: { id: { in: ownerIds.splice(0) } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("scheduler-tick", () => {
  // La base de test est partagée : on vérifie la présence ou l'absence de NOS assignments,
  // pas le nombre total de tâches.
  it("place une tâche pour chaque assignment à envoyer, et seulement pour eux", async () => {
    const ready = await fixture();
    const paused = await fixture({ testerStatus: "PAUSED" });
    const optedOut = await fixture({ testerStatus: "OPTED_OUT" });
    const unreachable = await fixture({ testerStatus: "UNREACHABLE" });
    const campaignPaused = await fixture({ campaignStatus: "PAUSED" });
    const pastDeadline = await fixture({ deadline: new Date(now.getTime() - HOUR_MS) });
    const future = await fixture({ scheduledAt: new Date(now.getTime() + HOUR_MS) });
    const noQuestion = await fixture({ questions: false });
    const { jobs, assignmentIds } = fakeJobs();

    await schedulerTick({ prisma, jobs }, now);

    const placed = assignmentIds();
    expect(placed).toContain(ready.assignment.id);
    for (const excluded of [
      paused,
      optedOut,
      unreachable,
      campaignPaused,
      pastDeadline,
      future,
      noQuestion,
    ]) {
      expect(placed).not.toContain(excluded.assignment.id);
    }
  });

  it("deux ticks rapprochés ne placent qu'une tâche pour le même assignment", async () => {
    const { assignment } = await fixture();
    const { jobs, assignmentIds } = fakeJobs();

    await schedulerTick({ prisma, jobs }, now);
    await schedulerTick({ prisma, jobs }, now);

    expect(assignmentIds().filter((id) => id === assignment.id)).toHaveLength(1);
  });
});

describe("send-microtest", () => {
  it("envoie l'intro et la première question active, puis passe l'assignment en SENT", async () => {
    const { tester, assignment } = await fixture();
    const { dm, send } = fakeDm();

    expect(await sendMicroTest(deps(dm), assignment.id, now)).toBe("sent");

    expect(send).toHaveBeenCalledOnce();
    const [discordUserId, message] = send.mock.calls[0] ?? [];
    expect(discordUserId).toBe(tester.discordUserId);
    expect(message?.content).toContain("Publier un trajet");
    expect(message?.content).toContain("Est-ce facile ?");
    expect(message?.content).not.toContain("Ancienne question");
    expect(message?.content).toContain("1/2");

    const after = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after).toMatchObject({ status: "SENT", sentAt: now, currentQuestionIdx: 0 });
    expect(await microTestLog(tester.id)).toMatchObject([{ status: "SENT" }]);
  });

  it("le bouton web porte un lien signé vers ce testeur et cet assignment", async () => {
    const { tester, assignment } = await fixture();
    const { dm, send } = fakeDm();
    await sendMicroTest(deps(dm), assignment.id, now);

    const url = JSON.stringify(send.mock.calls[0]?.[1].components).match(
      /https:\/\/microbeta\.app\/t\/([\w.-]+)/,
    );
    expect(url?.[1]).toBeDefined();
    expect(await verifyTesterLink(url?.[1] ?? "", SECRET, now)).toEqual({
      testerId: tester.id,
      assignmentId: assignment.id,
    });
  });

  it("rejouée, n'envoie pas un second message", async () => {
    const { tester, assignment } = await fixture();
    const { dm, send } = fakeDm();
    await sendMicroTest(deps(dm), assignment.id, now);

    expect(await sendMicroTest(deps(dm), assignment.id, now)).toBe("alreadySent");
    expect(send).toHaveBeenCalledOnce();
    expect(await microTestLog(tester.id)).toHaveLength(1);
  });

  it("le testeur s'est mis en pause entre le tick et l'envoi : rien ne part", async () => {
    const { tester, assignment } = await fixture();
    await prisma.tester.update({ where: { id: tester.id }, data: { status: "PAUSED" } });
    const { dm, send } = fakeDm();

    expect(await sendMicroTest(deps(dm), assignment.id, now)).toBe("notDue");
    expect(send).not.toHaveBeenCalled();
    const after = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.status).toBe("SCHEDULED");
  });

  it("assignment inconnu ou micro-test sans question : rien ne part", async () => {
    const { dm, send } = fakeDm();
    expect(await sendMicroTest(deps(dm), "inconnu", now)).toBe("unknownAssignment");
    const { assignment } = await fixture({ questions: false });
    expect(await sendMicroTest(deps(dm), assignment.id, now)).toBe("noQuestion");
    expect(send).not.toHaveBeenCalled();
  });

  it("sans lien configuré : envoyé quand même, sans bouton web", async () => {
    const { assignment } = await fixture();
    const { dm, send } = fakeDm();

    const outcome = await sendMicroTest(
      { prisma, dm, webUrl: WEB_URL, testerLinkSecret: null },
      assignment.id,
      now,
    );

    expect(outcome).toBe("sent");
    // Les boutons de réponse restent, seul le bouton web disparaît.
    const components = JSON.stringify(send.mock.calls[0]?.[1].components);
    expect(components).toContain(`ans:${assignment.id}:`);
    expect(components).not.toContain(WEB_URL);
  });

  it("messages privés fermés : testeur UNREACHABLE, ignoré par le tick suivant", async () => {
    const { tester, assignment } = await fixture();
    const { dm } = fakeDm(async (id) => {
      throw new DmUnavailableError(id, "50007 Cannot send messages to this user");
    });

    expect(await sendMicroTest(deps(dm), assignment.id, now)).toBe("unreachable");

    expect(await microTestLog(tester.id)).toMatchObject([
      { status: "FAILED", error: expect.stringContaining("50007") },
    ]);
    const after = await prisma.tester.findUniqueOrThrow({ where: { id: tester.id } });
    expect(after.status).toBe("UNREACHABLE");

    const { jobs, assignmentIds } = fakeJobs();
    await schedulerTick({ prisma, jobs }, now);
    expect(assignmentIds()).not.toContain(assignment.id);
  });

  it("erreur passagère : échec enregistré, l'erreur remonte et l'assignment reste à envoyer", async () => {
    const { tester, assignment } = await fixture();
    const { dm } = fakeDm(async () => {
      throw new Error("ECONNRESET");
    });

    await expect(sendMicroTest(deps(dm), assignment.id, now)).rejects.toThrow("ECONNRESET");
    expect(await microTestLog(tester.id)).toMatchObject([
      { status: "FAILED", error: "ECONNRESET" },
    ]);
    const after = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.status).toBe("SCHEDULED");
    expect((await prisma.tester.findUniqueOrThrow({ where: { id: tester.id } })).status).toBe(
      "ACTIVE",
    );

    // Le nouvel essai envoie bien le message : un échec n'est pas un envoi.
    const retry = fakeDm();
    expect(await sendMicroTest(deps(retry.dm), assignment.id, now)).toBe("sent");
  });
});
