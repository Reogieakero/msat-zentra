"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { markRealtimeUpdate } from "@/lib/api/fresh";
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

const FALLBACK_POLL_MS = 5_000;
const MAX_TOASTS_PER_POLL = 3;

/**
 * Fired when a guidance-visible case changes (new at-risk detection, new or
 * updated referral, intervention/session/ADM movement). The shell's risk alert
 * monitor hooks into this to ring immediately — including while the tab is in
 * the background, because realtime WebSocket frames are not throttled like
 * timers are.
 */
export const GUIDANCE_RISK_ALERT_EVENT = "zentra:guidance-risk-alert";

/**
 * Source tables whose inbound rows are worth an audible alert. Everything else
 * (academics/schedule/SF10 housekeeping) only refreshes caches — ringing for it
 * would make the sound meaningless.
 */
const ALERTING_SOURCES = new Set([
  "referrals",
  "interventions",
  "counseling_sessions",
  "session_attachments",
  "adm_learner_profiles",
  "adm_parent_meetings",
  "adm_devices",
  "anecdotal_record_followups",
]);

/** "you did X" echoes of the counselor's own actions never ring. */
function isSelfEcho(row: { type: string; message: string }): boolean {
  return /_self$/.test(row.type) || /^you\b/i.test(row.message ?? "");
}

const selfSaved = new Map<string, number>();
const SELF_SUPPRESS_MS = 30_000;

export function markSelfNotified(sourceId: string) {
  if (!sourceId) return;
  selfSaved.set(sourceId, Date.now());
}

/** True while a change to this case is an echo of the counselor's own action. */
export function isSelfNotified(sourceId: string): boolean {
  return Date.now() - (selfSaved.get(sourceId) ?? 0) < SELF_SUPPRESS_MS;
}

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

