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

  it("trips when computed avg fails but transmuted passes (unified EITHER)", () => {
    const { academicFlag } = computeRiskFactors({
      ...base,
      finalGrades: [{ computedAverage: 70, transmutedGrade: 80 }],
    });
    expect(academicFlag).toBe(true);
  });

  it("trips when transmuted avg fails but computed passes (unified EITHER)", () => {
    const { academicFlag } = computeRiskFactors({
      ...base,
      finalGrades: [{ computedAverage: 80, transmutedGrade: 70 }],
    });
    expect(academicFlag).toBe(true);
  });

  it("ignores gradeMode param (real-time unified)", () => {
    const grades = [{ computedAverage: 70, transmutedGrade: 80 }];
    const raw = computeRiskFactors({ ...base, finalGrades: grades, gradeMode: "raw" });
    const fin = computeRiskFactors({ ...base, finalGrades: grades, gradeMode: "final" });
    expect(raw.academicFlag).toBe(true);
    expect(fin.academicFlag).toBe(true);
  });
});
