"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";

const TEACHER_KEYS = [
  ["teacher-overview"],
  ["teacher-overview-secondary"],
  ["adm-my-cases"],
  ["myReferrals"],
  ["referableAnecdotal"],
  ["advisory-students"],
  ["anecdotal-mine"],
  ["teacher-notifications"],
  // Scheduling workspace — each key listed explicitly (TanStack matches
  // query keys element-wise, so ["teacher-schedule"] alone would NOT cover
  // the catalog/config keys). Keeps the grid, catalogs, and linked states
  // live on verdicts and code claims with no manual refresh.
  ["teacher-schedule"],
  ["teacher-schedule-subjects"],
  ["teacher-schedule-teachers"],
  ["teacher-schedule-config"],
  // Attendance taking — marks, offered subjects, rosters, and linked slots
  // repaint on every related event with no manual refresh.
  ["attendance-sheet-marks"],
  ["attendance-subject-days"],
  ["attendance-section-summary"],
  ["attendance-section-matrix"],
  ["teacher-anecdotes"],
  ["offered-subjects"],
  ["advisory-students"],
  ["attendance-section-roster"],
  ["teacher-my-slots"],
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
  if (n.sourceTable === "adm_devices") {
    return "Device update";
  }
  if (n.sourceTable === "adm_parent_meetings") {
    if (n.type === "generic_adm_parent_meetings_outcome")
      return "Meeting outcome recorded";
    // Invited to the meeting by the coordinator (not the filer path).
    if (/invited you to a parent meeting/i.test(n.message ?? ""))
      return "Parent meeting invitation";
    return "Parent meeting booked";
  }
  // Referral toasts match backend `message` text — every referral fanout
  // shares type `referral_status_change` (see notify.ts TYPE_MAP), so the
  // title must be derived from the message, never the type. Strings below
  // mirror referrals.routes.ts adviser fanouts verbatim.
  if (n.sourceTable === "referrals" || n.type === "referral_status_change") {
    const msg = n.message ?? "";
    if (/clinic accepted your referral/i.test(msg)) return "Clinic accepted your referral";
    if (/clinic booked a session/i.test(msg)) return "Clinic session booked";
    if (/clinic completed a session/i.test(msg)) return "Clinic session completed";
    if (/clinic rescheduled a session/i.test(msg)) return "Clinic session rescheduled";
    if (/clinic cancelled a session/i.test(msg)) return "Clinic session cancelled";
    if (/clinic resolved your referral/i.test(msg)) return "Clinic resolved your referral";
    if (/clinic requested more info/i.test(msg)) return "Clinic requested more info";
    if (/clinic set a follow-up/i.test(msg)) return "Clinic follow-up set";
    if (/clinic completed the referral form/i.test(msg)) return "Clinic completed referral form";
    if (/clinic started handling/i.test(msg)) return "Clinic started handling";
    if (/was closed/i.test(msg)) return "Clinic referral closed";
    if (/escalated to the clinic/i.test(msg)) return "Referral escalated to clinic";
    if (/escalated to ADM/i.test(msg)) return "Referral escalated to ADM";
    if (/was escalated/i.test(msg)) return "Referral escalated";
    if (/reassigned to the clinic/i.test(msg)) return "Referral reassigned to clinic";
    if (/was reassigned/i.test(msg)) return "Referral reassigned";
    if (/follow-up was set/i.test(msg)) return "Follow-up set";
    if (/was dismissed/i.test(msg)) return "Referral dismissed";
    if (/more info was requested/i.test(msg)) return "Info requested";
    if (/is now in progress/i.test(msg)) return "Referral in progress";
    if (/was marked resolved/i.test(msg)) return "Referral resolved";
    if (/pending review again/i.test(msg)) return "Referral pending";
    if (/guidance resolved your referral/i.test(msg)) return "Guidance resolved";
    if (/adm consultation endorsed/i.test(msg)) return "Sent to ADM coordinator";
    if (/forwarded to the coordinator/i.test(msg)) return "Sent to ADM coordinator";
    if (/not endorsed — case closed/i.test(msg)) return "ADM referral closed";
    if (/guidance accepted your referral/i.test(msg)) return "Guidance accepted your referral";
    if (/guidance booked a session/i.test(msg)) return "Guidance session booked";
    if (/guidance completed a session/i.test(msg)) return "Guidance session completed";
    if (/guidance rescheduled/i.test(msg)) return "Guidance session rescheduled";
    if (/guidance cancelled/i.test(msg)) return "Guidance session cancelled";
    if (/guidance resolved your referral/i.test(msg)) return "Guidance resolved your referral";
    if (/sent to ADM/i.test(msg)) return "Sent to ADM";
    if (/sent to the clinic/i.test(msg)) return "Sent to clinic";
    if (/re-submitted/i.test(msg)) return "Referral re-submitted";
    if (/withdrew a referral|you withdrew/i.test(msg)) return "Referral withdrawn";
    return "Referral update";
  }
  if (n.type === "new_followup") return "New follow-up";
  // Engine detection rows for the section adviser — same row lands in the
  // bell inbox + badge via the poll below (never toast-only).
  if (n.type === "intervention_detected") {
    if (/flagged Moderate risk/i.test(n.message ?? "")) return "Advisee flagged Moderate risk";
    return "Advisee flagged High risk";
  }
  // Intervention session events fanned out to the case owner
  // (interventions.routes.ts session endpoints). Matched before any
  // generic "guidance …" patterns so they never read as referral sessions.
  if (n.sourceTable === "interventions") {
    const msg = n.message ?? "";
    if (/booked an intervention session/i.test(msg)) return "Intervention session booked";
    if (/completed an intervention session/i.test(msg)) return "Intervention session completed";
    if (/rescheduled an intervention session/i.test(msg)) return "Intervention session rescheduled";
    if (/cancelled an intervention session/i.test(msg)) return "Intervention session cancelled";
    if (/opened a follow-up for/i.test(msg)) return "Follow-up opened";
    if (/recorded an outcome for/i.test(msg)) return "Follow-up outcome recorded";
    if (/the intervention plan for/i.test(msg)) return "Intervention plan reviewed";
  }
  // Backend derives these types from sourceTable+action (see notify.ts
  // TYPE_MAP): section_timetable_entries:approve → schedule_approved, etc.
  if (n.sourceTable === "section_timetable_entries") {
    if (n.type === "schedule_approved") return "Schedule approved";
    if (n.type === "schedule_rejected") return "Schedule sent back";
    return "Schedule update";
  }
  if (n.sourceTable === "teacher_names") {
    if (n.type === "teacher_code_claimed") return "Teacher code linked";
    if (n.type === "teacher_code_released") return "Teacher code unlinked";
    if (n.type === "attendance_unlocked") return "Attendance unlocked";
    return "Teacher list update";
  }
  if (n.sourceTable === "attendance_records") {
    if (n.type === "attendance_submitted") return "Attendance submitted";
    return "Attendance update";
  }
  if (n.sourceTable === "student_grades") {
    return "Scores saved";
  }
  return "New notification";
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
      // Saves this session already confirmed with a direct toast (grade
      // saves, own referral submits) skip the realtime echo toast — the
      // bell row still lands and lists still invalidate. Scoped to the
      // filing confirmation itself: later clinic/nurse updates on the SAME
      // referral id must still toast (different message), otherwise a fast
      // nurse accept within 30s of submit would be swallowed.
      const isOwnFilingEcho =
        /your referral to the .* was submitted|your cancelled referral .*was re-submitted|you withdrew a referral/i.test(
          row.message ?? "",
        );
      const selfConfirmed =
        (row.sourceTable === "student_grades" ||
          (row.sourceTable === "referrals" && isOwnFilingEcho)) &&
        !!row.sourceId &&
        Date.now() - (selfSaved.get(row.sourceId) ?? 0) < SELF_SUPPRESS_MS;
      if (!selfConfirmed) {
        toast.info({
          title: toastTitleFor(row),
          description: row.message,
        });
      }
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
