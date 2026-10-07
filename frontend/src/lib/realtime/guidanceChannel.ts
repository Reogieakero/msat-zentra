"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { guidanceNotificationTitle } from "@/lib/notifications/label";
import {
  invalidateGuidanceQueries,
  type GuidanceScope,
} from "@/app/guidance/overview/components/use-guidance-mutation";

interface GuidanceInboxRow {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt: string;
}

// Poll cadence — this is the actual delivery transport, not just a safety
// net: the browser Supabase client authenticates as anon (the app's sessions
// are backend-signed JWTs, not Supabase Auth), so row-scoped Realtime events
// never reach it even with the table published. Cheap indexed query, and
// rows already toasted are skipped through `seenIds`. Kept short so
// referred cases surface within seconds.
const FALLBACK_POLL_MS = 5_000;
const MAX_TOASTS_PER_POLL = 3;

/** Self-save suppression: saves this session already confirmed with a
 *  direct toast skip the realtime duplicate (data still invalidates, the
 *  bell row still lands). Keyed by notification sourceId. */
const selfSaved = new Map<string, number>();
const SELF_SUPPRESS_MS = 30_000;

export function markSelfNotified(sourceId: string) {
  if (!sourceId) return;
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
 * Guidance desk realtime sync — one shared Supabase channel per mount.
 * Clone of the teacher desk channel: a 5s auth-gated backend poll is the
 * working transport plus the Supabase Realtime INSERT subscription as a
 * bonus path where policies allow. Rows are deduped by id across both
 * layers, so a healthy connection never double-toasts. Table bindings give
 * instant invalidation between polls (no PHI travels over the socket —
 * Notification payloads arrive empty, so INSERTs are wake-up calls only).
 *
 * Titles come from the shared `guidanceNotificationTitle` (MESSAGE regex,
 * never type alone — every referral fanout shares type
 * `referral_status_change`), so the bell and the sileo always agree.
 */
// Type-mapped invalidation: each table wake-up (and each notification
// row) refetches only the scopes it can change. Previously every event
// refetched all sixteen prefixes — including the heatmap/anecdotal
// walks — on any single change.
function scopesForTable(table: string): GuidanceScope[] {
  switch (table) {
    case "Referral":
      return ["referrals", "alerts", "adm", "overview", "notifications"];
    case "Intervention":
      return ["interventions", "alerts", "overview", "notifications"];
    case "CounselingSession":
      return ["referrals", "interventions", "overview", "documents", "notifications"];
    case "AdmLearnerProfile":
      return ["adm", "overview", "notifications"];
    default:
      return ["notifications"];
  }
}

function scopesForRow(row: GuidanceInboxRow): GuidanceScope[] {
  const table = row.sourceTable ?? "";
  if (table === "referrals") return ["referrals", "alerts", "adm", "overview", "notifications"];
  if (table === "counseling_sessions") {
    return ["referrals", "interventions", "overview", "documents", "notifications"];
  }
  if (table === "interventions") return ["interventions", "alerts", "overview", "notifications"];
  if (table === "adm_learner_profiles") return ["adm", "overview", "notifications"];
  return ["notifications"];
}

export function useGuidanceRealtime(enabled = true) {
  const queryClient = useQueryClient();
  // Per-scope throttle: bursts invalidate once per scope per 2s (toasts
  // still fire per row), and a referral burst no longer starves an
  // intervention refresh the way a single shared timestamp did.
  const lastInvalidatedByScope = React.useRef<Map<string, number>>(new Map());
  const seenIds = React.useRef<Set<string>>(new Set());

  const invalidate = React.useCallback(
    (scopes?: GuidanceScope | GuidanceScope[]) => {
      const list: GuidanceScope[] = !scopes
        ? ["referrals", "interventions", "overview", "alerts", "adm", "anecdotal", "risk", "documents", "notifications"]
        : Array.isArray(scopes) ? scopes : [scopes];
      const now = Date.now();
      const due = list.filter((s) => {
        const last = lastInvalidatedByScope.current.get(s) ?? 0;
        if (now - last < 2000) return false;
        lastInvalidatedByScope.current.set(s, now);
        return true;
      });
      if (due.length) invalidateGuidanceQueries(queryClient, due);
    },
    [queryClient],
  );

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    // Fresh identity (or remount) → fresh seen set, so a previous
    // counselor's inbox can never suppress this counselor's first toast.
    seenIds.current = new Set();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: GuidanceInboxRow) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      // Saves this session already confirmed with a direct toast skip the
      // realtime echo toast — the bell row still lands and lists still
      // invalidate. Scoped to this session's own writes: the per-sourceId
      // entry expires after 30s, so a later genuine update on the SAME
      // referral id (different message) still toasts.
      const selfConfirmed =
        !!row.sourceId &&
        /^you\b/i.test(row.message ?? "") &&
        Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      if (!selfConfirmed) {
        toast.info({
          title: guidanceNotificationTitle({ type: row.type, message: row.message }),
          description: row.message,
        });
      }
      void invalidate(scopesForRow(row));
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel(`guidance-desk-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Notification",
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            notify((payload as unknown as { new?: GuidanceInboxRow }).new as GuidanceInboxRow);
          },
        )
        // Table events are invalidate-only wake-ups (payloads carry no
        // recipient-safe data): the poll below resolves what changed.
        // Each table maps to its affected scopes — never the whole desk.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Referral" },
          () => void invalidate(scopesForTable("Referral"))
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Intervention" },
          () => void invalidate(scopesForTable("Intervention"))
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "CounselingSession" },
          () => void invalidate(scopesForTable("CounselingSession"))
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmLearnerProfile" },
          () => void invalidate(scopesForTable("AdmLearnerProfile"))
        )
        .subscribe((status) => {
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[guidance-realtime] channel status: ${status}`);
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
        // Light poll: only the latest rows are needed to detect arrivals
        // (seenIds dedupes); the bell's own query keeps the full inbox.
        const { data } = await apiClient.get<GuidanceInboxRow[]>(
          "/api/notifications/?take=10",
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
        if (fresh.length > MAX_TOASTS_PER_POLL) void invalidate();
      } catch {
        // Offline / unauthorized — try again on the next tick.
      }
    }
    const timer = window.setInterval(poll, FALLBACK_POLL_MS);
    // Seed soon after mount so the missed-toast window is tiny (seed itself
    // never toasts).
    const seedTimer = window.setTimeout(poll, 1_000);
    // Poll the moment the tab regains focus — updates that landed while
    // away surface immediately with no manual refresh.
    const onFocus = () => {
      void poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(seedTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      try {
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient, invalidate]);
}
