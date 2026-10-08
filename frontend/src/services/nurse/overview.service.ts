import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
import { buildNurseOverview } from "./labels";
import type { NurseOverviewData, RawReferral } from "./nurse.types";

export async function fetchNurseOverview(signal?: AbortSignal): Promise<NurseOverviewData> {

  const { data } = await apiClient.get<
    RawReferral[] | { referrals: RawReferral[] } | { data: RawReferral[]; rows: RawReferral[] }
  >("/api/referrals/?page=1&pageSize=100", { signal });
  const list = pickList<RawReferral>(data, "data", "rows", "referrals");
  return buildNurseOverview(list);
}
