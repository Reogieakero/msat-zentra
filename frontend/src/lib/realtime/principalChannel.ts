"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";

// Targeted invalidation map: notification type/source → exact query keys.
// Never a 7-key blast, and never the ["academic-insights"] prefix (live and
// honor-roll are distinct keys so one never kills the other).
const KEY_FOR_SOURCE: Record<string, string[][]> = {
  schedule_submitted: [["principal-schedule-sections"], ["principal-schedule-config"]],
  schedule_approved: [["principal-schedule-sections"], ["principal-schedule-config"]],
  schedule_rejected: [["principal-schedule-sections"], ["principal-schedule-config"]],
  referral_status_change: [["adm-dashboard"]],
  new_adm_case: [["adm-dashboard"]],
  device_issued: [["adm-dashboard"]],
  grade_lock: [["academic-insights", "live"], ["academic-insights", "honor-roll-live"], ["academics"]],
  grade_unlock: [["academic-insights", "live"], ["academic-insights", "honor-roll-live"], ["academics"]],
  intervention_approval: [["interventions-list"]],
  attendance: [["attendance-section-averages"], ["attendance-needs-attention"]],
};
const ALWAYS_KEYS: string[][] = [["principal-notifications"]];

interface PrincipalNotification {
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
// rows already toasted are skipped through `seenIds`. 15s (was 5s) —
// focused polling is per-page (academics: none, attendance: 60s) so the
// shell poll doesn't need to be aggressive.
const FALLBACK_POLL_MS = 15_000;
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

function toastTitleFor(n: PrincipalNotification): string {
  if (/withdrawn/i.test(n.message)) return "Referral withdrawn by teacher";
  if (/re-submitted/i.test(n.message)) return "Referral re-submitted";
  if (n.type === "referral_status_change") return "New referral";
  if (n.type === "schedule_submitted") return "Schedule sent for review";
  if (n.type === "schedule_approved") return "Schedule approved";
  if (n.type === "schedule_rejected") return "Schedule sent back";
  if (n.type === "device_issued") return "Device issued";
  return "New notification";
}

/**
 * Principal desk realtime sync — one shared Supabase channel per mount.
 * Listens for INSERTs on the Notification table scoped to the signed-in
 * principal and pops a sileo toast on whatever page they are on (e.g. the
 * moment a master teacher sends slots for review), plus refreshes the bell
 * and the approval queue so nothing needs a page refresh.
 *
 * Delivery is two-layer: a 5s backend poll (the working transport — the
 * anon Supabase client never receives row-scoped Realtime events for
 * backend-signed sessions) plus the Supabase Realtime subscription as a
 * bonus path where policies allow. Rows are deduped by id across both
 * layers, so a healthy connection never double-toasts.
 */
export function usePrincipalRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());
  const realtimeOk = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: PrincipalNotification) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      toast.info({
        title: toastTitleFor(row),
        description: row.message,
      });
      void invalidate(row);
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel(`principal-desk-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Notification",
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            notify((payload as unknown as { new?: PrincipalNotification }).new as PrincipalNotification);
          },
        )
        .subscribe((status) => {
          realtimeOk.current = status === "SUBSCRIBED";
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[principal-realtime] channel status: ${status}`);
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
        const { data } = await apiClient.get<PrincipalNotification[]>(
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
    // Poll the moment the tab regains focus — submissions that landed while
    // away surface immediately with no manual refresh.
    const onFocus = () => {
      void poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    function invalidate(row?: PrincipalNotification) {
      // Throttle bursts to one invalidate per 2s (toasts still fire per row).
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      // Targeted: resolve keys from the notification type; fall back to the
      // bell only when the type is unknown (never a full-desk blast).
      const extra = row ? (KEY_FOR_SOURCE[row.type] ?? []) : [];
      // Attendance-sourced rows without a typed key still refresh attendance.
      const keys = [...ALWAYS_KEYS, ...extra];
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
      if (row && extra.length === 0 && row.type !== "referral_status_change") {
        // Unknown type: bell already refreshed above; nothing else to do.
      }
      if (!row) {
        // Overflow path (capped toasts): refresh bell only; lists revalidate
        // on their own stale timers.
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
  }, [enabled, queryClient]);
}
