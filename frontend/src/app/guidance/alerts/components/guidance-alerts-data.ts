import { apiClient } from "@/lib/api/client";

export type GuidanceAlertLevel = "High" | "Moderate";
export type GuidanceAlertFactor = "academic" | "attendance" | "behavioral";

export interface GuidanceAlertItem {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  level: GuidanceAlertLevel;
  flagCount: number;
  factors: { academic: boolean; attendance: boolean; behavioral: boolean };
  triggers: string[];
  anecdotalCount: number;
  referralStatus: string | null;
  interventionOutcome: string | null;
  // "adm" = tracked ADM profile or ADM-track referral exists for the
  // student; "general" = all other referred/general guidance cases.
  track: "adm" | "general";
  admStageLabel: string | null;
}

export interface GuidanceAlertsSummary {
  high: number;
  moderate: number;
  total: number;
  academic: number;
  attendance: number;
  behavioral: number;
  referred: number;
  unreferred: number;
}

export interface GuidanceAlertsData {
  termLabel: string;
  summary: GuidanceAlertsSummary;
  alerts: GuidanceAlertItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuidanceAlertsParams {
  q?: string;
  level?: "" | GuidanceAlertLevel;
  factor?: "" | GuidanceAlertFactor;
  page?: number;
  pageSize?: number;
}

export async function fetchGuidanceAlerts(
  params: GuidanceAlertsParams = {}
): Promise<GuidanceAlertsData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.level) search.set("level", params.level);
  if (params.factor) search.set("factor", params.factor);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceAlertsData>(
    `/api/guidance/alerts${query ? `?${query}` : ""}`
  );
  return data;
}
