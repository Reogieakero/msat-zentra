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
export async function fetchNurseRisk(): Promise<{
  rows: NurseQueueRow[];
  referralToStudent: Record<string, string>;
}> {
  const { data } = await apiClient.get<RawReferral[] | { referrals: RawReferral[] }>(
    "/api/referrals/"
  );
  const list = Array.isArray(data) ? data : (data?.referrals ?? []);
  const scoped = list.filter(isNurseScope);
  const rows = scoped.map(toQueueRow);
  const referralToStudent: Record<string, string> = {};
  for (const r of scoped) {
    const sid = r.student?.userId ?? r.roster?.id ?? null;
    if (sid) referralToStudent[r.id] = sid;
  }
  return { rows, referralToStudent };
}
