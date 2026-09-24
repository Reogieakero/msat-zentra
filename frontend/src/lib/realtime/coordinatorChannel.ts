"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";

const COORDINATOR_KEYS = [
  ["coordinator-dashboard"],
  ["coordinator-referrals"],
  ["coordinator-enrolled"],
  ["coordinator-certifications"],
  ["coordinator-approvals"],
  ["coordinator-devices"],
  ["coordinator-notifications"],
] as const;

type CoordinatorKey = readonly [string];

/* Table-scoped invalidation — a device write refreshes only the ledger +
   dashboard instead of refetching every queue on the desk. Payloads stay
   invalidate-only (no row data in realtime traffic). */
const TABLE_KEYS: Record<string, readonly CoordinatorKey[]> = {
  AdmLearnerProfile: [
    ["coordinator-dashboard"],
    ["coordinator-referrals"],
    ["coordinator-enrolled"],
    ["coordinator-certifications"],
    ["coordinator-approvals"],
  ],
  Referral: [
    ["coordinator-dashboard"],
    ["coordinator-referrals"],
    ["coordinator-enrolled"],
    ["coordinator-certifications"],
  ],
  AdmDevice: [["coordinator-dashboard"], ["coordinator-devices"]],
  AdmForm: [
    ["coordinator-referrals"],
    ["coordinator-certifications"],
    ["coordinator-dashboard"],
  ],
  AdmModule: [["coordinator-dashboard"], ["coordinator-referrals"]],
  AdmParentMeeting: [
    ["coordinator-referrals"],
    ["coordinator-certifications"],
    ["coordinator-dashboard"],
  ],
};

interface CoordinatorNotification {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt?: string;
}

// Safety-net poll cadence: only toasts what Realtime missed (e.g. table
// missing from the realtime publication). Rows already toasted via Realtime
// are skipped through `seenIds`. Mirrors useTeacherRealtime.
const FALLBACK_POLL_MS = 30_000;
const MAX_TOASTS_PER_POLL = 3;

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

function toastTitleFor(n: CoordinatorNotification): string {
  if (n.sourceTable === "adm_devices") {
    return "Device update";
  }
  if (n.sourceTable === "adm_parent_meetings") {
    return "Parent meeting update";
  }
  if (/new .*referral submitted/i.test(n.message)) {
    return "New ADM referral submitted";
  }
  if (/returned .*revision/i.test(n.message)) {
    return "Case returned for revision";
  }
  if (n.type === "referral_status_change") return "Referral update";
  return "New notification";
}

/**
 * Coordinator desk realtime sync — one shared Supabase channel per mount.
 * Two layers on the same channel:
 *
 * 1. Table events (AdmLearnerProfile, Referral, AdmForm, AdmDevice,
 *    AdmModule, AdmParentMeeting) → throttled invalidation of the
 *    Coordinator query prefixes. No toast — the lists just refresh.
 * 2. Personal Notification INSERTs (`userId = me`, e.g. an adviser filing
 *    a new ADM referral or the Principal returning a case) → a sileo toast
 *    plus invalidation. Rows are deduped by id across Realtime and the
 *    polling safety net, so a healthy connection never double-toasts, and
 *    the actor never echoes their own action (fanout excludes the actor).
 *
 * No polling of case data, no whole-app refetch. Silently degrades to
 * staleTime + mutation invalidation when Supabase env is missing.
 */
export function useCoordinatorRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function invalidate(keys: readonly CoordinatorKey[] = COORDINATOR_KEYS) {
      // Throttle bursts (e.g. multi-row writes) to one invalidate per 2s.
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    function notify(row: CoordinatorNotification) {
      if (!userId || !row || row.userId !== userId) return;
      if (seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      toast.info({
        title: toastTitleFor(row),
        description: row.message,
      });
      // Personal notifications refresh the bell + dashboard; table events
      // keep their own scoped keys so one toast never refetches everything.
      void invalidate([
        ["coordinator-dashboard"],
        ["coordinator-notifications"],
      ]);
    }

    try {
      const supabase = createClient();
      const builder = supabase
        .channel("coordinator-desk")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmLearnerProfile" },
          () => void invalidate(TABLE_KEYS.AdmLearnerProfile)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Referral" },
          () => void invalidate(TABLE_KEYS.Referral)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmForm" },
          () => void invalidate(TABLE_KEYS.AdmForm)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmDevice" },
          () => void invalidate(TABLE_KEYS.AdmDevice)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmModule" },
          () => void invalidate(TABLE_KEYS.AdmModule)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmParentMeeting" },
          () => void invalidate(TABLE_KEYS.AdmParentMeeting)
        );
      // Personal notifications only when the signed-in user is known.
      const withNotifs = userId
        ? builder.on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "Notification",
              filter: `userId=eq.${userId}`,
            },
            (payload) => {
              notify(
                (payload as unknown as { new?: CoordinatorNotification })
                  .new as CoordinatorNotification,
              );
            },
          )
        : builder;
      // Reconnect reconcile: the database stays the source of truth —
      // a fresh SUBSCRIBED after a drop re-syncs every prefix once so
      // missed events can't leave the desk stale.
      let wasSubscribed = false;
      const ch = withNotifs.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          if (wasSubscribed) {
            lastInvalidated.current = 0;
            void invalidate();
          }
          wasSubscribed = true;
          return;
        }
        console.warn(`[coordinator-realtime] channel status: ${status}`);
      });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
      // Realtime unavailable — freshness falls back to staleTime +
      // invalidation, and the polling safety net below still delivers toasts.
    }

    // Safety net: pick up anything Realtime missed. First poll only seeds
    // the seen set (no toast storm for old inbox rows); later polls toast
    // rows that arrived since, capped per poll.
    let seeded = false;
    async function poll() {
      if (cancelled || !userId || document.hidden) return;
      try {
        const { data } = await apiClient.get<CoordinatorNotification[]>(
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
        if (fresh.length > MAX_TOASTS_PER_POLL) void invalidate();
      } catch {
        // Offline / unauthorized — try again on the next tick.
      }
    }
    const timer = window.setInterval(poll, FALLBACK_POLL_MS);
    // Seed soon after mount so the fallback window is small even when
    // Realtime connects fine (seed itself never toasts).
    const seedTimer = window.setTimeout(poll, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(seedTimer);
      try {
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient]);
}
