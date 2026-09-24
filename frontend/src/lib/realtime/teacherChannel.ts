"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";

const TEACHER_KEYS = [
  ["teacher-overview"],
  ["adm-my-cases"],
  ["myReferrals"],
  ["referableAnecdotal"],
  ["advisory-students"],
  ["anecdotal-mine"],
] as const;

interface TeacherNotification {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt?: string;
}

// Safety-net poll cadence: only fires when Realtime hasn't delivered (e.g.
// table missing from the realtime publication). Cheap indexed query, and
// rows already toasted via Realtime are skipped through `seenIds`.
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

function toastTitleFor(n: TeacherNotification): string {
  if (n.sourceTable === "adm_devices") {
    return "Device update";
  }
  if (n.sourceTable === "adm_parent_meetings") {
    if (n.type === "generic_adm_parent_meetings_outcome")
      return "Meeting outcome recorded";
    return "Parent meeting booked";
  }
  if (n.type === "referral_status_change") return "Referral update";
  if (n.type === "new_followup") return "New follow-up";
  return "New notification";
}

/**
 * Teacher/adviser desk realtime sync — one shared Supabase channel per
 * mount. Listens for INSERTs on the Notification table scoped to the
 * signed-in adviser and pops a sileo toast on whatever page they are on
 * (e.g. the moment the ADM coordinator books a parent meeting), plus
 * invalidates the teacher query prefixes so lists refresh.
 *
 * Delivery is two-layer: Supabase Realtime first, plus a 30s polling
 * safety net that toasts anything Realtime failed to deliver (previously a
 * missing realtime publication meant adviser toasts never arrived at all).
 * Rows are deduped by id across both layers, so a healthy connection never
 * double-toasts.
 */
export function useTeacherRealtime(enabled = true) {
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

    function notify(row: TeacherNotification) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      toast.info({
        title: toastTitleFor(row),
        description: row.message,
      });
      void invalidate();
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel(`teacher-desk-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Notification",
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            notify((payload as unknown as { new?: TeacherNotification }).new as TeacherNotification);
          },
        )
        .subscribe((status) => {
          realtimeOk.current = status === "SUBSCRIBED";
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[teacher-realtime] channel status: ${status}`);
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
        const { data } = await apiClient.get<TeacherNotification[]>(
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

    function invalidate() {
      // Throttle bursts to one invalidate per 2s (toasts still fire per row).
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      for (const key of TEACHER_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

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
