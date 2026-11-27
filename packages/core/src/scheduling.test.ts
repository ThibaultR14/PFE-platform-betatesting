import { describe, expect, it } from "vitest";
import {
  beforeDeadline,
  firstAssignment,
  isDue,
  nextAssignment,
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

describe("nextAssignment", () => {
  const completedAt = new Date("2026-11-27T12:00:00Z");
  const microTests = [mt("c", 2), mt("a", 0), mt("b", 1)];

  it("planifie le micro-test suivant, `cadenceHours` après la fin du précédent", () => {
    expect(nextAssignment(microTests, new Set(["a"]), completedAt, 48)).toEqual({
      microTestId: "b",
      scheduledAt: new Date("2026-11-29T12:00:00Z"),
    });
  });

  it("dernier micro-test terminé : aucun assignment", () => {
    expect(nextAssignment(microTests, new Set(["a", "b", "c"]), completedAt, 48)).toBeNull();
  });

  it("saute les micro-tests archivés", () => {
    const withArchived = [mt("a", 0), mt("b", 1, completedAt), mt("c", 2)];
    expect(nextAssignment(withArchived, new Set(["a"]), completedAt, 48)?.microTestId).toBe("c");
    const onlyArchivedLeft = [mt("a", 0), mt("b", 1, completedAt)];
    expect(nextAssignment(onlyArchivedLeft, new Set(["a"]), completedAt, 48)).toBeNull();
  });

  it("envoie aussi un micro-test ajouté avant ceux déjà faits", () => {
    const added = [...microTests, mt("new", -1)];
    expect(nextAssignment(added, new Set(["a", "b"]), completedAt, 48)?.microTestId).toBe("new");
  });

  it("rythme de 0 h : planifié tout de suite, sans partager l'objet Date reçu", () => {
    const planned = nextAssignment(microTests, new Set(), completedAt, 0);
    expect(planned?.scheduledAt).toEqual(completedAt);
    expect(planned?.scheduledAt).not.toBe(completedAt);
  });
});

describe("beforeDeadline", () => {
  const deadline = new Date("2026-12-01T00:00:00Z");

  it("vrai sans date limite, ou strictement avant", () => {
    expect(beforeDeadline(null, deadline)).toBe(true);
    expect(beforeDeadline(deadline, new Date("2026-11-30T23:59:59Z"))).toBe(true);
    expect(beforeDeadline(deadline, deadline)).toBe(false);
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
