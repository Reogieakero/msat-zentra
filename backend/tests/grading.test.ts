import { describe, it, expect } from "vitest";
import {
  computeFinalGrade,
  computeSubjectGrade,
  transmuteGrade,
  remarksFromTransmuted,
  DEPED_SHS_WEIGHTS,
  DEPED_JHS_WEIGHTS,
  type CategoryEvidence,
} from "../src/services/grading.js";

describe("DepEd transmutation (DO 8, s. 2015)", () => {
  it("maps a 100 average to 100", () => {
    expect(transmuteGrade(100)).toBe(100);
  });
  it("maps the lowest passing initial grade (60) to 75", () => {
    expect(transmuteGrade(60)).toBe(75);
  });
  it("maps just below 60 to 74", () => {
    expect(transmuteGrade(59.99)).toBe(74);
  });
  it("maps 0 to 60", () => {
    expect(transmuteGrade(0)).toBe(60);
  });
  it("clamps out-of-range inputs", () => {
    expect(transmuteGrade(-5)).toBe(60);
    expect(transmuteGrade(101)).toBe(100);
  });
  it("honors official band boundaries", () => {
    expect(transmuteGrade(98.4)).toBe(99);
    expect(transmuteGrade(98.39)).toBe(98);
    expect(transmuteGrade(84)).toBe(90);
    expect(transmuteGrade(72.8)).toBe(83);
    expect(transmuteGrade(61.6)).toBe(76);
    expect(transmuteGrade(40)).toBe(70);
    expect(transmuteGrade(8)).toBe(62);
  });
  it("passes at >= 75, fails below", () => {
    expect(remarksFromTransmuted(75)).toBe("Passed");
    expect(remarksFromTransmuted(74)).toBe("Failed");
  });
  it("weighted sum produces correct computed + transmuted grade", () => {
    const { computedAverage, transmutedGrade, remarks } = computeFinalGrade([
      { weightPercentage: 40, average: 90 },
      { weightPercentage: 40, average: 80 },
      { weightPercentage: 20, average: 100 },
    ]);
    expect(computedAverage).toBeCloseTo(88);
    expect(transmutedGrade).toBe(92);
    expect(remarks).toBe("Passed");
  });
  it("zero weight yields failed floor", () => {
    const { transmutedGrade, remarks } = computeFinalGrade([]);
    expect(transmutedGrade).toBe(60);
    expect(remarks).toBe("Failed");
  });
});

describe("DepEd weight presets (DO 8, s. 2015)", () => {
  it("SHS weights total 100 (WW 25 / PT 45 / E 30)", () => {
    expect(DEPED_SHS_WEIGHTS).toEqual({ WRITTEN_WORK: 25, PERFORMANCE_TASK: 45, EXAM: 30 });
  });
  it("every JHS area preset totals 100", () => {
    for (const { weights } of DEPED_JHS_WEIGHTS) {
      expect(weights.WRITTEN_WORK + weights.PERFORMANCE_TASK + weights.EXAM).toBe(100);
    }
  });
});

function evidence(parts: Partial<CategoryEvidence> & { componentType: string }): CategoryEvidence {
  return {
    weightPercentage: 0,
    earned: 0,
    possible: 0,
    assessmentCount: 0,
    encodedCount: 0,
    ...parts,
  };
}

const WW30 = { weightPercentage: 30 };
const PT50 = { weightPercentage: 50 };
const E20 = { weightPercentage: 20 };

