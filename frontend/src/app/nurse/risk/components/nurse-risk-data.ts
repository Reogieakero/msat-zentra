import { apiClient } from "@/lib/api/client";
import {
  isNurseScope,
  toQueueRow,
  type NurseQueueRow,
  type RawReferral,
} from "../../overview/components/nurse-overview-data";

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
