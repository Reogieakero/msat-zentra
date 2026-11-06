export type FactorKey = "attendance" | "grades" | "behavior";

export interface FactorRow {
  key: FactorKey;
  label: string;
  value: number;
  color: string;
}

export type LevelKey = "high" | "moderate" | "low";

export interface LevelRow {
  key: LevelKey;
  label: string;
  value: number;
  color: string;
}

export function interpretRisk(
  attendance: number,
  grades: number,
  behavior: number,
  students: number,
  enrollment: number
): string {
  if (students === 0) {
    return "No students are currently flagged at risk for the active term.";
  }

  const rows: FactorRow[] = [
    { key: "attendance", label: "Attendance", value: attendance, color: "" },
    { key: "grades", label: "Academics", value: grades, color: "" },
    { key: "behavior", label: "Behavior", value: behavior, color: "" },
  ];
  rows.sort((a, b) => b.value - a.value);

  const pct = Math.round((students / Math.max(enrollment, 1)) * 100);
  const top = rows[0];
  const second = rows[1];
  const third = rows[2];

  const insights: string[] = [
    `${students} of ${enrollment} students (${pct}%) are flagged at risk this term.`,
  ];
  if (top.value > 0) {
    insights.push(
      `${top.label} is the most common trigger, affecting ${top.value} student(s).`
    );
  }
  if (second.value > 0) {
    insights.push(`${second.label} follows at ${second.value}, and ${third.label} at ${third.value}.`);
  }

  return insights.join(" ");
}

export function interpretLevels(high: number, moderate: number, low: number): string {
  const total = high + moderate + low;
  if (total === 0) {
    return "No students are tracked by risk level this term.";
  }
  const hp = Math.round((high / total) * 100);
  const mp = Math.round((moderate / total) * 100);
  const lp = 100 - hp - mp;
  const phrases: string[] = [`${total} students split by live risk level.`];
  if (high === total) {
    phrases[0] = `Every student tracked (${total}) is flagged High risk this term.`;
  } else {
    const parts: string[] = [];
    if (high > 0) parts.push(`${high} (${hp}%) High`);
    if (moderate > 0) parts.push(`${moderate} (${mp}%) Moderate`);
    parts.push(`${low} (${lp}%) Low`);
    phrases.push(parts.join(", ") + " — High means two or more factors, Moderate means one.");
  }
  return phrases.join(" ");
}

export function interpretGradeRisk(rows: { grade: string; count: number }[] | null | undefined): string {
  const atRisk = (rows ?? []).reduce((sum, r) => sum + r.count, 0);
  if (atRisk === 0) {
    return "No at-risk students across grade levels this term.";
  }
  const ranked = [...(rows ?? [])].sort((a, b) => b.count - a.count);
  const top = ranked[0];
  if (!top || atRisk === 0) {
    return "No at-risk students across grade levels this term.";
  }
  const pct = Math.round((top.count / atRisk) * 100);
  const present = (rows ?? []).filter((r) => r.count > 0).length;
  const phrases: string[] = [
    `${atRisk} at-risk students spread across ${present} grade level(s).`,
  ];
  phrases.push(
    `${top.grade} carries the heaviest load with ${top.count} (${pct}%) of all at-risk learners.`
  );
  if (ranked[1] && ranked[1].count > 0) {
    phrases.push(`${ranked[1].grade} follows with ${ranked[1].count}.`);
  }
  return phrases.join(" ");
}