describe("assessment-driven computation", () => {
  it("Case 1 — WW only at 100% yields a 100% final, PT/Exam N/A", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 50, possible: 50, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    expect(r.availableCategories).toEqual(["WRITTEN_WORK"]);
    expect(r.rawGrade).toBeCloseTo(100);
    expect(r.transmutedGrade).toBe(100);
    expect(r.remarks).toBe("Passed");
    expect(r.categories.find((c) => c.componentType === "PERFORMANCE_TASK")?.percentage).toBeNull();
    expect(r.categories.find((c) => c.componentType === "EXAM")?.percentage).toBeNull();
  });

  it("Case 2 — WW 90% + PT 80% normalizes 30/50 over 80", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 90, possible: 100, assessmentCount: 3, encodedCount: 3 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50, earned: 160, possible: 200, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    expect(r.availableCategories).toEqual(["WRITTEN_WORK", "PERFORMANCE_TASK"]);
    const ww = r.categories.find((c) => c.componentType === "WRITTEN_WORK")!;
    const pt = r.categories.find((c) => c.componentType === "PERFORMANCE_TASK")!;
    expect(ww.normalizedWeight).toBeCloseTo(37.5);
    expect(pt.normalizedWeight).toBeCloseTo(62.5);
    expect(r.rawGrade).toBeCloseTo(90 * 0.375 + 80 * 0.625);
    expect(r.remarks).toBe("Passed");
  });

  it("Case 3 — WW 90% + Exam 70% normalizes 30/20 over 50", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 90, possible: 100, assessmentCount: 3, encodedCount: 3 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50 }),
      evidence({ componentType: "EXAM", ...E20, earned: 70, possible: 100, assessmentCount: 1, encodedCount: 1 }),
    ]);
    expect(r.availableCategories).toEqual(["WRITTEN_WORK", "EXAM"]);
    expect(r.rawGrade).toBeCloseTo(90 * 0.6 + 70 * 0.4);
  });

  it("Case 4 — all three categories use configured weights directly", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 90, possible: 100, assessmentCount: 3, encodedCount: 3 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50, earned: 160, possible: 200, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "EXAM", ...E20, earned: 70, possible: 100, assessmentCount: 1, encodedCount: 1 }),
    ]);
    expect(r.availableCategories).toHaveLength(3);
    expect(r.rawGrade).toBeCloseTo(90 * 0.3 + 80 * 0.5 + 70 * 0.2);
    expect(r.transmutedGrade).toBe(88);
  });

  it("Case 5 — an existing 0/20 assessment counts as a real 0%", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 0, possible: 20, assessmentCount: 1, encodedCount: 1 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    const ww = r.categories.find((c) => c.componentType === "WRITTEN_WORK")!;
    expect(ww.percentage).toBe(0);
    expect(r.rawGrade).toBe(0);
    expect(r.transmutedGrade).toBe(60);
    expect(r.remarks).toBe("Failed");
  });

  it("Case 6 — existing but unencoded assessments are excluded, not zeroed", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 86, possible: 100, assessmentCount: 3, encodedCount: 2 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50, earned: 0, possible: 0, assessmentCount: 2, encodedCount: 0 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    const ww = r.categories.find((c) => c.componentType === "WRITTEN_WORK")!;
    expect(ww.percentage).toBeCloseTo(86);
    expect(ww.coverage).toBeCloseTo(2 / 3);
    expect(r.availableCategories).toContain("PERFORMANCE_TASK");
    expect(r.rawGrade).toBeCloseTo(86);
  });

  it("Case 7 — no assessments anywhere yields no grade, never 0%/Failed", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    expect(r.availableCategories).toEqual([]);
    expect(r.rawGrade).toBeNull();
    expect(r.computedAverage).toBeNull();
    expect(r.transmutedGrade).toBeNull();
    expect(r.remarks).toBeNull();
    expect(r.coverage).toBeNull();
  });

  it("Case 8 — WW-only strength is not an artificial PT failure; real PT weakness counts", () => {
    const strong = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 95, possible: 100, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    expect(strong.rawGrade).toBeCloseTo(95);
    expect(strong.transmutedGrade).toBeGreaterThanOrEqual(75);
    expect(strong.remarks).toBe("Passed");
    const weak = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 95, possible: 100, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50, earned: 40, possible: 100, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "EXAM", ...E20, earned: 35, possible: 100, assessmentCount: 1, encodedCount: 1 }),
    ]);
    expect(weak.rawGrade).toBeCloseTo(95 * (30 / 100) + 40 * (50 / 100) + 35 * (20 / 100));
    expect(weak.transmutedGrade).toBeLessThan(75);
    expect(weak.remarks).toBe("Failed");
  });

  it("uses total-earned/total-possible within a category, not mean of percentages", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 43, possible: 50, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    expect(r.categories.find((c) => c.componentType === "WRITTEN_WORK")?.percentage).toBeCloseTo(86);
    expect(r.rawGrade).toBeCloseTo(86);
  });

  it("reports transparent breakdown + coverage", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", ...WW30, earned: 43, possible: 50, assessmentCount: 2, encodedCount: 2 }),
      evidence({ componentType: "PERFORMANCE_TASK", ...PT50, earned: 40, possible: 50, assessmentCount: 2, encodedCount: 1 }),
      evidence({ componentType: "EXAM", ...E20 }),
    ]);
    expect(r.existingAssessments).toBe(4);
    expect(r.encodedAssessments).toBe(3);
    expect(r.coverage).toBeCloseTo(0.75);
    expect(r.categories).toHaveLength(3);
  });

  it("falls back to equal split when weights are unconfigured", () => {
    const r = computeSubjectGrade([
      evidence({ componentType: "WRITTEN_WORK", earned: 80, possible: 100, assessmentCount: 1, encodedCount: 1, weightPercentage: 0 }),
      evidence({ componentType: "PERFORMANCE_TASK", earned: 60, possible: 100, assessmentCount: 1, encodedCount: 1, weightPercentage: 0 }),
    ]);
    expect(r.rawGrade).toBeCloseTo(70);
  });
});
