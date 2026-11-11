"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { markRealtimeUpdate } from "@/lib/api/fresh";
import { toast } from "@/components/ui/sonner";
import { teacherNotificationTitle } from "@/lib/notifications/label";
import {
  isSelfNotification,
  keysForScopes,
  scopesForNotification,
  scopesForRealtimeTable,
  type TeacherInvalidateScope,
} from "@/lib/realtime/teacherKeys";

interface TeacherNotification {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt?: string;
}

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
// With authenticated push enabled the HTTP poll is a safety net only, so it
// backs off from 5s to 60s. Without push (or without Supabase env) the poll is
// the delivery mechanism and stays fast.
const PUSH_ENABLED =
  process.env.NEXT_PUBLIC_SUPABASE_REALTIME_AUTH === "true" &&
  SUPABASE_CONFIGURED;
const FALLBACK_POLL_MS = PUSH_ENABLED ? 60_000 : 5_000;
const MAX_TOASTS_PER_POLL = 3;
const SCOPE_THROTTLE_MS = 2_000;

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

function toastTitleFor(n: TeacherNotification): string {
  return teacherNotificationTitle({
    type: n.type,
    sourceTable: n.sourceTable,
    message: n.message ?? "",
  });
}

export function useTeacherRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidatedByScope = React.useRef<Map<string, number>>(new Map());
  const seenIds = React.useRef<Set<string>>(new Set());
  const userId = enabled ? currentUserId() : null;

  React.useEffect(() => {
    if (!enabled) return;
    if (!userId) return;
    seenIds.current = new Set();
    lastInvalidatedByScope.current = new Map();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function invalidate(scopes: readonly TeacherInvalidateScope[]) {
      markRealtimeUpdate();
      const now = Date.now();
      const due = scopes.filter((scope) => {
        const last = lastInvalidatedByScope.current.get(scope) ?? 0;
        if (now - last < SCOPE_THROTTLE_MS) return false;
        lastInvalidatedByScope.current.set(scope, now);
        return true;
      });
      if (due.length === 0) return;
      for (const key of keysForScopes(due)) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    function notify(row: TeacherNotification, { silent = false } = {}) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      const msg = row.message ?? "";
      const isOwnEcho =
        /^you\b/i.test(msg) ||
        /your referral to the .* was submitted|your cancelled referral .*was re-submitted/i.test(
          msg,
        );
      const selfMarked =
        !!row.sourceId &&
        Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      // `*_self` types are deterministic server labels for the user's own
      // action (the mutation already showed its own toast). Text matching stays
      // only for echo rows that lack a dedicated self type.
      const suppressToast =
        silent || isSelfNotification(row) || (isOwnEcho && selfMarked);
      if (!suppressToast) {
        toast.info({
          title: toastTitleFor(row),
          description: msg,
        });
      }
      invalidate([...scopesForNotification(row), "notifications"]);
    }

    // Realtime needs Supabase env; the HTTP fallback poll below runs
    // regardless so the bell still updates live without it.
    if (PUSH_ENABLED) {
      try {
        const supabase = createClient();
        // Direct table subscriptions: some desks mirror rows that other people
        // write without emitting a teacher notification (a risk snapshot that
        // adds a "no plan yet" card, a plan updated by its assignee). RLS
        // (0001_rls.sql) scopes each stream to the adviser's own section.
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
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Intervention" },
            () => invalidate(scopesForRealtimeTable("Intervention")),
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "CounselingSession" },
            () => invalidate(scopesForRealtimeTable("CounselingSession")),
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "RiskSnapshot" },
            () => invalidate(scopesForRealtimeTable("RiskSnapshot")),
          )
          .subscribe((status) => {
            if (!cancelled && status !== "SUBSCRIBED") {
              console.warn(`[teacher-realtime] channel status: ${status}`);
            }
          });
        if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
      } catch {
      }
    }

    let seeded = false;
    async function poll() {
      // Runs while hidden too: a fanout notification must still land (and toast
      // on return) when the desk is in another tab or another site. This is the
      // fallback for a socket that is down or blocked by RLS.
      if (cancelled) return;
      try {
        const { data } = await apiClient.get<TeacherNotification[]>(
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
        if (fresh.length > MAX_TOASTS_PER_POLL) {
          // Burst: one summary toast, then refresh everything the burst
          // touched (and the bell) instead of spamming toasts.
          const scopes = new Set<TeacherInvalidateScope>(["notifications"]);
          for (const n of fresh) {
            seenIds.current.add(n.id);
            for (const s of scopesForNotification(n)) scopes.add(s);
          }
          toast.info({
            title: `${fresh.length} new updates`,
            description: "Open the notifications bell to review them.",
          });
          invalidate([...scopes]);
          return;
        }
        const ordered = [...fresh].reverse();
        for (const n of ordered) notify(n);
      } catch {
      }
    }
    const timer = window.setInterval(poll, FALLBACK_POLL_MS);
    const seedTimer = window.setTimeout(poll, 1_000);
    const onFocus = () => {
      // Coming back online/into the tab should not wait out the throttle.
      lastInvalidatedByScope.current.clear();
      void poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(seedTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
      try {
        channel?.unsubscribe();
      } catch {
      }
    };
  }, [enabled, queryClient, userId]);
}
