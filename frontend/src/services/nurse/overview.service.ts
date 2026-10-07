// Overview fetch for the nurse desk: tiles + breakdowns + trends derive
// from one bounded desk-list fetch via buildNurseOverview.
import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
import { buildNurseOverview } from "./labels";
import type { NurseOverviewData, RawReferral } from "./nurse.types";

export async function fetchNurseOverview(signal?: AbortSignal): Promise<NurseOverviewData> {
  // Dashboard aggregate view: tiles + breakdowns + trends need the full
  // desk list, so this stays a bounded full fetch (previews slice 10
  // client-side). Full *lists* (alerts/adm/clinic/health-records) are the
  // server-paginated surfaces via fetchNurseAlerts with ?q=&page=&pageSize=.
  const { data } = await apiClient.get<
    RawReferral[] | { referrals: RawReferral[] } | { data: RawReferral[]; rows: RawReferral[] }
  >("/api/referrals/?page=1&pageSize=100", { signal });
  const list = pickList<RawReferral>(data, "data", "rows", "referrals");
  return buildNurseOverview(list);
}
