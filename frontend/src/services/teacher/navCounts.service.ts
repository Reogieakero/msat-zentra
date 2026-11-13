"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/** One queued case: id plus a version that changes whenever the case changes. */
export interface TeacherNavEntry {
  id: string;
  v: string;
}

export interface TeacherNavQueues {
  overview: TeacherNavEntry[];
  advisoryList: TeacherNavEntry[];
  adviseeAttendance: TeacherNavEntry[];
  adviseeAcademic: TeacherNavEntry[];
  anecdotal: TeacherNavEntry[];
  referrals: TeacherNavEntry[];
  interventions: TeacherNavEntry[];
  adm: TeacherNavEntry[];
  modules: TeacherNavEntry[];
  schedule: TeacherNavEntry[];
  sf10: TeacherNavEntry[];
}

/**
 * One boolean per adviser sidebar page: true means the page has a row that is
 * new or changed since the teacher last opened it. The rail renders a dot, not
 * a number — the exact size of the queue is noise.
 */
export type TeacherNavDots = Record<keyof TeacherNavQueues, boolean>;

export const TEACHER_NAV_COUNTS_KEY = ["teacher-nav-counts"] as const;

const STORAGE_PREFIX = "zentra.teacher.nav.seen.";
const ROUTE_KEYS: Record<string, keyof TeacherNavQueues> = {
  "/teacher/overview": "overview",
  "/teacher/advisory/list": "advisoryList",
  "/teacher/advisory/attendance": "adviseeAttendance",
  "/teacher/advisory/students": "adviseeAcademic",
  "/teacher/anecdotal": "anecdotal",
  "/teacher/advisory/referrals": "referrals",
  "/teacher/advisory/interventions": "interventions",
  "/teacher/advisory/adm-cases": "adm",
  "/teacher/advisory/modules": "modules",
  "/teacher/advisory/schedule": "schedule",
  "/teacher/advisory/sf10-access": "sf10",
};

/** Detail pages that belong to a queue above (e.g. one ADM case). */
const PREFIX_KEYS: [string, keyof TeacherNavQueues][] = [
  ["/teacher/advisory/adm-cases/", "adm"],
];

/**
 * Query keys each badge page renders. When a queue's version map moves the
 * matching page data is invalidated *before* the dot is visible, so opening
 * the page never shows the pre-update board behind a fresh badge.
 */
export const NAV_QUEUE_QUERY_KEYS: Record<
  keyof TeacherNavQueues,
  readonly (readonly string[])[]
> = {
  overview: [["teacher-overview"], ["teacher-overview-secondary"]],
  advisoryList: [["advisory-students"], ["advisory-students-archived"]],
  adviseeAttendance: [["advisee-attendance"]],
  adviseeAcademic: [["advisee-academic"]],
  anecdotal: [["anecdotal-mine"], ["advisee-anecdotal"]],
  referrals: [["myReferrals"], ["referableAnecdotal"]],
  interventions: [["advisory-interventions"]],
  adm: [["adm-my-cases"], ["adm-monitoring"]],
  modules: [["advisory-modules"]],
  schedule: [["teacher-schedule"], ["teacher-schedule-section"]],
  sf10: [["teacher-sf10-access"]],
};

export async function fetchTeacherNavQueues(
  signal?: AbortSignal
): Promise<TeacherNavQueues> {
  const { data } = await apiClient.get<TeacherNavQueues>(
    "/api/teacher/nav-counts",
    { signal }
  );
  return data;
}

/** case id → version seen when the teacher last looked at this page. */
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

function writeSeen(key: string, entries: TeacherNavEntry[]) {
  try {
    const map: SeenMap = {};
    for (const entry of entries) map[entry.id] = entry.v;
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(map));
  } catch {
    // Private mode / quota: the badge falls back to "everything is new".
  }
}

function activeKey(pathname: string): keyof TeacherNavQueues | null {
  const path = pathname.replace(/\/+$/, "");
  const exact = ROUTE_KEYS[path];
  if (exact) return exact;
  for (const [prefix, key] of PREFIX_KEYS) {
    if (path.startsWith(prefix)) return key;
  }
  return null;
}

const QUEUE_KEYS: (keyof TeacherNavQueues)[] = [
  "overview",
  "advisoryList",
  "adviseeAttendance",
  "adviseeAcademic",
  "anecdotal",
  "referrals",
  "interventions",
  "adm",
  "modules",
  "schedule",
  "sf10",
];

const ZERO_DOTS = Object.fromEntries(
  QUEUE_KEYS.map((key) => [key, false]),
) as TeacherNavDots;

const noopSubscribe = () => () => {};

/**
 * Sidebar dots mean "new or updated since you last opened this page", like the
 * bell's unread dot: opening a queue clears its dot, and a case that arrives
 * *or changes* afterwards brings it back.
 *
 * The dot is driven by the queue data itself (id + row version), not by
 * notification fanout — a write that emits no notification still lights it.
 * Realtime invalidates the query the moment a teacher table changes, and a 5s
 * background poll keeps it honest when the socket is down, so a dot never lags
 * behind the board the teacher can already see and never needs a page reload.
 */
export function useTeacherNavDots(): TeacherNavDots {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: [...TEACHER_NAV_COUNTS_KEY],
    queryFn: ({ signal }) => fetchTeacherNavQueues(signal),
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // LocalStorage is a client-only external store; keep the first hydration
  // render consistent without a mount-state effect.
  const isClient = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const openQueue = isClient ? activeKey(pathname) : null;

  // Entering a queue marks what was already there as seen. Deliberately not
  // re-written on every refetch: a case that lands or changes while the
  // teacher is still on that page must raise the dot on the page they are
  // looking at (and on every other page that carries the same case).
  const seenForQueueRef = React.useRef<keyof TeacherNavQueues | null>(null);
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
    if (!isClient) return ZERO_DOTS;
    // Re-read localStorage whenever the "seen" snapshot changes, even if the
    // queue payload is the same object.
    void seenTick;
    const queue = data;
    if (!queue) return ZERO_DOTS;
    const has = (key: keyof TeacherNavQueues) => {
      const seen = readSeen(key);
      return queue[key].some((entry) => seen[entry.id] !== entry.v);
    };
    return Object.fromEntries(QUEUE_KEYS.map((k) => [k, has(k)])) as TeacherNavDots;
  }, [data, seenTick, isClient]);
}

/**
 * When a dot turns on, refresh that page's data first so opening the page never
 * shows the pre-update board behind a fresh badge. Writes that emit no realtime
 * frame (a module submission, a registry decision) are only discovered by the
 * nav poll, so this is what keeps the dot and its page in the same tick.
 */
export function useTeacherNavDotInvalidation(dots: TeacherNavDots) {
  const queryClient = useQueryClient();
  const previous = React.useRef<TeacherNavDots>(ZERO_DOTS);
  React.useEffect(() => {
    for (const key of QUEUE_KEYS) {
      if (!dots[key] || previous.current[key]) continue;
      for (const queryKey of NAV_QUEUE_QUERY_KEYS[key]) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    }
    previous.current = dots;
  }, [dots, queryClient]);
}
