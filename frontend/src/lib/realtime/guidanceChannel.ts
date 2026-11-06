"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { guidanceNotificationTitle } from "@/lib/notifications/label";
import {
  invalidateGuidanceQueries,
  type GuidanceScope,
} from "@/app/guidance/overview/components/use-guidance-mutation";

interface GuidanceInboxRow {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt: string;
}

const FALLBACK_POLL_MS = 5_000;
const MAX_TOASTS_PER_POLL = 3;

const selfSaved = new Map<string, number>();
const SELF_SUPPRESS_MS = 30_000;

export function markSelfNotified(sourceId: string) {
  if (!sourceId) return;
  selfSaved.set(sourceId, Date.now());
}

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

function scopesForTable(table: string): GuidanceScope[] {
  switch (table) {
    case "Referral":
      return ["referrals", "alerts", "adm", "overview", "notifications"];
    case "Intervention":
      return ["interventions", "alerts", "overview", "notifications"];
    case "CounselingSession":
      return ["referrals", "interventions", "overview", "documents", "notifications"];
    case "AdmLearnerProfile":
      return ["adm", "overview", "notifications"];
    default:
      return ["notifications"];
  }
}

function scopesForRow(row: GuidanceInboxRow): GuidanceScope[] {
  const table = row.sourceTable ?? "";
  if (table === "referrals") return ["referrals", "alerts", "adm", "overview", "notifications"];
  if (table === "counseling_sessions") {
    return ["referrals", "interventions", "overview", "documents", "notifications"];
  }
  if (table === "interventions") return ["interventions", "alerts", "overview", "notifications"];
  if (table === "adm_learner_profiles") return ["adm", "overview", "notifications"];
  return ["notifications"];
}

export function useGuidanceRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidatedByScope = React.useRef<Map<string, number>>(new Map());
  const seenIds = React.useRef<Set<string>>(new Set());

  const invalidate = React.useCallback(
    (scopes?: GuidanceScope | GuidanceScope[]) => {
      const list: GuidanceScope[] = !scopes
        ? ["referrals", "interventions", "overview", "alerts", "adm", "anecdotal", "risk", "documents", "notifications"]
        : Array.isArray(scopes) ? scopes : [scopes];
      const now = Date.now();
      const due = list.filter((s) => {
        const last = lastInvalidatedByScope.current.get(s) ?? 0;
        if (now - last < 2000) return false;
        lastInvalidatedByScope.current.set(s, now);
        return true;
      });
      if (due.length) invalidateGuidanceQueries(queryClient, due);
    },
    [queryClient],
  );

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    seenIds.current = new Set();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: GuidanceInboxRow) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      const selfConfirmed =
        !!row.sourceId &&
        /^you\b/i.test(row.message ?? "") &&
        Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      if (!selfConfirmed) {
        toast.info({
          title: guidanceNotificationTitle({ type: row.type, message: row.message }),
          description: row.message,
        });
      }
      void invalidate(scopesForRow(row));
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel(`guidance-desk-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Notification",
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            notify((payload as unknown as { new?: GuidanceInboxRow }).new as GuidanceInboxRow);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Referral" },
          () => void invalidate(scopesForTable("Referral"))
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Intervention" },
          () => void invalidate(scopesForTable("Intervention"))
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "CounselingSession" },
          () => void invalidate(scopesForTable("CounselingSession"))
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmLearnerProfile" },
          () => void invalidate(scopesForTable("AdmLearnerProfile"))
        )
        .subscribe((status) => {
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[guidance-realtime] channel status: ${status}`);
          }
        });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
    }

    let seeded = false;
    async function poll() {
      if (cancelled || document.hidden) return;
      try {
        const { data } = await apiClient.get<GuidanceInboxRow[]>(
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
  }, [enabled, queryClient, invalidate]);
}
