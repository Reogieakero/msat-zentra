"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useSession } from "@/lib/auth/useSession";
import { nurseNotificationTitle } from "@/lib/notifications/label";
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

  const invalidate = React.useCallback(
    (scopes?: NurseScope | NurseScope[]) => {
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
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: NurseNotification) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
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
    }

    let seeded = false;
    async function poll() {
      if (cancelled || document.hidden) return;
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
  }, [enabled, queryClient, userId, invalidate]);
}
