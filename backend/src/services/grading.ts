// PLAN.md §6.1 — DepEd grade transmutation (60-100 scale).
// Maps a computed average (0-100) to the DepEd transmuted grade.
// Reference: DepEd transmutation table (60->60 ... 100->100), monotonic.
const TRANSMUTATION: { min: number; grade: number }[] = [
  { min: 0, grade: 60 }, { min: 60, grade: 60 }, { min: 63, grade: 65 },
  { min: 67, grade: 70 }, { min: 71, grade: 73 }, { min: 74, grade: 75 },
  { min: 77, grade: 78 }, { min: 80, grade: 80 }, { min: 83, grade: 82 },
  { min: 86, grade: 84 }, { min: 89, grade: 86 }, { min: 92, grade: 88 },
  { min: 95, grade: 90 }, { min: 97, grade: 92 }, { min: 99, grade: 95 },
  { min: 100, grade: 100 },
];

export function transmuteGrade(computedAverage: number): number {
  let result = 60;
  for (const row of TRANSMUTATION) {
    if (computedAverage >= row.min) result = row.grade;
    else break;
  }
  return result;
}

export function remarksFromTransmuted(transmuted: number): "Passed" | "Failed" {
  return transmuted >= 75 ? "Passed" : "Failed";
}

export type HonorRollTier = "Highest Honors" | "High Honors" | "With Honors";

// DepEd honor roll classification (DO 8, s. 2015): requires all subject grades
// to be finalized and uses the general average with the lowest subject grade.
// Shared by the academics + overview endpoints so the honor-roll concept is
// identical across principal pages.
export function classifyHonorRoll(
  overallAverage: number,
  lowestSubject: number
): HonorRollTier | null {
  if (overallAverage >= 98 && lowestSubject >= 90) return "Highest Honors";
  if (overallAverage >= 95 && lowestSubject >= 85) return "High Honors";
  if (overallAverage >= 90 && lowestSubject >= 85) return "With Honors";
  return null;
}

// Weighted sum of component averages → computed grade, then transmute.
export function computeFinalGrade(
  componentAverages: { weightPercentage: number; average: number }[]
): { computedAverage: number; transmutedGrade: number; remarks: "Passed" | "Failed" } {
  const totalWeight = componentAverages.reduce((s, c) => s + c.weightPercentage, 0);
  if (totalWeight === 0) {
    return { computedAverage: 0, transmutedGrade: 60, remarks: "Failed" };
  }
  const computedAverage =
    componentAverages.reduce((s, c) => s + (c.average * c.weightPercentage) / 100, 0);
  const transmutedGrade = transmuteGrade(computedAverage);
  return { computedAverage, transmutedGrade, remarks: remarksFromTransmuted(transmutedGrade) };
}
