import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
import { PAGE_SIZE } from "@/components/shared/pagination";
import type {
  GuidanceAnecdotalData,
  GuidanceAnecdotalParams,
  GuidanceAnecdotalRecord,
} from "./anecdotal.types";

export async function fetchGuidanceAnecdotal(
  params: GuidanceAnecdotalParams = {},
  opts: { signal?: AbortSignal } = {}
): Promise<GuidanceAnecdotalData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.type) search.set("type", params.type.toLowerCase());
  if (params.docsOnly) search.set("docs", "1");
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<
    GuidanceAnecdotalData | { records: GuidanceAnecdotalRecord[] }
  >(
    `/api/guidance/anecdotal${query ? `?${query}` : ""}`,
    { signal: opts.signal }
  );

  const records = pickList<GuidanceAnecdotalRecord>(data, "records");
  return { ...(data as GuidanceAnecdotalData), records };
}

// The anecdotal board filters locally, so it loads the whole queue once
// (same approach as the interventions board) instead of refetching on every
// keystroke — typing stays instant and never stacks stale requests.
const FETCH_ALL_PAGE_SIZE = PAGE_SIZE;

export async function fetchAllGuidanceAnecdotal(
  opts: { signal?: AbortSignal; docsOnly?: boolean } = {}
): Promise<GuidanceAnecdotalData> {
  const base = { pageSize: FETCH_ALL_PAGE_SIZE, docsOnly: opts.docsOnly };
  const first = await fetchGuidanceAnecdotal({ ...base, page: 1 }, opts);
  if (first.totalPages <= 1) return first;
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      fetchGuidanceAnecdotal({ ...base, page: i + 2 }, opts)
    )
  );
  return {
    ...first,
    records: [first.records, ...rest.map((r) => r.records)].flat(),
    page: 1,
  };
}
