"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";

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

const FALLBACK_POLL_MS = 15_000;
const MAX_TOASTS_PER_POLL = 3;

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
    }

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

    function invalidate(row?: PrincipalNotification) {
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      const extra = row ? (KEY_FOR_SOURCE[row.type] ?? []) : [];
      const keys = [...ALWAYS_KEYS, ...extra];
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
      if (row && extra.length === 0 && row.type !== "referral_status_change") {
      }
      if (!row) {
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
      }
    };
  }, [enabled, queryClient]);
}
