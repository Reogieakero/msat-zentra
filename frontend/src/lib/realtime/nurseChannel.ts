"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useSession } from "@/lib/auth/useSession";
import { nurseNotificationTitle } from "@/lib/notifications/label";

const NURSE_KEYS = [
  ["nurse-alerts"],
  ["nurse-overview"],
  ["nurse-risk"],
  ["nurse-risk-levels"],
  ["nurse-risk-factors"],
  ["nurse-notifications"],
] as const;

interface NurseNotification {
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

/**
 * Nurse desk realtime sync — one shared Supabase channel per mount.
 * Clone of the teacher desk channel: a 5s auth-gated backend poll is the
 * working transport plus the Supabase Realtime INSERT subscription as a
 * bonus path where policies allow. Rows are deduped by id across both
 * layers, so a healthy connection never double-toasts.
 *
 * Titles come from the shared `nurseNotificationTitle` (MESSAGE regex,
 * never type alone — every referral fanout shares type
 * `referral_status_change`), so the bell and the sileo always agree.
 */
export function useNurseRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const session = useSession();
  const userId = session?.sub ?? null;
  const lastInvalidated = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    if (!userId) return;
    // Fresh identity (or remount) → fresh seen set, so a previous nurse's
    // inbox can never suppress this nurse's first toast.
    seenIds.current = new Set();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: NurseNotification) {
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
          title: nurseNotificationTitle({ type: row.type, message: row.message }),
          description: row.message,
        });
      }
      void invalidate();
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
            filter: `userId=eq.${userId}`,
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
      // Realtime unavailable — the polling safety net below still delivers.
    }

    // Safety net: pick up anything Realtime missed. First poll only seeds
    // the seen set (no toast storm for old inbox rows); later polls toast
    // rows that arrived since, capped per poll.
    let seeded = false;
    async function poll() {
      if (cancelled || document.hidden) return;
      try {
        const { data } = await apiClient.get<NurseNotification[]>(
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

    function invalidate() {
      // Throttle bursts to one invalidate per 2s (toasts still fire per row).
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      for (const key of NURSE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

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
  }, [enabled, queryClient, userId]);
}
