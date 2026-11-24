import { describe, expect, it, vi } from "vitest";
import { InvalidJobPayloadError, parseJobPayload } from "./definitions";
import { enqueue, type JobSender } from "./enqueue";

function fakeBoss() {
  const send = vi.fn<JobSender["send"]>(async () => "job-id");
  const boss: JobSender = { send };
  return { boss, send };
}

describe("parseJobPayload", () => {
  it("accepte un payload valide", () => {
    expect(parseJobPayload("reminder", { assignmentId: "a1", reminderNumber: 2 })).toEqual({
      assignmentId: "a1",
      reminderNumber: 2,
    });
  });

  it.each([
    ["champ manquant", "send-microtest", {}],
    ["id vide", "send-welcome", { testerId: "" }],
    ["relance n°3", "reminder", { assignmentId: "a1", reminderNumber: 3 }],
    ["champ en trop", "reply", { testerQuestionId: "q1", extra: true }],
    ["pas un objet", "fallback-email", "t1"],
  ] as const)("rejette un payload invalide (%s)", (_label, name, payload) => {
    expect(() => parseJobPayload(name, payload)).toThrow(InvalidJobPayloadError);
  });
});

describe("enqueue", () => {
  it("envoie le payload avec la clé anti-doublon par défaut", async () => {
    const { boss, send } = fakeBoss();
    await expect(
      enqueue(boss, "reminder", { assignmentId: "a1", reminderNumber: 1 }),
    ).resolves.toBe("job-id");
    expect(send).toHaveBeenCalledWith(
      "reminder",
      { assignmentId: "a1", reminderNumber: 1 },
      { singletonKey: "reminder:a1:1" },
    );
  });

  it("permet de remplacer ou supprimer la clé, et de différer l'envoi", async () => {
    const { boss, send } = fakeBoss();
    const later = new Date("2026-12-01T09:00:00Z");
    await enqueue(
      boss,
      "reply",
      { testerQuestionId: "q1" },
      { singletonKey: "k", startAfter: later },
    );
    expect(send).toHaveBeenCalledWith(
      "reply",
      { testerQuestionId: "q1" },
      { singletonKey: "k", startAfter: later },
    );
  });

  it("donne une clé à chaque tâche, y compris le tick", async () => {
    const { boss, send } = fakeBoss();
    await enqueue(boss, "scheduler-tick", {});
    expect(send).toHaveBeenCalledWith("scheduler-tick", {}, { singletonKey: "scheduler-tick" });
  });

  it("rejette un payload invalide sans rien envoyer", async () => {
    const { boss, send } = fakeBoss();
    const invalid = { assignmentId: "a1", reminderNumber: 3 } as unknown as {
      assignmentId: string;
      reminderNumber: 1;
    };
    await expect(enqueue(boss, "reminder", invalid)).rejects.toThrow(InvalidJobPayloadError);
    expect(send).not.toHaveBeenCalled();
  });
});
