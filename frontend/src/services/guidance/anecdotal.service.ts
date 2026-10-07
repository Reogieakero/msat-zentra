// Folder fetch for the guidance anecdotal desk.
import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
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
  // Defensive: the endpoint has served bare {records} shapes — never let
  // a shape change crash the folders.
  const records = pickList<GuidanceAnecdotalRecord>(data, "records");
  return { ...(data as GuidanceAnecdotalData), records };
}
