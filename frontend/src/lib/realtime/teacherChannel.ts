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
  // Scheduling workspace — each key listed explicitly (TanStack matches
  // query keys element-wise, so ["teacher-schedule"] alone would NOT cover
  // the catalog/config keys). Keeps the grid, catalogs, and linked states
  // live on verdicts and code claims with no manual refresh.
  ["teacher-schedule"],
  ["teacher-schedule-subjects"],
  ["teacher-schedule-teachers"],
  ["teacher-schedule-config"],
  ["teacher-schedule-me"],
  ["teacher-my-slots"],
  // Attendance taking — marks, offered subjects, rosters, and linked slots
  // repaint on every related event with no manual refresh.
  ["attendance-sheet-marks"],
  ["attendance-subject-days"],
  ["attendance-section-summary"],
  ["attendance-section-matrix"],
  ["attendance-section-roster"],
  ["offered-subjects"],
  // Gradebook workspace — saved scores repaint live on every related event.
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

// Poll cadence — this is the actual delivery transport, not just a safety
// net: the browser Supabase client authenticates as anon (the app's sessions
// are backend-signed JWTs, not Supabase Auth), so row-scoped Realtime events
// never reach it even with the table published. Cheap indexed query, and
// rows already toasted are skipped through `seenIds`. Kept short so
// principal verdicts surface within seconds.
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
  // Shared with the bell inbox titles — one mapper so sileo and inbox name
  // the event identically. Titles derive from MESSAGE text, never the type
  // alone (every referral fanout shares referral_status_change).
  return teacherNotificationTitle({
    type: n.type,
    sourceTable: n.sourceTable,
    message: n.message ?? "",
  });
}

/**
 * Teacher/adviser desk realtime sync — one shared Supabase channel per
 * mount. Listens for INSERTs on the Notification table scoped to the
 * signed-in adviser and pops a sileo toast on whatever page they are on
 * (e.g. the moment the ADM coordinator books a parent meeting), plus
 * invalidates the teacher query prefixes so lists refresh.
 *
 * Delivery is two-layer: a 5s backend poll (the working transport — the
 * anon Supabase client never receives row-scoped Realtime events for
 * backend-signed sessions) plus the Supabase Realtime subscription as a
 * bonus path where policies allow. Rows are deduped by id across both
 * layers, so a healthy connection never double-toasts.
 */
export function useTeacherRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());
  const userId = enabled ? currentUserId() : null;

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    if (!userId) return;
    // Fresh identity (or remount) → fresh seen set, so a previous teacher's
    // inbox can never suppress this teacher's first toast.
    seenIds.current = new Set();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    /** Map a notification to the minimal affected query prefixes — one
     *  attendance event must NOT refetch the schedule board or gradebook. */
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
      // Unknown event — fall back to the bell badge only, never a full storm.
      return [];
    }

    function notify(row: TeacherNotification) {
      if (!row || row.userId !== userId || seenIds.current.has(row.id)) return;
      seenIds.current.add(row.id);
      // Saves this session already confirmed with a direct toast skip the
      // realtime echo toast — the bell row still lands and lists still
      // invalidate. Keyed by notification sourceId with a 30s window: later
      // genuine updates on the SAME id (different message, no fresh mark)
      // still toast, otherwise a fast clinic accept within 30s of submit
      // would be swallowed.
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
        if (fresh.length > MAX_TOASTS_PER_POLL) void invalidate(fresh);
      } catch {
        // Offline / unauthorized — try again on the next tick.
      }
    }
    const timer = window.setInterval(poll, FALLBACK_POLL_MS);
    // Seed soon after mount so the missed-toast window is tiny (seed itself
    // never toasts).
    const seedTimer = window.setTimeout(poll, 1_000);
    // Poll the moment the tab regains focus — verdicts that landed while
    // away surface immediately with no manual refresh.
    const onFocus = () => {
      void poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    function invalidate(
      rowOrRows?: TeacherNotification | TeacherNotification[],
    ) {
      // Throttle bursts to one invalidate per 2s (toasts still fire per row).
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
      // The bell badge always bumps so new inbox rows surface.
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
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient, userId]);
}
