import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
import { buildNurseOverview } from "./labels";
import type { NurseOverviewData, RawReferral } from "./nurse.types";

export async function fetchNurseOverview(signal?: AbortSignal): Promise<NurseOverviewData> {
  // Strict 15-record ceiling: server scopes to the nurse desk by role, so no
  // client-side role filtering is needed for correctness. `sort=latest` makes
  // the server rank the whole desk queue by referred time before paging —
  // Referral.id is a random uuid, so the default id-ordered page pick is an
  // arbitrary sample that can miss the newest referrals entirely. Overview
  // KPIs are computed over this preview page; full-desk aggregates move to a
  // dedicated aggregate endpoint (see technical debt note in PLAN).
  const { data } = await apiClient.get<
    RawReferral[] | { referrals: RawReferral[] } | { data: RawReferral[]; rows: RawReferral[] }
  >("/api/referrals/?page=1&pageSize=15&sort=latest", { signal });
  const list = pickList<RawReferral>(data, "data", "rows", "referrals");
  return buildNurseOverview(list);
}
