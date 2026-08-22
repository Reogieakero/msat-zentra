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
