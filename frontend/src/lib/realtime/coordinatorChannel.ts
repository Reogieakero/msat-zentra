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
 * 2. Notification INSERTs (unfiltered — a per-user filter can never match
 *    because row payloads arrive empty, see syncInbox) → an auth-gated inbox
 *    sync that writes the bell query directly and toasts precisely the rows
 *    new for this coordinator. Rows are deduped by id across Realtime and
 *    the polling safety net, so a healthy connection never double-toasts.
 *
 * No polling of case data, no whole-app refetch. Silently degrades to
 * staleTime + mutation invalidation when Supabase env is missing.
 */
export function useCoordinatorRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());
  const seeded = React.useRef(false);
  const lastSync = React.useRef(0);
  const trailingTimer = React.useRef<number | null>(null);

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

    function notify(rows: CoordinatorNotification[]) {
      if (rows.length === 0) return;
      // Oldest first so the newest toast stays on top.
      const ordered = [...rows].reverse().slice(0, MAX_TOASTS_PER_POLL);
      for (const row of ordered) {
        toast.info({
          title: toastTitleFor(row),
          description: row.message,
        });
      }
    }

    // Auth-gated inbox sync — the recipient-safe realtime path. Notification
    // row payloads arrive EMPTY over realtime (401 on row data: the anon key
    // deliberately holds no grant, so a per-user postgres_changes filter can
    // never match — verified live), so the INSERT event is only a wake-up
    // call. This fetch resolves recipients through the auth-gated API, writes
    // the inbox straight into the bell query (badge updates without a second
    // refetch), and toasts precisely the rows new for this coordinator.
    async function syncInbox(reason: "event" | "poll" | "seed") {
      if (cancelled || !userId || document.hidden) return;
      try {
        const { data } = await apiClient.get<CoordinatorNotification[]>(
          "/api/notifications/",
        );
        if (cancelled || !Array.isArray(data)) return;
        const mine = data.filter((n) => n.userId === userId);
        queryClient.setQueryData(["coordinator-notifications"], data);
        if (!seeded.current) {
          for (const n of mine) seenIds.current.add(n.id);
          seeded.current = true;
          return;
        }
        const fresh = mine.filter((n) => !seenIds.current.has(n.id));
        for (const n of mine) seenIds.current.add(n.id);
        if (fresh.length === 0) return;
        if (reason !== "seed") {
          notify(fresh);
          // Personal notifications refresh the dashboard too; table events
          // keep their own scoped keys so one toast never refetches everything.
          void invalidate([
            ["coordinator-dashboard"],
            ["coordinator-notifications"],
          ]);
        }
      } catch {
        // Offline / unauthorized — try again on the next tick.
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
      // Personal notifications: UNFILTERED by design — a per-user filter can
      // never match because Notification row payloads arrive empty (see
      // syncInbox). The INSERT event is a wake-up call; syncInbox resolves
      // recipients through the auth-gated API.
      const withNotifs = builder.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Notification" },
        () => void scheduleSync("event"),
      );
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

    // Safety net: pick up anything Realtime missed. First run only seeds
    // the seen set (no toast storm for old inbox rows).
    const timer = window.setInterval(() => scheduleSync("poll"), FALLBACK_POLL_MS);
    // Seed soon after mount so the unseen window is small even when
    // Realtime connects fine (seed itself never toasts).
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
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient]);
}
