import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
import { isNurseScope, toQueueRow } from "./labels";
import type {
  NurseQueueRow,
  NurseRiskFactors,
  NurseRiskLevel,
  RawReferral,
} from "./nurse.types";

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

export async function fetchNurseRisk(signal?: AbortSignal): Promise<{
  rows: NurseQueueRow[];
  referralToStudent: Record<string, string>;
}> {

  const { data } = await apiClient.get<
    RawReferral[] | { referrals: RawReferral[] } | { data: RawReferral[]; rows: RawReferral[] }
  >("/api/referrals/?page=1&pageSize=100", { signal });
  const list = pickList<RawReferral>(data, "data", "rows", "referrals");
  const scoped = list.filter(isNurseScope);
  const rows = scoped.map(toQueueRow);
  const referralToStudent: Record<string, string> = {};
  for (const r of scoped) {
    const sid = r.student?.userId ?? r.roster?.id ?? null;
    if (sid) referralToStudent[r.id] = sid;
  }
  return { rows, referralToStudent };
}
