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

/** Shape of a `Referral` realtime row the nurse desk can receive. RLS only
 *  publishes referrals addressed to the nurse role, picked as its consult
 *  reviewer, filed by them, or advised by them — so a referral "landing" here
 *  is a case on this desk. */
interface NurseReferralRow {
  id?: string;
  referredBy?: string | null;
  referredToRole?: string | null;
  consultReviewer?: string | null;
  status?: string | null;
}

/** True when the row is a case on this clinic desk. `consultReviewer` holds a
 *  *role* ("nurse"), and legacy rows may hold a user id, so both are accepted. */
function isOnNurseDesk(row: NurseReferralRow, userId: string): boolean {
  return (
    row.referredToRole === "nurse" ||
    row.consultReviewer === "nurse" ||
    row.consultReviewer === userId
  );
}

/**
 * Whether a realtime `old` payload carries more than the primary key. The
 * table uses the default replica identity, so an UPDATE's `old` is just
 * `{ id }` — comparing that against `new` would read as "not on the desk" and
 * ring for every unrelated edit (a booked session, a note).
 */
function hasRowFields(row: NurseReferralRow | undefined): boolean {
  return (
    !!row &&
    (row.referredToRole !== undefined ||
      row.consultReviewer !== undefined ||
      row.status !== undefined)
  );
}

/** True when an update *moved* the case onto this desk (only knowable when the
 *  old payload carries the routing fields). */
function referralMovedToNurseDesk(
  next: NurseReferralRow,
  prev: NurseReferralRow,
  userId: string,
): boolean {
  if (!isOnNurseDesk(next, userId)) return false;
  return !isOnNurseDesk(prev, userId);
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
  // Referral ids whose withdrawal already rang, so later edits to the same
  // dismissed row don't replay the cancelled clip.
  const cancelledSeen = React.useRef<Set<string>>(new Set());

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
      if (due.length) {
        // The nurse rail's "new or updated" dots read `/api/nurse/nav-counts`;
        // any frame the desk receives may have moved a queue, so refresh it in
        // the same tick as the page data instead of waiting for the 5s poll.
        void queryClient.invalidateQueries({ queryKey: ["nurse-nav-counts"] });
        invalidateNurseQueries(queryClient, due);
      }
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
        .on(
          "postgres_changes",
          // The referral row itself — the same signal the notification carries,
          // so a case that lands on (or is withdrawn from) the clinic rings even
          // when the fanout notification is delayed or lost.
          { event: "*", schema: "public", table: "Referral" },
          (payload) => {
            const p = payload as unknown as {
              eventType?: string;
              new?: NurseReferralRow;
              old?: NurseReferralRow;
            };
            const next = p.new;
            const prev = hasRowFields(p.old) ? (p.old as NurseReferralRow) : null;
            if (next && next.id) {
              const selfEcho =
                Date.now() - (selfSaved.get(next.id) ?? 0) < SELF_SUPPRESS_MS;
              if (!selfEcho) {
                if (next.status === "dismissed") {
                  // The filing teacher withdrew the case: the same
                  // `/sounds/cancelled referral.mp3` the guidance desk rings.
                  // Once per dismissal — later edits of the closed row stay
                  // silent, and a re-opened case re-arms.
                  if (!cancelledSeen.current.has(next.id)) {
                    cancelledSeen.current.add(next.id);
                    playDeskSound("cancelled");
                  }
                } else {
                  cancelledSeen.current.delete(next.id);
                  const landed =
                    p.eventType === "INSERT" ||
                    (prev ? referralMovedToNurseDesk(next, prev, userId) : false);
                  if (
                    landed &&
                    isOnNurseDesk(next, userId) &&
                    next.referredBy !== userId
                  ) {
                    playDeskSound("referral");
                  }
                }
              }
            }
            void invalidate(["alerts", "overview", "risk", "notifications"]);
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
