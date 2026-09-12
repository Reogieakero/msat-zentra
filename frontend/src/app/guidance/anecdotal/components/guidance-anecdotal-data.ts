import { apiClient } from "@/lib/api/client";

export type GuidanceAnecdotalCategory =
  | "behavioral"
  | "bullying"
  | "academic"
  | "attendance"
  | "health";

export interface GuidanceAnecdotalRecord {
  id: string;
  referralId: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  category: GuidanceAnecdotalCategory;
  observer: string;
  referredBy: string;
  date: string;
  confidentiality: string;
  referralStatus: string;
}

export interface GuidanceAnecdotalSummary {
  total: number;
  behavioral: number;
  bullying: number;
  academic: number;
  attendance: number;
  health: number;
}

export interface GuidanceAnecdotalData {
  summary: GuidanceAnecdotalSummary;
  records: GuidanceAnecdotalRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuidanceAnecdotalParams {
  q?: string;
  category?: "" | GuidanceAnecdotalCategory;
  page?: number;
  pageSize?: number;
}

export async function fetchGuidanceAnecdotal(
  params: GuidanceAnecdotalParams = {}
): Promise<GuidanceAnecdotalData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceAnecdotalData>(
    `/api/guidance/anecdotal${query ? `?${query}` : ""}`
  );
  return data;
}
