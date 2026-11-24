import { describe, expect, it } from "vitest";
import { addHours, hoursBetween } from "./time";

describe("addHours", () => {
  it("ajoute des heures sans muter la date d'origine", () => {
    const start = new Date("2026-11-24T10:00:00Z");
    const result = addHours(start, 48);
    expect(result.toISOString()).toBe("2026-11-26T10:00:00.000Z");
    expect(start.toISOString()).toBe("2026-11-24T10:00:00.000Z");
  });
});

describe("hoursBetween", () => {
  it("calcule l'écart en heures", () => {
    const a = new Date("2026-11-24T10:00:00Z");
    const b = new Date("2026-11-25T22:00:00Z");
    expect(hoursBetween(a, b)).toBe(36);
    expect(hoursBetween(b, a)).toBe(-36);
  });
});
