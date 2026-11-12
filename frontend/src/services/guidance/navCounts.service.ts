"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/** One queued case: id plus a version that changes whenever the case changes. */
export interface GuidanceNavEntry {
  id: string;
  v: string;
}

export interface GuidanceNavQueues {
  alerts: GuidanceNavEntry[];
  interventions: GuidanceNavEntry[];
  adm: GuidanceNavEntry[];
  counseling: GuidanceNavEntry[];
  overview: GuidanceNavEntry[];
  insights: GuidanceNavEntry[];
  schedule: GuidanceNavEntry[];
  anecdotal: GuidanceNavEntry[];
  documents: GuidanceNavEntry[];
  report: GuidanceNavEntry[];
}

/**
 * One boolean per sidebar queue: true means the queue has a case that is new
 * or changed since the counselor last opened that page. The sidebar renders a
 * dot, not a number — the exact size of the queue is noise.
 */
export type GuidanceNavDots = Record<keyof GuidanceNavQueues, boolean>;

export const GUIDANCE_NAV_COUNTS_KEY = ["guidance-nav-counts"] as const;

const STORAGE_PREFIX = "zentra.guidance.nav.seen.";
const ROUTE_KEYS: Record<string, keyof GuidanceNavQueues> = {
  "/guidance/overview": "overview",
  "/guidance/alerts": "alerts",
  "/guidance/interventions": "interventions",
  "/guidance/interventions/insights": "insights",
  "/guidance/schedule": "schedule",
  "/guidance/referrals/adm": "adm",
  "/guidance/referrals/counseling": "counseling",
  "/guidance/anecdotal": "anecdotal",
  "/guidance/session-documents": "documents",
  "/guidance/adm": "report",
};

/**
 * Query keys each badge page renders. When a queue's version map moves, the
 * matching page data is invalidated *before* the badge is visible, so opening
 * the page never shows the pre-update board behind a fresh badge.
 */
export const NAV_QUEUE_QUERY_KEYS: Record<
  keyof GuidanceNavQueues,
  readonly (readonly string[])[]
> = {
  overview: [["guidance-overview"]],
  alerts: [["guidance-alerts"]],
  interventions: [["guidance-interventions"]],
  insights: [["guidance-intervention-insights"]],
  schedule: [["guidance-calendar"]],
  adm: [["guidance-adm"], ["guidance-referrals"], ["guidance-referrals-highlight"]],
  counseling: [["guidance-referrals"], ["guidance-referrals-highlight"]],
  anecdotal: [["guidance-anecdotal"], ["guidance-risk-behavioral"]],
  documents: [["guidance-session-documents"]],
  report: [["guidance-adm", "report"], ["guidance-risk-levels"], ["guidance-risk"]],
};

export async function fetchGuidanceNavQueues(
  signal?: AbortSignal
): Promise<GuidanceNavQueues> {
  const { data } = await apiClient.get<GuidanceNavQueues>(
    "/api/guidance/nav-counts",
    { signal }
  );
  return data;
}

/** case id → version seen when the counselor last looked at this queue. */
type SeenMap = Record<string, string>;

function readSeen(key: string): SeenMap {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: SeenMap = {};
    for (const [id, version] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof version === "string") map[id] = version;
    }
    return map;
  } catch {
    return {};
  }
}

function writeSeen(key: string, entries: GuidanceNavEntry[]) {
  try {
    const map: SeenMap = {};
    for (const entry of entries) map[entry.id] = entry.v;
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${key}`,
      JSON.stringify(map)
    );
  } catch {
    // Private mode / quota: the badge just falls back to "everything is new".
  }
}

function activeKey(pathname: string): keyof GuidanceNavQueues | null {
  const path = pathname.replace(/\/+$/, "");
  for (const [href, key] of Object.entries(ROUTE_KEYS)) {
    if (path === href) return key;
  }
  return null;
}

const QUEUE_KEYS: (keyof GuidanceNavQueues)[] = [
  "overview",
  "alerts",
  "interventions",
  "insights",
  "schedule",
  "adm",
  "counseling",
  "anecdotal",
  "documents",
  "report",
];

const EMPTY_QUEUES: GuidanceNavQueues = {
  overview: [],
  alerts: [],
  interventions: [],
  insights: [],
  schedule: [],
  adm: [],
  counseling: [],
  anecdotal: [],
  documents: [],
  report: [],
};

const ZERO_DOTS = Object.fromEntries(
  QUEUE_KEYS.map((key) => [key, false]),
) as GuidanceNavDots;

const noopSubscribe = () => () => {};

/**
 * Sidebar dots mean "new or updated since you last opened this page", like the
 * bell's unread dot: opening a queue clears its dot, and a case that arrives
 * *or changes* afterwards brings it back.
 *
 * The dot is driven by the queue data itself (id + row version), not by
 * notification fanout — a write that emits no notification still lights it.
 * Realtime invalidates the query the moment any guidance table changes, and a
 * 5s background poll is the safety net when the socket is down, so the dot
 * never lags behind the board the counselor can already see and never needs a
 * manual page refresh.
 */
export function useGuidanceNavDots(): GuidanceNavDots {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: [...GUIDANCE_NAV_COUNTS_KEY],
    queryFn: ({ signal }) => fetchGuidanceNavQueues(signal),
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // LocalStorage is a client-only external store; this keeps the first
  // hydration render consistent without a mount-state effect.
  const isClient = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const openQueue = isClient ? activeKey(pathname) : null;

  // Entering a queue marks what was already there as seen. It is deliberately
  // *not* re-written on every refetch: a case that lands or changes while the
  // counselor is still on that page must raise the badge on the page they are
  // looking at (and on every other page that carries the same case), otherwise
  // the sidebar would claim "nothing new" while the board is updating.
  const seenForQueueRef = React.useRef<keyof GuidanceNavQueues | null>(null);
  // Bumped after `writeSeen` so the badge counts re-read localStorage even when
  // the nav payload itself did not change (just navigating between pages).
  const [seenTick, bumpSeen] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!isClient) return;
    if (!openQueue) {
      seenForQueueRef.current = null;
      return;
    }
    if (!data || seenForQueueRef.current === openQueue) return;
    seenForQueueRef.current = openQueue;
    writeSeen(openQueue, data[openQueue]);
    bumpSeen();
  }, [isClient, data, openQueue]);

  return React.useMemo(() => {
    if (!isClient) {
      return ZERO_DOTS;
    }
    // Re-read localStorage whenever the "seen" snapshot changes, even if the
    // queue payload is the same object.
    void seenTick;
    const queue = data ?? EMPTY_QUEUES;
    const has = (key: keyof GuidanceNavQueues) => {
      const seen = readSeen(key);
      return queue[key].some((entry) => seen[entry.id] !== entry.v);
    };
    return Object.fromEntries(QUEUE_KEYS.map((k) => [k, has(k)])) as GuidanceNavDots;
  }, [data, seenTick, isClient]);
}
