"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { markRealtimeUpdate } from "@/lib/api/fresh";
import { toast } from "@/components/ui/sonner";
import {
  isIncomingReferral,
  isReferralCancelled,
  playDeskSound,
  primeDeskSounds,
} from "@/lib/notify/deskSounds";
import { useDeskCatchUp } from "@/lib/notify/deskCatchUp";

const KEY_FOR_SOURCE: Record<string, string[][]> = {
  schedule_submitted: [["principal-schedule-sections"], ["principal-schedule-config"]],
  schedule_approved: [["principal-schedule-sections"], ["principal-schedule-config"]],
  schedule_rejected: [["principal-schedule-sections"], ["principal-schedule-config"]],
  referral_status_change: [["adm-dashboard"]],
  new_adm_case: [["adm-dashboard"]],
  device_issued: [["adm-dashboard"]],
  grade_lock: [["academic-insights", "live"], ["academic-insights", "honor-roll-live"], ["academics"]],
  grade_unlock: [["academic-insights", "live"], ["academic-insights", "honor-roll-live"], ["academics"]],
  intervention_approved: [["interventions-list"], ["principal-notifications"]],
  intervention_detected: [["interventions-list"]],
  intervention_assigned: [["interventions-list"]],
  intervention_session: [["interventions-list"]],
  intervention_outcome: [["interventions-list"]],
  intervention_alert: [["interventions-list"]],
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

const FALLBACK_POLL_MS = 5_000;
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
  const deskUserId = enabled ? currentUserId() : null;

  // Login catch-up: referrals that landed while the principal was signed out
  // ring once on arrival instead of rejoining the backlog in silence.
  useDeskCatchUp({
    role: "principal",
    userId: deskUserId,
    enabled,
    title: "New referrals on the principal desk",
    clipFor: (row) =>
      isReferralCancelled(row) ? "cancelled" : isIncomingReferral(row) ? "referral" : null,
  });

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    primeDeskSounds(["referral", "cancelled"]);
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: PrincipalNotification, { silent = false } = {}) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      if (isReferralCancelled(row)) playDeskSound("cancelled");
      else if (isIncomingReferral(row)) playDeskSound("referral");
      if (!silent) {
        toast.info({
          title: toastTitleFor(row),
          description: row.message,
        });
      }
      void invalidate(row);
    }

    // Guidance creating a plan, booking a session, or closing a case changes
    // the principal's intervention cohort. The page's live poll is the safety
    // net; these subscriptions make the board update instantly.
    let lastDeskInvalidated = 0;
    function touchInterventionDesk() {
      const now = Date.now();
      if (now - lastDeskInvalidated < 2_000) return;
      lastDeskInvalidated = now;
      void queryClient.invalidateQueries({ queryKey: ["interventions-list"] });
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
            // No `filter`: Supabase Realtime cannot filter on the camelCase
            // "userId" column (it lowercases it, the binding is rejected and
            // takes the whole channel's CDC stream down). Notification is RLS-
            // scoped to the caller's rows; `notify()` drops other users' rows.
          },
          (payload) => {
            notify((payload as unknown as { new?: PrincipalNotification }).new as PrincipalNotification);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Intervention" },
          () => touchInterventionDesk(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "CounselingSession" },
          () => touchInterventionDesk(),
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
      // Runs while hidden too: a fanout notification must still land (and toast
      // on return) when the desk is in another tab or another site. This is the
      // fallback for a socket that is down or blocked by RLS.
      if (cancelled) return;
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

    function invalidate(row?: PrincipalNotification) {
      markRealtimeUpdate();
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
