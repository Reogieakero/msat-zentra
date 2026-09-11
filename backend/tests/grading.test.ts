import { describe, it, expect } from "vitest";
import {
  computeFinalGrade,
  transmuteGrade,
  remarksFromTransmuted,
  DEPED_SHS_WEIGHTS,
  DEPED_JHS_WEIGHTS,
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
  it("SHS weights total 100 (WW 25 / PT 45 / QA 30)", () => {
    expect(DEPED_SHS_WEIGHTS).toEqual({ WRITTEN_WORK: 25, PERFORMANCE_TASK: 45, QUARTERLY_EXAM: 30 });
  });
  it("every JHS area preset totals 100", () => {
    for (const { weights } of DEPED_JHS_WEIGHTS) {
      expect(weights.WRITTEN_WORK + weights.PERFORMANCE_TASK + weights.QUARTERLY_EXAM).toBe(100);
    }
  });
});
