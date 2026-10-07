// Live risk lookups for the nurse desk: batched levels + factor flags per
// referred student, and the risk-board desk fetch. Never throws — misses
// simply render "—" / hide driver lines.
import { apiClient } from "@/lib/api/client";
import { isNurseScope, toQueueRow } from "./labels";
import type {
  NurseQueueRow,
  NurseRiskFactors,
  NurseRiskLevel,
  RawReferral,
} from "./nurse.types";

// Plain words for non-technical readers — single source of truth so every
// desk says the same thing about the same level or factor.
export const RISK_LEVEL_WORDS: Record<NurseRiskLevel, string> = {
  High: "Needs urgent attention",
  Moderate: "Keep an eye on",
  Low: "Doing okay",
};

export const RISK_FACTOR_WORDS: Record<keyof NurseRiskFactors, string> = {
  Academic: "low grades",
  Attendance: "missing classes",
  Behavioral: "behavior notes",
};

// Live factor flags per referred student — same batched endpoint as levels
// (additive `factors` map). Ids with no result stay absent. Never throws:
// an empty map simply hides the driver lines.
export async function fetchNurseRiskFactors(
  studentIds: string[]
): Promise<Record<string, NurseRiskFactors>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const { data } = await apiClient.get<{
      factors?: Record<string, Partial<NurseRiskFactors> | null>;
    }>("/api/risk/students/batch", { params: { ids: unique.join(",") } });
    const map: Record<string, NurseRiskFactors> = {};
    for (const [id, f] of Object.entries(data?.factors ?? {})) {
      map[id] = {
        Academic: f?.Academic === true,
        Attendance: f?.Attendance === true,
        Behavioral: f?.Behavioral === true,
      };
    }
    return map;
  } catch {
    return {};
  }
}

// Live rule-based risk level per referred student — single batched call
// (GET /api/risk/students/batch?ids=…) replacing the old per-student N+1
// fan-out. Falls back to per-id requests only if the batch endpoint is
// unavailable (transitional). Ids with no result stay absent (table "—").
export async function fetchNurseRiskLevels(
  studentIds: string[]
): Promise<Record<string, NurseRiskLevel>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const isLevel = (v: unknown): v is NurseRiskLevel =>
    v === "High" || v === "Moderate" || v === "Low";
  try {
    const { data } = await apiClient.get<{ levels: Record<string, string> }>(
      "/api/risk/students/batch",
      { params: { ids: unique.join(",") } }
    );
    const map: Record<string, NurseRiskLevel> = {};
    for (const [id, level] of Object.entries(data?.levels ?? {})) {
      if (isLevel(level)) map[id] = level;
    }
    return map;
  } catch {
    // Transitional fallback — one failure never blocks the rest.
    const settled = await Promise.allSettled(
      unique.map(async (id) => {
        const { data } = await apiClient.get<{ lrn: string; riskLevel: NurseRiskLevel }>(
          `/api/risk/students/${id}`
        );
        return { id, riskLevel: data?.riskLevel ?? null };
      })
    );
    const map: Record<string, NurseRiskLevel> = {};
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value.riskLevel !== null && isLevel(s.value.riskLevel)) {
        map[s.value.id] = s.value.riskLevel;
      }
    }
    return map;
  }
}

/**
 * Nurse risk desk fetch — the dashboard math itself lives in the shared
 * `@/components/risk-dashboard/risk-dashboard-data` module so the nurse
 * and guidance boards stay identical.
 */
export async function fetchNurseRisk(signal?: AbortSignal): Promise<{
  rows: NurseQueueRow[];
  referralToStudent: Record<string, string>;
}> {
  // Aggregate dashboard input: bounded desk fetch, defensively normalized
  // across every payload shape the queue endpoint has served.
  const { data } = await apiClient.get<
    RawReferral[] | { referrals: RawReferral[] } | { data: RawReferral[]; rows: RawReferral[] }
  >("/api/referrals/?page=1&pageSize=100", { signal });
  const list: RawReferral[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown })?.data)
      ? (data as { data: RawReferral[] }).data
      : Array.isArray((data as { rows?: unknown })?.rows)
        ? (data as { rows: RawReferral[] }).rows
        : Array.isArray((data as { referrals?: unknown })?.referrals)
          ? (data as { referrals: RawReferral[] }).referrals
          : [];
  const scoped = list.filter(isNurseScope);
  const rows = scoped.map(toQueueRow);
  const referralToStudent: Record<string, string> = {};
  for (const r of scoped) {
    const sid = r.student?.userId ?? r.roster?.id ?? null;
    if (sid) referralToStudent[r.id] = sid;
  }
  return { rows, referralToStudent };
}
