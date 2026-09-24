"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useSession } from "@/lib/auth/useSession";
import {
  realtimeEventKey,
  seenRealtimeEvent,
  wasRecentLocalMutation,
} from "./nurseRealtimeMeta";

const NURSE_KEYS = [
  ["nurse-alerts"],
  ["nurse-overview"],
  ["nurse-risk"],
  ["nurse-risk-levels"],
  ["nurse-notifications"],
] as const;

type RealtimePayload = {
  eventType?: string;
  commit_timestamp?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

interface NurseInboxRow {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Poll safety net (mirrors the coordinator desk): auth-gated REST is the only
// recipient-safe way to learn about inbox rows, so a missed realtime tick can
// never leave the bell stale for long.
const FALLBACK_POLL_MS = 30_000;
const MAX_TOASTS_PER_SYNC = 3;

function toastTitleFor(n: NurseInboxRow): string {
  if (/clinic referral submitted/i.test(n.message)) return "New clinic referral";
  if (/escalated to the clinic/i.test(n.message)) return "Case escalated to you";
  if (/reassigned to the clinic/i.test(n.message)) return "Case reassigned to you";
  if (/clinic accepted/i.test(n.message)) return "Referral update";
  return "New notification";
}

/**
 * Nurse desk realtime sync — one shared Supabase channel per mount.
 *
 * Security model: the app signs its own JWTs, so the Supabase anon key holds
 * NO grant on `Notification` (deliberately — a grant would expose every
 * notification, including student names, through public PostgREST). Realtime
 * therefore delivers Notification row payloads EMPTY (401 on row data) and a
 * per-user `postgres_changes` filter can never match — verified live. So the
 * Notification binding is intentionally UNFILTERED and invalidate-only: every
 * INSERT only triggers an auth-gated REST fetch (`GET /api/notifications/`,
 * scoped server-side to the signed-in nurse), which then updates the bell via
 * `setQueryData` and toasts precisely the rows that are new for this nurse.
 * No PHI ever travels over the realtime socket; the backend stays the source
 * of truth.
 *
 * Behavior:
 * - Table events (Referral, sessions, AdmLearnerProfile) → throttled
 *   invalidate (1 per 2s) + event-ID dedup (15s window).
 * - Notification INSERT (any user) → throttled inbox sync: fetch own inbox,
 *   write it straight into `["nurse-notifications"]`, toast only rows with
 *   ids never seen before (capped per sync). Bell badge updates immediately,
 *   no refresh, no full-desk refetch.
 * - 30s poll safety net covers missed ticks (first run only seeds, no toast
 *   storm for old inbox rows).
 * - Reconnect reconcile: on SUBSCRIBED + visibility/online restore, refetch
 *   from the database (events may have been missed).
 */
export function useNurseRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const session = useSession();
  const userId = session?.sub ?? null;
  const lastInvalidated = React.useRef(0);
  const lastToasted = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());
  const seeded = React.useRef(false);
  const lastSync = React.useRef(0);
  const trailingTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    // Fresh identity (or remount) → fresh seen set, so a previous nurse's
    // inbox can never suppress this nurse's first toast.
    seenIds.current = new Set();
    seeded.current = false;
    lastSync.current = 0;
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    let visibilityHandler: (() => void) | null = null;
    let onlineHandler: (() => void) | null = null;

    function invalidate(keys: readonly (readonly [string])[] = NURSE_KEYS) {
      // Throttle bursts (e.g. multi-row writes) to one invalidate per 2s.
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    function toastRows(rows: NurseInboxRow[]) {
      if (rows.length === 0) return;
      // Initiator echo guard + per-sync toast throttle.
      if (wasRecentLocalMutation()) return;
      const now = Date.now();
      if (now - lastToasted.current < 8000) return;
      lastToasted.current = now;
      // Oldest first so the newest toast stays on top.
      const ordered = [...rows].reverse().slice(0, MAX_TOASTS_PER_SYNC);
      for (const n of ordered) {
        toast.info({ title: toastTitleFor(n), description: n.message });
      }
    }

    // Auth-gated inbox sync — the recipient-safe realtime path. Writes the
    // fetched inbox straight into the bell query (badge updates without a
    // second refetch) and toasts only rows never seen before.
    async function syncInbox(reason: "event" | "poll" | "seed") {
      if (cancelled || document.hidden) return;
      try {
        const { data } = await apiClient.get<NurseInboxRow[]>("/api/notifications/");
        if (cancelled || !Array.isArray(data)) return;
        queryClient.setQueryData(["nurse-notifications"], data);
        void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
        if (!seeded.current) {
          for (const n of data) seenIds.current.add(n.id);
          seeded.current = true;
          return;
        }
        const fresh = data.filter((n) => !seenIds.current.has(n.id));
        for (const n of data) seenIds.current.add(n.id);
        if (reason !== "seed") toastRows(fresh);
      } catch {
        // Offline / unauthorized — the next tick or reconnect covers it.
      }
    }

    function scheduleSync(reason: "event" | "poll") {
      // Throttle bursts to one sync per 2s, with a trailing run so the last
      // event in a burst is never dropped.
      const now = Date.now();
      if (now - lastSync.current < 2000) {
        if (trailingTimer.current === null) {
          trailingTimer.current = window.setTimeout(() => {
            trailingTimer.current = null;
            lastSync.current = Date.now();
            void syncInbox(reason);
          }, 2200);
        }
        return;
      }
      lastSync.current = now;
      void syncInbox(reason);
    }

    function notifyRemote() {
      // Initiator already got a local success toast — skip the echo.
      if (wasRecentLocalMutation()) return;
      const now = Date.now();
      if (now - lastToasted.current < 8000) return;
      lastToasted.current = now;
      toast.info({
        title: "Desk updated",
        description: "A case on your desk changed — list refreshed.",
      });
    }

    function handle(table: string, payload: RealtimePayload) {
      const row = (payload.new ?? payload.old ?? null) as Record<
        string,
        unknown
      > | null;
      const rowId =
        (row?.id as string | undefined) ??
        (row?.referralId as string | undefined) ??
        (row?.sessionId as string | undefined) ??
        null;
      const key = realtimeEventKey(
        table,
        payload.eventType ?? "*",
        rowId,
        payload.commit_timestamp ?? null
      );
      if (seenRealtimeEvent(key)) return;
      // Notification rows arrive EMPTY over realtime (401 on row data — the
      // anon key deliberately holds no grant), so the event itself is only a
      // wake-up call: the recipient-safe inbox sync below resolves what is
      // actually new for this nurse.
      if (table === "Notification") {
        scheduleSync("event");
        return;
      }
      invalidate();
      notifyRemote();
    }

    function reconcile() {
      // Database is the source of truth — a reconnect may have missed
      // events, so refetch unconditionally (bypasses the 2s throttle).
      lastInvalidated.current = Date.now();
      for (const key of NURSE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
      lastSync.current = Date.now();
      void syncInbox("seed");
    }

    try {
      const supabase = createClient();
      const builder = supabase
        .channel("nurse-desk")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Referral" },
          (payload) => void handle("Referral", payload as RealtimePayload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "CounselingSession" },
          (payload) => void handle("CounselingSession", payload as RealtimePayload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ClinicSessionAttachment" },
          (payload) =>
            void handle("ClinicSessionAttachment", payload as RealtimePayload)
        )
        // UNFILTERED by design: a per-user filter can never match because
        // Notification row payloads arrive empty (see header comment). The
        // INSERT event is a wake-up call; syncInbox resolves recipients
        // through the auth-gated API.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "Notification" },
          (payload) => void handle("Notification", payload as RealtimePayload)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmLearnerProfile" },
          (payload) => void handle("AdmLearnerProfile", payload as RealtimePayload)
        );
      const ch = builder.subscribe((status) => {
        // Reconcile on (re)subscribe — missed events are backfilled from DB.
        if (status === "SUBSCRIBED") void reconcile();
      });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };

      visibilityHandler = () => {
        if (document.visibilityState === "visible") void reconcile();
      };
      onlineHandler = () => void reconcile();
      document.addEventListener("visibilitychange", visibilityHandler);
      window.addEventListener("online", onlineHandler);
    } catch {
      // Realtime unavailable — freshness falls back to staleTime + the poll
      // safety net below.
    }

    // Safety net: anything realtime missed. First run only seeds the seen
    // set (no toast storm for old inbox rows).
    const timer = window.setInterval(() => scheduleSync("poll"), FALLBACK_POLL_MS);
    // Seed soon after mount so the unseen window is small even when realtime
    // connects fine (seed itself never toasts).
    const seedTimer = window.setTimeout(() => {
      lastSync.current = Date.now();
      void syncInbox("seed");
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(seedTimer);
      if (trailingTimer.current !== null) {
        window.clearTimeout(trailingTimer.current);
        trailingTimer.current = null;
      }
      try {
        if (visibilityHandler)
          document.removeEventListener("visibilitychange", visibilityHandler);
        if (onlineHandler) window.removeEventListener("online", onlineHandler);
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient, userId]);
}
