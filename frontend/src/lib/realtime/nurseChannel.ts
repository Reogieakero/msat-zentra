"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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

/**
 * Nurse desk realtime sync — one shared Supabase channel per mount.
 *
 * Security model (matches backend `0001_rls.sql` + realtime-publication note):
 * the app signs its own JWTs so Supabase RLS cannot scope these tables —
 * `Notification` has NO RLS and Referral/session tables have no policies.
 * The payload is therefore NEVER rendered directly: every event only
 * triggers a refetch through the RBAC-gated backend API (`GET
 * /api/referrals/`, …), which remains the source of truth and enforces
 * nurse-scope server-side. Per-user `Notification` filtering narrows
 * delivery when the session id is known; other tables invalidate only.
 *
 * Behavior:
 * - Throttled invalidate (1 per 2s) + event-ID dedup (15s window).
 * - Toast on remote change only (initiator echo suppressed via
 *   `wasRecentLocalMutation`); throttled to 1 toast per 8s.
 * - Reconnect reconcile: on SUBSCRIBED + visibility/online restore, refetch
 *   from the database (events may have been missed).
 */
export function useNurseRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const session = useSession();
  const userId = session?.sub ?? null;
  const lastInvalidated = React.useRef(0);
  const lastToasted = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
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

    function notifyRemote(table: string) {
      // Initiator already got a local success toast — skip the echo.
      if (wasRecentLocalMutation()) return;
      const now = Date.now();
      if (now - lastToasted.current < 8000) return;
      lastToasted.current = now;
      const label =
        table === "Notification"
          ? "You have a new notification — inbox refreshed."
          : "A case on your desk changed — list refreshed.";
      toast.info({ title: "Desk updated", description: label });
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
      // Personal Notification INSERTs refresh only the bell (+ alerts, which
      // embeds the inbox summary) — never the whole desk.
      if (table === "Notification") {
        void invalidate([["nurse-notifications"], ["nurse-alerts"]]);
      } else {
        void invalidate();
      }
      notifyRemote(table);
    }

    function reconcile() {
      // Database is the source of truth — a reconnect may have missed
      // events, so refetch unconditionally (bypasses the 2s throttle).
      lastInvalidated.current = Date.now();
      for (const key of NURSE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    try {
      const supabase = createClient();
      const notificationFilter = userId ? `userId=eq.${userId}` : undefined;
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
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Notification",
            ...(notificationFilter ? { filter: notificationFilter } : {}),
          },
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
      // Realtime unavailable — freshness falls back to staleTime + invalidation.
    }

    return () => {
      cancelled = true;
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
