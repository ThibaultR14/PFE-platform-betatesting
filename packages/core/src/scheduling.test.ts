import { describe, expect, it } from "vitest";
import {
  firstAssignment,
  isDue,
  selectDue,
  type DueCandidate,
  type SchedulableMicroTest,
} from "./scheduling";

const consentAt = new Date("2026-11-26T10:00:00Z");
const mt = (
  id: string,
  position: number,
  archivedAt: Date | null = null,
): SchedulableMicroTest => ({
  id,
  position,
  archivedAt,
});

describe("firstAssignment", () => {
  it("planifie le micro-test de plus petite position, à la date de l'accord", () => {
    const planned = firstAssignment([mt("b", 2), mt("a", 0), mt("c", 1)], consentAt);
    expect(planned).toEqual({ microTestId: "a", scheduledAt: consentAt });
  });

  it("ignore les micro-tests archivés", () => {
    const planned = firstAssignment(
      [mt("a", 0, new Date("2026-11-25T00:00:00Z")), mt("b", 1)],
      consentAt,
    );
    expect(planned?.microTestId).toBe("b");
  });

  it("renvoie null sans micro-test actif", () => {
    expect(firstAssignment([], consentAt)).toBeNull();
    expect(firstAssignment([mt("a", 0, consentAt)], consentAt)).toBeNull();
  });

  it("départage deux positions égales par l'id, quel que soit l'ordre reçu", () => {
    expect(firstAssignment([mt("z", 0), mt("y", 0)], consentAt)?.microTestId).toBe("y");
    expect(firstAssignment([mt("y", 0), mt("z", 0)], consentAt)?.microTestId).toBe("y");
  });

  it("ne partage pas l'objet Date reçu", () => {
    const planned = firstAssignment([mt("a", 0)], consentAt);
    expect(planned?.scheduledAt).not.toBe(consentAt);
  });
});

describe("isDue / selectDue", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  const due: DueCandidate = {
    status: "SCHEDULED",
    scheduledAt: new Date("2026-11-27T11:00:00Z"),
    tester: { status: "ACTIVE", consentAt: new Date("2026-11-26T10:00:00Z") },
    campaign: { status: "ACTIVE", deadline: null },
    microTest: { archivedAt: null },
  };
  const variant = (patch: {
    status?: string;
    scheduledAt?: Date;
    tester?: Partial<DueCandidate["tester"]>;
    campaign?: Partial<DueCandidate["campaign"]>;
    microTest?: Partial<DueCandidate["microTest"]>;
  }): DueCandidate => ({
    ...due,
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.scheduledAt === undefined ? {} : { scheduledAt: patch.scheduledAt }),
    tester: { ...due.tester, ...patch.tester },
    campaign: { ...due.campaign, ...patch.campaign },
    microTest: { ...due.microTest, ...patch.microTest },
  });

  it("envoie un assignment planifié arrivé à échéance", () => {
    expect(isDue(due, now)).toBe(true);
  });

  it("envoie à l'heure exacte, pas avant", () => {
    expect(isDue(variant({ scheduledAt: now }), now)).toBe(true);
    expect(isDue(variant({ scheduledAt: new Date(now.getTime() + 1) }), now)).toBe(false);
  });

  it.each(["SENT", "IN_PROGRESS", "COMPLETED", "SKIPPED"])(
    "n'envoie pas un assignment %s",
    (status) => {
      expect(isDue(variant({ status }), now)).toBe(false);
    },
  );

  it.each(["INVITED", "PAUSED", "INACTIVE", "UNREACHABLE", "OPTED_OUT"])(
    "n'envoie rien à un testeur %s",
    (status) => {
      expect(isDue(variant({ tester: { status } }), now)).toBe(false);
    },
  );

  it("n'envoie rien à un testeur sans accord", () => {
    expect(isDue(variant({ tester: { consentAt: null } }), now)).toBe(false);
  });

  it.each(["DRAFT", "PAUSED", "DONE"])("n'envoie rien pour une campagne %s", (status) => {
    expect(isDue(variant({ campaign: { status } }), now)).toBe(false);
  });

  it("n'envoie rien une fois la date limite passée", () => {
    expect(isDue(variant({ campaign: { deadline: now } }), now)).toBe(false);
    expect(isDue(variant({ campaign: { deadline: new Date(now.getTime() + 1) } }), now)).toBe(true);
  });

  it("n'envoie pas un micro-test archivé", () => {
    expect(isDue(variant({ microTest: { archivedAt: now } }), now)).toBe(false);
  });

  it("selectDue garde les assignments à envoyer, dans l'ordre et avec leur type", () => {
    const list = [
      { ...due, id: "a" },
      { ...variant({ tester: { status: "PAUSED" } }), id: "b" },
      { ...variant({ campaign: { status: "PAUSED" } }), id: "c" },
      { ...variant({ tester: { status: "OPTED_OUT" } }), id: "d" },
      { ...variant({ tester: { status: "UNREACHABLE" } }), id: "e" },
      { ...due, id: "f" },
    ];
    expect(selectDue(list, now).map((c) => c.id)).toEqual(["a", "f"]);
  });
});
