"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { teacherNotificationTitle } from "@/lib/notifications/label";

const TEACHER_KEYS = [
  ["teacher-overview"],
  ["teacher-overview-secondary"],
  ["teacher-student-list"],
  ["adm-my-cases"],
  ["myReferrals"],
  ["referableAnecdotal"],
  ["advisory-students"],
  ["advisory-students-archived"],
  ["advisee-academic"],
  ["advisee-attendance"],
  ["anecdotal-mine"],
  ["teacher-anecdotes"],
  ["teacher-notifications"],
  ["teacher-settings-adviser-sections"],
  ["grade-flags"],
  ["teacher-schedule"],
  ["teacher-schedule-subjects"],
  ["teacher-schedule-teachers"],
  ["teacher-schedule-config"],
  ["teacher-schedule-me"],
  ["teacher-my-slots"],
  ["attendance-sheet-marks"],
  ["attendance-subject-days"],
  ["attendance-section-summary"],
  ["attendance-section-matrix"],
  ["attendance-section-roster"],
  ["offered-subjects"],
  ["teacher-grading-class"],
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

function toastTitleFor(n: TeacherNotification): string {
  return teacherNotificationTitle({
    type: n.type,
    sourceTable: n.sourceTable,
    message: n.message ?? "",
  });
}

export function useTeacherRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());
  const userId = enabled ? currentUserId() : null;

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    if (!userId) return;
    seenIds.current = new Set();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function keysForNotification(
      n: TeacherNotification,
    ): readonly (readonly string[])[] {
      const table = (n.sourceTable ?? "").toLowerCase();
      const type = (n.type ?? "").toLowerCase();
      const ATTENDANCE: readonly (readonly string[])[] = [
        ["attendance-sheet-marks"],
        ["attendance-subject-days"],
        ["attendance-section-summary"],
        ["attendance-section-matrix"],
        ["attendance-section-roster"],
        ["offered-subjects"],
        ["teacher-my-slots"],
      ];
      const GRADING: readonly (readonly string[])[] = [
        ["teacher-grading-class"],
        ["advisee-academic"],
        ["advisory-students"],
      ];
      const SCHEDULE: readonly (readonly string[])[] = [
        ["teacher-schedule"],
        ["teacher-schedule-config"],
        ["teacher-schedule-me"],
        ["teacher-my-slots"],
      ];
      const REFERRAL: readonly (readonly string[])[] = [
        ["myReferrals"],
        ["referableAnecdotal"],
        ["anecdotal-mine"],
      ];
      const ANECDOTAL: readonly (readonly string[])[] = [
        ["anecdotal-mine"],
        ["referableAnecdotal"],
      ];
      const ADVISORY: readonly (readonly string[])[] = [
        ["advisory-students"],
        ["advisee-academic"],
        ["advisee-attendance"],
        ["adm-my-cases"],
      ];
      if (table.startsWith("attendance")) return ATTENDANCE;
      if (table.startsWith("student_grade") || table.startsWith("final_grade"))
        return GRADING;
      if (table.startsWith("section_timetable") || table.startsWith("teacher_"))
        return SCHEDULE;
      if (table.startsWith("referral")) return REFERRAL;
      if (table.startsWith("anecdotal")) return ANECDOTAL;
      if (table.startsWith("student_roster") || table.startsWith("intervention"))
        return ADVISORY;
      if (type.includes("grade-flag") || type.includes("grade_flag"))
        return [["grade-flags"]];
      return [];
    }

    function notify(row: TeacherNotification) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      const msg = row.message ?? "";
      const isOwnEcho =
        /^you\b/i.test(msg) ||
        /your referral to the .* was submitted|your cancelled referral .*was re-submitted/i.test(
          msg,
        );
      const selfConfirmed =
        isOwnEcho &&
        !!row.sourceId &&
        Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      if (!selfConfirmed) {
        toast.info({
          title: toastTitleFor(row),
          description: row.message,
        });
      }
      void invalidate(row);
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
          if (!cancelled && status !== "SUBSCRIBED") {
            console.warn(`[teacher-realtime] channel status: ${status}`);
          }
        });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
    }

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
        const ordered = [...fresh].reverse().slice(0, MAX_TOASTS_PER_POLL);
        for (const n of ordered) notify(n);
        for (const n of fresh) seenIds.current.add(n.id);
        if (fresh.length > MAX_TOASTS_PER_POLL) void invalidate(fresh);
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

    function invalidate(
      rowOrRows?: TeacherNotification | TeacherNotification[],
    ) {
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      const rows = Array.isArray(rowOrRows)
        ? rowOrRows
        : rowOrRows
          ? [rowOrRows]
          : [];
      const scoped = new Map<string, readonly string[]>();
      for (const row of rows) {
        for (const key of keysForNotification(row)) {
          scoped.set(key.join("\u0000"), key);
        }
      }
      const targets =
        scoped.size > 0 ? [...scoped.values()] : [...TEACHER_KEYS];
      for (const key of targets) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
      void queryClient.invalidateQueries({
        queryKey: ["teacher-notifications"],
      });
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
  }, [enabled, queryClient, userId]);
}
