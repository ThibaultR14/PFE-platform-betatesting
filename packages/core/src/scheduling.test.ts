import { describe, expect, it } from "vitest";
import { firstAssignment, type SchedulableMicroTest } from "./scheduling";

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
