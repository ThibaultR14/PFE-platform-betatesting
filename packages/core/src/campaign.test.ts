import { describe, expect, it } from "vitest";
import { durationSummary } from "./campaign";

describe("durationSummary", () => {
  it("compte les micro-tests et leur durée", () => {
    expect(
      durationSummary([
        { estimatedMinutes: 5, archivedAt: null },
        { estimatedMinutes: 6, archivedAt: null },
        { estimatedMinutes: 6, archivedAt: null },
      ]),
    ).toEqual({ count: 3, minutesPerTest: 6, totalMinutes: 17 });
  });

  it("ignore les micro-tests archivés", () => {
    expect(
      durationSummary([
        { estimatedMinutes: 5, archivedAt: null },
        { estimatedMinutes: 30, archivedAt: new Date("2026-11-25T00:00:00Z") },
      ]),
    ).toEqual({ count: 1, minutesPerTest: 5, totalMinutes: 5 });
  });

  it("renvoie zéro sans micro-test", () => {
    expect(durationSummary([])).toEqual({ count: 0, minutesPerTest: 0, totalMinutes: 0 });
  });
});
