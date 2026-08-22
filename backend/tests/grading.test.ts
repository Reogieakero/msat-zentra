import { describe, it, expect } from "vitest";
import { computeFinalGrade, transmuteGrade, remarksFromTransmuted } from "../src/services/grading.js";

describe("DepEd transmutation (§6.1)", () => {
  it("maps a 60 average to 60", () => {
    expect(transmuteGrade(60)).toBe(60);
  });
  it("maps a 100 average to 100", () => {
    expect(transmuteGrade(100)).toBe(100);
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
    expect(transmutedGrade).toBeGreaterThanOrEqual(80);
    expect(remarks).toBe("Passed");
  });
  it("zero weight yields failed floor", () => {
    const { transmutedGrade, remarks } = computeFinalGrade([]);
    expect(transmutedGrade).toBe(60);
    expect(remarks).toBe("Failed");
  });
});
