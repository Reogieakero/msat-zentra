"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { markRealtimeUpdate } from "@/lib/api/fresh";
import { toast } from "@/components/ui/sonner";
import { recordKeeperNotificationTitle } from "@/lib/notifications/label";

const RECORD_KEEPER_KEYS = [
  ["record-keeper-overview"],
  ["record-keeper-final-grades"],
  ["record-keeper-pending-students"],
  ["record-keeper-account-breakdown"],
  ["record-keeper-accounts-audit"],
  ["record-keeper-sf10"],
  ["record-keeper-adviser-access"],
  ["record-keeper-subjects"],
  ["record-keeper-notifications"],
] as const;

type KeyTuple = readonly [string, ...string[]];

function keysForNotification(
  row: Pick<RecordKeeperNotification, "sourceTable" | "type">,
): KeyTuple[] {
  const bell: KeyTuple = ["record-keeper-notifications"];
  switch (row.sourceTable) {
    case "users":
      return [
        ["record-keeper-pending-students"],
        ["record-keeper-account-breakdown"],
        ["record-keeper-overview"],
        bell,
      ];
    case "final_grades":
      return [["record-keeper-final-grades"], ["record-keeper-overview"], bell];
    case "adviser_sf10_access_requests":
      return [["record-keeper-adviser-access"], ["record-keeper-overview"], bell];
    case "sf10_records":
      return [["record-keeper-sf10"], ["record-keeper-overview"], bell];
    case "subjects":
    case "sections":
    case "teacher_subject_assignments":
      return [
        ["record-keeper-overview"],
        ["record-keeper-account-breakdown"],
        ["record-keeper-subjects"],
        bell,
      ];
    default:
      return [...RECORD_KEEPER_KEYS];
  }
}

interface RecordKeeperNotification {
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

export function useRecordKeeperRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const pendingRows = React.useRef<RecordKeeperNotification[]>([]);
  const trailingTimer = React.useRef<number | null>(null);
  const seenIds = React.useRef<Set<string>>(new Set());
  const realtimeOk = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function notify(row: RecordKeeperNotification, { silent = false } = {}) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);

      const selfConfirmed =
        !!row.sourceId && Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      if (!selfConfirmed && !silent) {
        toast.info({
          title: recordKeeperNotificationTitle({
            type: row.type,
            sourceTable: row.sourceTable,
            message: row.message,
          }),
          description: row.message,
        });
      }
      void invalidate([row]);
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel(`record-keeper-desk-${userId}`)
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
            notify((payload as unknown as { new?: RecordKeeperNotification }).new as RecordKeeperNotification);
          },
        )
        .subscribe((status) => {
          realtimeOk.current = status === "SUBSCRIBED";
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[record-keeper-realtime] channel status: ${status}`);
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
        const { data } = await apiClient.get<RecordKeeperNotification[]>(
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
        void invalidate(fresh);
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

    function invalidate(rows?: RecordKeeperNotification[]) {
      markRealtimeUpdate();
      const now = Date.now();
      if (rows) {
        for (const row of rows) pendingRows.current.push(row);
      }
      if (now - lastInvalidated.current < 2000) {
        if (pendingRows.current.length > 0 && !trailingTimer.current) {
          trailingTimer.current = window.setTimeout(() => {
            trailingTimer.current = null;
            if (cancelled) return;
            lastInvalidated.current = Date.now();
            flushPending();
          }, 2000 - (now - lastInvalidated.current));
        }
        return;
      }
      lastInvalidated.current = now;
      flushPending();
    }

    function flushPending() {
      const queued = [...pendingRows.current];
      pendingRows.current = [];
      const keys = new Map<string, KeyTuple>();
      for (const row of queued) {
        for (const key of keysForNotification(row)) keys.set(key.join("|"), key);
      }

      const targets = keys.size > 0 ? [...keys.values()] : [...RECORD_KEEPER_KEYS];
      for (const key of targets) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(seedTimer);
      if (trailingTimer.current) window.clearTimeout(trailingTimer.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      try {
        channel?.unsubscribe();
      } catch {

      }
    };
  }, [enabled, queryClient]);
}
