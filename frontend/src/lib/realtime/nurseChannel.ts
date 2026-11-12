"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { markRealtimeUpdate } from "@/lib/api/fresh";
import { toast } from "@/components/ui/sonner";
import { useSession } from "@/lib/auth/useSession";
import { nurseNotificationTitle } from "@/lib/notifications/label";
import {
  isIncomingReferral,
  isReferralCancelled,
  playDeskSound,
  primeDeskSounds,
} from "@/lib/notify/deskSounds";
import { useDeskCatchUp } from "@/lib/notify/deskCatchUp";
import {
  invalidateNurseQueries,
  type NurseScope,
} from "@/app/nurse/overview/components/use-nurse-mutation";

interface NurseNotification {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt?: string;
}

const FALLBACK_POLL_MS = 5_000;
const MAX_TOASTS_PER_POLL = 3;

const selfSaved = new Map<string, number>();
const SELF_SUPPRESS_MS = 30_000;

export function markSelfNotified(sourceId: string) {
  if (!sourceId) return;
  selfSaved.set(sourceId, Date.now());
}

function scopesFor(row: NurseNotification): NurseScope[] {
  const table = row.sourceTable ?? "";
  if (table === "referrals" || table === "counseling_sessions") {
    return ["alerts", "overview", "risk", "notifications"];
  }
  return ["notifications"];
}

export function useNurseRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const session = useSession();
  const userId = session?.sub ?? null;
  const lastInvalidatedByScope = React.useRef<Map<string, number>>(new Map());
  const seenIds = React.useRef<Set<string>>(new Set());

  // Login catch-up: referrals that landed while the nurse was signed out ring
  // once on arrival instead of rejoining the backlog in silence.
  useDeskCatchUp({
    role: "nurse",
    userId,
    enabled,
    title: "New clinic referrals",
    clipFor: (row) =>
      isReferralCancelled(row) ? "cancelled" : isIncomingReferral(row) ? "referral" : null,
  });

  const invalidate = React.useCallback(
    (scopes?: NurseScope | NurseScope[]) => {
      markRealtimeUpdate();
      const list: NurseScope[] = !scopes
        ? (["alerts", "overview", "risk", "notifications"] as NurseScope[])
        : Array.isArray(scopes) ? scopes : [scopes];
      const now = Date.now();
      const due = list.filter((s) => {
        const last = lastInvalidatedByScope.current.get(s) ?? 0;
        if (now - last < 2000) return false;
        lastInvalidatedByScope.current.set(s, now);
        return true;
      });
      if (due.length) invalidateNurseQueries(queryClient, due);
    },
    [queryClient],
  );

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    if (!userId) return;
    seenIds.current = new Set();
    // Loads this desk's clip now so the first arrival can ring.
    primeDeskSounds(["referral", "cancelled"]);
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: NurseNotification, { silent = false } = {}) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      const selfConfirmed =
        !!row.sourceId &&
        /^you\b/i.test(row.message ?? "") &&
        Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      if (selfConfirmed) {
        // Our own action: the flow that performed it already applied the
        // change to the cache (optimistic patch or its own invalidation).
        // Toasting or refetching here is the redundant refresh noise.
        return;
      }
      // A referral landed on (or was withdrawn from) the clinic desk.
      if (isReferralCancelled(row)) playDeskSound("cancelled");
      else if (isIncomingReferral(row)) playDeskSound("referral");
      if (!silent) {
        toast.info({
          title: nurseNotificationTitle({ type: row.type, message: row.message }),
          description: row.message,
        });
      }
      void invalidate(scopesFor(row));
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel(`nurse-desk-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Notification",
            // No `filter`: Supabase Realtime cannot filter on the camelCase
            // "userId" column (it lowercases it, the binding is rejected and
            // takes the whole channel's CDC stream down). Notification is RLS-
            // scoped to the caller's rows; `notify()` drops other users' rows.
          },
          (payload) => {
            notify((payload as unknown as { new?: NurseNotification }).new as NurseNotification);
          },
        )
        .subscribe((status) => {
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[nurse-realtime] channel status: ${status}`);
          }
        });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
    }

    let seeded = false;
    async function poll() {
      // Runs while hidden too: a fanout notification must still land (and toast
      // on return) when the desk is in another tab or another site. This is the
      // fallback for a socket that is down or blocked by RLS.
      if (cancelled) return;
      try {
        const { data } = await apiClient.get<NurseNotification[]>(
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
        const ordered = [...fresh].reverse();
        // Only the newest few toast; the overflow still routes through
        // `notify()` silently, because that is what rings the referral /
        // cancelled clip — a burst used to be dropped by the toast cap.
        ordered.slice(0, MAX_TOASTS_PER_POLL).forEach((n) => notify(n));
        ordered.slice(MAX_TOASTS_PER_POLL).forEach((n) => notify(n, { silent: true }));
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
  }, [enabled, queryClient, userId, invalidate]);
}
