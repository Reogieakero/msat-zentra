import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
import type { AdmCase, MyAdmCasesPage } from "./admCases.types";

export async function fetchMyAdmCases(
  params: { q?: string; page?: number; pageSize?: number; highlight?: string; signal?: AbortSignal } = {}
): Promise<MyAdmCasesPage> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  search.set("page", String(Math.max(1, params.page ?? 1)));
  search.set("pageSize", String(params.pageSize ?? 15));
  if (params.highlight) search.set("highlight", params.highlight);
  const { data } = await apiClient.get<
    MyAdmCasesPage | AdmCase[] | { cases: AdmCase[] }
  >(`/api/adm/my-cases${search.toString() ? `?${search.toString()}` : ""}`, {
    signal: params.signal,
  });

  if (Array.isArray(data)) {
    return {
      cases: data,
      total: data.length,
      unfilteredTotal: data.length,
      page: params.page ?? 1,
      totalPages: 1,
      pageSize: params.pageSize ?? data.length,
    };
  }
  const cases = pickList<AdmCase>(data, "cases");
  const fallback = data as Partial<MyAdmCasesPage>;
  const total = fallback.total ?? cases.length;
  return {
    cases,
    total,
    unfilteredTotal: fallback.unfilteredTotal ?? cases.length,
    page: fallback.page ?? params.page ?? 1,
    totalPages:
      fallback.totalPages ??
      Math.max(1, Math.ceil(total / (params.pageSize ?? 15))),
    pageSize: fallback.pageSize ?? params.pageSize ?? 15,
  };
}