function scopesForTable(table: string): GuidanceScope[] {
  switch (table) {
    case "Referral":
      return ["referrals", "alerts", "adm", "overview", "notifications"];
    case "Intervention":
      return ["interventions", "alerts", "overview", "notifications"];
    case "CounselingSession":
      return ["referrals", "interventions", "overview", "documents", "notifications"];
    case "AdmLearnerProfile":
      return ["adm", "alerts", "overview", "notifications"];
    case "RiskSnapshot":
      // New engine snapshot = the learner's flags just changed. The board and
      // the alert counters must re-read; the sound follows the counter.
      return ["interventions", "alerts", "risk", "overview", "notifications"];
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
  if (table === "adm_learner_profiles") return ["adm", "alerts", "overview", "notifications"];
  return ["notifications"];
}

export function useGuidanceRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidatedByScope = React.useRef<Map<string, number>>(new Map());
  const suppressedScopes = React.useRef<Set<string>>(new Set());
  const trailingTimer = React.useRef<number | null>(null);
  const seenIds = React.useRef<Set<string>>(new Set());

  const invalidate = React.useCallback(
    (scopes?: GuidanceScope | GuidanceScope[]) => {
      // Everything invalidated from here is realtime-driven: the data changed
      // this instant, so any refetch must not read the (possibly pre-write)
      // API cache entry. Opens the `x-zentra-fresh` window.
      markRealtimeUpdate();
      // The sidebar badges read the same queues, and every desk event can move
      // one (referral, intervention, session, ADM). Refresh them directly so a
      // badge can never wait for its 15s poll just because a scope map forgot
      // `notifications`.
      void queryClient.invalidateQueries({ queryKey: ["guidance-nav-counts"] });
      const list: GuidanceScope[] = !scopes
        ? ["referrals", "interventions", "overview", "alerts", "adm", "anecdotal", "risk", "documents", "notifications"]
        : Array.isArray(scopes) ? scopes : [scopes];
      const now = Date.now();
      const due: GuidanceScope[] = [];
      const suppressed: GuidanceScope[] = [];
      for (const s of list) {
        const last = lastInvalidatedByScope.current.get(s) ?? 0;
        if (now - last < 2000) {
          suppressed.push(s);
          continue;
        }
        lastInvalidatedByScope.current.set(s, now);
        due.push(s);
      }
      if (due.length) invalidateGuidanceQueries(queryClient, due);
      // Never drop a realtime change: a burst that lands inside the throttle
      // window is replayed once the window closes instead of being swallowed
      // until the board's next poll (which would leave the UI behind the sound).
      if (suppressed.length) {
        for (const s of suppressed) suppressedScopes.current.add(s);
        if (trailingTimer.current === null) {
          trailingTimer.current = window.setTimeout(() => {
            trailingTimer.current = null;
            const pending = [...suppressedScopes.current] as GuidanceScope[];
            suppressedScopes.current.clear();
            for (const s of pending) lastInvalidatedByScope.current.set(s, Date.now());
            if (pending.length) invalidateGuidanceQueries(queryClient, pending);
          }, 2_500);
        }
      }
    },
    [queryClient],
  );

  React.useEffect(
    () => () => {
      if (trailingTimer.current !== null) {
        window.clearTimeout(trailingTimer.current);
        trailingTimer.current = null;
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    seenIds.current = new Set();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: GuidanceInboxRow) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
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
      // Case updates ring even when the toast is suppressed by seen-id /
      // self-confirmation logic, and even when this tab is not the active one.
      const rings =
        row.type === "intervention_detected" ||
        (!isSelfEcho(row) && ALERTING_SOURCES.has(row.sourceTable ?? ""));
      if (rings) {
        try {
          window.dispatchEvent(
            new CustomEvent(GUIDANCE_RISK_ALERT_EVENT, { detail: row }),
          );
        } catch {
          /* CustomEvent unavailable — the count poll still rings. */
        }
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
            // No `filter`. Supabase Realtime cannot filter on a camelCase
            // column ("userId"): it lowercases the identifier, fails with
            // "invalid column for filter userId", and that rejected binding
            // takes the whole channel's CDC stream down with it — which is why
            // no Referral/Intervention/RiskSnapshot event ever reached this
            // desk and the boards only moved on their poll. Notification is
            // RLS-scoped to the caller's own rows (`notification_own`), so the
            // filter was redundant for privacy; `notify()` still drops rows
            // that belong to another user.
          },
          (payload) => {
            notify((payload as unknown as { new?: GuidanceInboxRow }).new as GuidanceInboxRow);
          },
        )
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
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "RiskSnapshot" },
          () => {
            // Detection signal for the shell's risk sound: re-read the live
            // counters immediately, bypassing the scope throttle so a busy
            // sweep can never swallow the alert.
            markRealtimeUpdate();
            void queryClient.invalidateQueries({
              queryKey: ["guidance-alerts", "count"],
            });
            void invalidate(scopesForTable("RiskSnapshot"));
          }
        )
        .subscribe((status) => {
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(
              `[guidance-realtime] channel status: ${status}. If this stays ` +
                `CHANNEL_ERROR, check that NEXT_PUBLIC_SUPABASE_REALTIME_AUTH=true, ` +
                `that the Supabase project JWT secret matches JWT_ACCESS_SECRET, and ` +
                `that prisma/apply-rls.ts has been run (realtime needs the ` +
                `authenticated grants + RLS policies).`,
            );
          }
        });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
    }

    let seeded = false;
    async function poll() {
      // Runs while hidden too: if authenticated realtime is unavailable (JWT
      // mismatch / RLS not applied) this 5s poll is the only thing that still
      // surfaces a guidance notification.
      if (cancelled) return;
      try {
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
        const ordered = [...fresh].reverse().slice(0, MAX_TOASTS_PER_POLL);
        for (const n of ordered) notify(n);
        for (const n of fresh) seenIds.current.add(n.id);
        if (fresh.length > MAX_TOASTS_PER_POLL) void invalidate();
      } catch {
      }
    }
    const timer = window.setInterval(poll, FALLBACK_POLL_MS);
    const seedTimer = window.setTimeout(poll, 1_000);
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
      }
    };
  }, [enabled, queryClient, invalidate]);
}
