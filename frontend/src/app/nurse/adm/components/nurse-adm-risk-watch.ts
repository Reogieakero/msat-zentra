import { RISK_FACTOR_WORDS } from "@/services/nurse/risk.service";
import type {
  NurseQueueRow,
  NurseRiskFactors,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";

export interface RiskWatchedStudent {
  studentId: string;
  student: string;
  section: string;
  drivers: string[];
  referralId: string;
  kind: string;
}

export interface RiskWatchData {
  urgent: number;
  watch: number;
  okay: number;
  unknown: number;
  watchlist: RiskWatchedStudent[];
  topDriver: string | null;
  topDriverCount: number;
}

function referredMs(row: NurseQueueRow): number {
  const t = new Date(row.referredAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Newest referral per student → plain-language risk watch summary. */
export function buildRiskWatch(
  rows: NurseQueueRow[],
  referralToStudent: Record<string, string>,
  riskByStudent: Record<string, NurseRiskLevel>,
  riskFactors: Record<string, NurseRiskFactors>,
): RiskWatchData {
  const newestByStudent = new Map<string, NurseQueueRow>();
  for (const row of rows) {
    const sid = referralToStudent[row.id] ?? null;
    if (!sid) continue;
    const prev = newestByStudent.get(sid);
    if (!prev || referredMs(row) >= referredMs(prev)) newestByStudent.set(sid, row);
  }

  let urgent = 0;
  let watch = 0;
  let okay = 0;
  const driverCounts: { key: keyof NurseRiskFactors; count: number }[] = [
    { key: "Academic", count: 0 },
    { key: "Attendance", count: 0 },
    { key: "Behavioral", count: 0 },
  ];
  const watched: RiskWatchedStudent[] = [];
  for (const [studentId, row] of newestByStudent) {
    const level = riskByStudent[studentId];
    if (level === "High") urgent += 1;
    else if (level === "Moderate") watch += 1;
    else if (level === "Low") okay += 1;
    else continue;
    const flags = riskFactors[studentId];
    const drivers = (
      Object.keys(RISK_FACTOR_WORDS) as (keyof NurseRiskFactors)[]
    ).filter((k) => flags?.[k] === true);
    for (const d of driverCounts) {
      if (flags?.[d.key] === true) d.count += 1;
    }
    if (level === "High") {
      watched.push({
        studentId,
        student: row.student || "Unknown student",
        section: row.section || "",
        drivers: drivers.map((k) => RISK_FACTOR_WORDS[k]),
        referralId: row.id,
        kind: row.type || "",
      });
    }
  }
  watched.sort(
    (a, b) => b.drivers.length - a.drivers.length || a.student.localeCompare(b.student),
  );
  const topDriver = [...driverCounts].sort((a, b) => b.count - a.count)[0];
  return {
    urgent,
    watch,
    okay,
    unknown: newestByStudent.size - urgent - watch - okay,
    watchlist: watched.slice(0, 5),
    topDriver: topDriver && topDriver.count > 0 ? RISK_FACTOR_WORDS[topDriver.key] : null,
    topDriverCount: topDriver?.count ?? 0,
  };
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  const [last, ...rest] = parts.slice().reverse();
  return `${rest.reverse().join(", ")} and ${last}`;
}

/** One-line plain-language summary of the whole watch group. */
export function watchSummary(data: RiskWatchData): string {
  const known = data.urgent + data.watch + data.okay;
  if (known === 0) {
    return data.unknown > 0
      ? `Risk info is missing for ${data.unknown} student${data.unknown === 1 ? "" : "s"} — levels will appear here once the lookup resolves.`
      : "Risk levels will appear here once referred students resolve one.";
  }
  const parts: string[] = [];
  if (data.urgent > 0)
    parts.push(`${data.urgent} need${data.urgent === 1 ? "s" : ""} urgent attention`);
  if (data.watch > 0) parts.push(`${data.watch} to keep an eye on`);
  if (data.okay > 0) parts.push(`${data.okay} doing okay`);
  return `${joinParts(parts)}.`;
}
