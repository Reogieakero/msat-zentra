"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { recordKeeperNotificationTitle } from "@/lib/notifications/label";

const RECORD_KEEPER_KEYS = [
  ["record-keeper-overview"],
  ["record-keeper-final-grades"],
  ["record-keeper-pending-students"],
  ["record-keeper-account-breakdown"],
  ["record-keeper-accounts-audit"],
  ["record-keeper-sf10"],
  ["record-keeper-adviser-access"],
  ["record-keeper-notifications"],
] as const;

type KeyTuple = readonly [string, ...string[]];

/* Targeted realtime invalidation: each event refreshes only the queries its
   source table feeds (plus the bell). Unknown tables fall back to the full
   sweep so correctness never depends on the map staying exhaustive. */
function keysForNotification(
  row: Pick<RecordKeeperNotification, "sourceTable" | "type">,
): KeyTuple[] {
  const bell: KeyTuple = ["record-keeper-notifications"];
  switch (row.sourceTable) {
    case "users":
      return [
        ["record-keeper-pending-students"],
        ["record-keeper-account-breakdown"],
        ["record-keeper-overview"],
        bell,
      ];
    case "final_grades":
      return [["record-keeper-final-grades"], ["record-keeper-overview"], bell];
    case "adviser_sf10_access_requests":
      return [["record-keeper-adviser-access"], ["record-keeper-overview"], bell];
    case "sf10_records":
      return [["record-keeper-sf10"], ["record-keeper-overview"], bell];
    case "subjects":
    case "sections":
    case "teacher_subject_assignments":
      return [
        ["record-keeper-overview"],
        ["record-keeper-account-breakdown"],
        bell,
      ];
    default:
      return [...RECORD_KEEPER_KEYS];
  }
}

interface RecordKeeperNotification {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt?: string;
}

// Poll cadence — this is the actual delivery transport, not just a safety
// net: the browser Supabase client authenticates as anon (the app's sessions
// are backend-signed JWTs, not Supabase Auth), so row-scoped Realtime events
// never reach it even with the table published. Cheap indexed query, and
// rows already toasted are skipped through `seenIds`. Kept short so
// sign-ups, access requests, and finals-ready events surface within seconds.
const FALLBACK_POLL_MS = 5_000;
const MAX_TOASTS_PER_POLL = 3;

/** Self-save suppression: writes this session already confirmed with a
 *  direct toast skip the realtime duplicate (data still invalidates, the
 *  bell row still lands). Keyed by notification sourceId. */
const selfSaved = new Map<string, number>();
const SELF_SUPPRESS_MS = 30_000;

export function markSelfNotified(sourceId: string) {
  selfSaved.set(sourceId, Date.now());
}

/** Current user id from the stored access JWT (backend signs `sub`). */
function currentUserId(): string | null {
  try {
    const token = window.localStorage.getItem("zentra.access");
    if (!token) return null;
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Record-keeper desk realtime sync — one shared Supabase channel per mount.
 * Listens for INSERTs on the Notification table scoped to the signed-in
 * record keeper and pops a specific sileo toast on whatever page they are on
 * (e.g. the moment a G7 student signs up or finals become ready), plus
 * invalidates the record-keeper query keys so lists refresh with no manual
 * reload.
 *
 * Delivery is two-layer: a 5s backend poll (the working transport — the
 * anon Supabase client never receives row-scoped Realtime events for
 * backend-signed sessions) plus the Supabase Realtime subscription as a
 * bonus path where policies allow. Rows are deduped by id across both
 * layers, so a healthy connection never double-toasts. Titles come from the
 * shared recordKeeperNotificationTitle mapper so bell and sileo match.
 */
export function useRecordKeeperRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const pendingRows = React.useRef<RecordKeeperNotification[]>([]);
  const trailingTimer = React.useRef<number | null>(null);
  const seenIds = React.useRef<Set<string>>(new Set());
  const realtimeOk = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: RecordKeeperNotification) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      // Writes this session already confirmed with a direct toast (approvals,
      // access decisions, SF10 validates) skip the realtime echo toast — the
      // bell row still lands and lists still invalidate.
      const selfConfirmed =
        !!row.sourceId && Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      if (!selfConfirmed) {
        toast.info({
          title: recordKeeperNotificationTitle({
            type: row.type,
            sourceTable: row.sourceTable,
            message: row.message,
          }),
          description: row.message,
        });
      }
      void invalidate([row]);
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel(`record-keeper-desk-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Notification",
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            notify((payload as unknown as { new?: RecordKeeperNotification }).new as RecordKeeperNotification);
          },
        )
        .subscribe((status) => {
          realtimeOk.current = status === "SUBSCRIBED";
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[record-keeper-realtime] channel status: ${status}`);
          }
        });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
      // Realtime unavailable — the polling safety net below still delivers.
    }

    // Safety net: pick up anything Realtime missed. First poll only seeds
    // the seen set (no toast storm for old inbox rows); later polls toast
    // rows that arrived since, capped per poll.
    let seeded = false;
    async function poll() {
      if (cancelled || document.hidden) return;
      try {
        const { data } = await apiClient.get<RecordKeeperNotification[]>(
          "/api/notifications/",
        );
        if (cancelled || !Array.isArray(data)) return;
        const mine = data.filter((n) => n.userId === userId);
        if (!seeded) {
          for (const n of mine) seenIds.current.add(n.id);
          seeded = true;
          return;
        }
        const fresh = mine.filter((n) => !seenIds.current.has(n.id));
        if (fresh.length === 0) return;
        // Oldest first so the newest toast stays on top.
        const ordered = [...fresh].reverse().slice(0, MAX_TOASTS_PER_POLL);
        for (const n of ordered) notify(n);
        // Mark the rest seen (lists still refresh below) to avoid backlog.
        for (const n of fresh) seenIds.current.add(n.id);
        void invalidate(fresh);
      } catch {
        // Offline / unauthorized — try again on the next tick.
      }
    }
    const timer = window.setInterval(poll, FALLBACK_POLL_MS);
    // Seed soon after mount so the missed-toast window is tiny (seed itself
    // never toasts).
    const seedTimer = window.setTimeout(poll, 1_000);
    // Poll the moment the tab regains focus — events that landed while
    // away surface immediately with no manual refresh.
    const onFocus = () => {
      void poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    function invalidate(rows?: RecordKeeperNotification[]) {
      // Throttle bursts to one invalidate per 2s (toasts still fire per row).
      // Rows arriving inside the window accumulate and flush together so no
      // table's keys are ever dropped by the throttle.
      const now = Date.now();
      if (rows) {
        for (const row of rows) pendingRows.current.push(row);
      }
      if (now - lastInvalidated.current < 2000) {
        if (pendingRows.current.length > 0 && !trailingTimer.current) {
          trailingTimer.current = window.setTimeout(() => {
            trailingTimer.current = null;
            if (cancelled) return;
            lastInvalidated.current = Date.now();
            flushPending();
          }, 2000 - (now - lastInvalidated.current));
        }
        return;
      }
      lastInvalidated.current = now;
      flushPending();
    }

    function flushPending() {
      const queued = [...pendingRows.current];
      pendingRows.current = [];
      const keys = new Map<string, KeyTuple>();
      for (const row of queued) {
        for (const key of keysForNotification(row)) keys.set(key.join("|"), key);
      }
      // No rows (or unknown table) → full sweep preserves correctness.
      const targets = keys.size > 0 ? [...keys.values()] : [...RECORD_KEEPER_KEYS];
      for (const key of targets) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(seedTimer);
      if (trailingTimer.current) window.clearTimeout(trailingTimer.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      try {
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient]);
}
