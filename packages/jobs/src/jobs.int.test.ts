import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoss, ensureQueues, startBoss, type PgBoss } from "./boss";
import type { JobName } from "./definitions";
import { enqueue } from "./enqueue";
import { registerWorkers, type JobHandlers } from "./workers";

const boss: PgBoss = createBoss(process.env.DATABASE_URL ?? "");
const received: { name: JobName; payload: unknown }[] = [];
const invalidJobIds: string[] = [];
let workersStarted = false;

const record =
  (name: JobName) =>
  async (payload: unknown): Promise<void> => {
    received.push({ name, payload });
  };
const handlers: JobHandlers = {
  "send-welcome": record("send-welcome"),
  "send-microtest": record("send-microtest"),
  reminder: record("reminder"),
  reply: record("reply"),
  "fallback-email": record("fallback-email"),
  "scheduler-tick": record("scheduler-tick"),
};

/** Les workers ne démarrent qu'après les envois, pour tester le dédoublonnage sans course. */
async function startWorkers(): Promise<void> {
  if (workersStarted) return;
  workersStarted = true;
  await registerWorkers(boss, handlers, { onInvalidPayload: (_e, id) => invalidJobIds.push(id) });
}

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 15_000) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeoutMs) throw new Error("Délai dépassé");
    await new Promise((r) => setTimeout(r, 100));
  }
}

const receivedFor = (name: JobName, field: string, value: string) =>
  received.filter(
    (r) => r.name === name && (r.payload as Record<string, unknown>)[field] === value,
  );

describe("pg-boss : contrat des tâches", () => {
  beforeAll(async () => {
    await startBoss(boss);
    await boss.deleteAllJobs();
  });

  afterAll(async () => {
    await boss.stop({ graceful: false });
  });

  it("n'exécute qu'une fois deux envois avec la même singletonKey", async () => {
    const payload = { assignmentId: "a-dedup", reminderNumber: 1 } as const;
    const first = await enqueue(boss, "reminder", payload);
    const second = await enqueue(boss, "reminder", payload);
    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();

    await startWorkers();
    await waitFor(() => receivedFor("reminder", "assignmentId", "a-dedup").length > 0);
    await new Promise((r) => setTimeout(r, 1_500)); // laisse le temps à un éventuel doublon
    expect(receivedFor("reminder", "assignmentId", "a-dedup")).toHaveLength(1);
  });

  it("fait consommer par le worker une tâche envoyée", async () => {
    await startWorkers();
    const id = await enqueue(boss, "send-welcome", { testerId: "t-consume" });
    expect(id).not.toBeNull();
    await waitFor(() => receivedFor("send-welcome", "testerId", "t-consume").length === 1);
    expect(receivedFor("send-welcome", "testerId", "t-consume")[0]?.payload).toEqual({
      testerId: "t-consume",
    });
    await waitFor(async () => {
      const [job] = await boss.findJobs("send-welcome", { id: id ?? "" });
      return job?.state === "completed";
    });
  });

  it("met en échec, sans appeler le handler, une tâche au payload invalide", async () => {
    await startWorkers();
    // Envoi direct, sans `enqueue` : simule une tâche écrite à la main ou par une ancienne version.
    const id = await boss.send("send-microtest", { wrong: "field" });
    expect(id).not.toBeNull();

    await waitFor(async () => {
      const [job] = await boss.findJobs("send-microtest", { id: id ?? "" });
      return job?.state === "failed";
    });
    expect(invalidJobIds).toContain(id);
    expect(received.filter((r) => r.name === "send-microtest")).toHaveLength(0);
  });
});

describe("ensureQueues", () => {
  const admin: PgBoss = createBoss(process.env.DATABASE_URL ?? "");

  beforeAll(async () => {
    await admin.start();
  });

  afterAll(async () => {
    // Remet la file dans son état normal pour les runs suivants.
    await admin.deleteQueue("reply");
    await ensureQueues(admin);
    await admin.stop({ graceful: false });
  });

  it("met à jour les relances d'une file existante", async () => {
    await admin.updateQueue("reply", { retryLimit: 9 });
    await ensureQueues(admin);
    expect((await admin.getQueue("reply"))?.retryLimit).toBe(3);
  });

  it("refuse de démarrer si une file n'a pas la politique exclusive", async () => {
    await admin.deleteQueue("reply");
    await admin.createQueue("reply", { policy: "standard" });
    await expect(ensureQueues(admin)).rejects.toThrow('a la politique "standard"');
  });
});
