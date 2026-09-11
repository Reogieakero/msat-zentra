import { describe, it, expect } from "vitest";
import { computeRiskFactors } from "../src/services/risk.js";

const base = {
  attendance: [{ status: "present" }],
  anecdotalCount: 0,
  enrolled: 1,
};

describe("academic risk factor", () => {
  it("stays clear when finals average at/above 75", () => {
    const { academicFlag } = computeRiskFactors({
      ...base,
      finalGrades: [{ computedAverage: 80, transmutedGrade: 84 }],
    });
    expect(academicFlag).toBe(false);
  });

  it("trips on failing finals without raw grades (legacy behavior)", () => {
    const { academicFlag } = computeRiskFactors({
      ...base,
      finalGrades: [{ computedAverage: 60, transmutedGrade: 68 }],
    });
    expect(academicFlag).toBe(true);
  });

  it("trips on failing raw subject averages even with no finals", () => {
    const { academicFlag } = computeRiskFactors({
      ...base,
      finalGrades: [],
      rawAverages: [46],
    });
    expect(academicFlag).toBe(true);
  });

  it("stays clear on passing raw averages with no finals", () => {
    const { academicFlag } = computeRiskFactors({
      ...base,
      finalGrades: [],
      rawAverages: [80, 90],
    });
    expect(academicFlag).toBe(false);
  });

  it("trips when either basis fails (good finals, bad raw)", () => {
    const { academicFlag } = computeRiskFactors({
      ...base,
      finalGrades: [{ computedAverage: 90, transmutedGrade: 94 }],
      rawAverages: [60],
    });
    expect(academicFlag).toBe(true);
  });
});
