"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { markRealtimeUpdate } from "@/lib/api/fresh";
import { toast } from "@/components/ui/sonner";
import { teacherNotificationTitle } from "@/lib/notifications/label";
import {
  isAdviserAdmBooked,
  isAdviserAdmBookedClinic,
  isAdviserAdmEndorsedClinic,
  isAdviserAdmRejected,
  isAdviserAdmRejectedClinic,
  isAdviserAdmRescheduled,
  isAdviserAdmRescheduledClinic,
  isAdviserCounselingBooked,
  isAdviserCounselingRejected,
  isAdviserCounselingRescheduled,
  isAdviserClinicBooked,
  isAdviserClinicRejected,
  isAdviserClinicRescheduled,
  isAdviserReferralClosed,
  isAdviserReferralEndorsed,
  isAdviserReferralSessionBooked,
  isAdviserReferralSessionCancelled,
  isAdviserReferralSessionRescheduled,
  isAdviserSessionBooked,
  isAdviserSessionCancelled,
  isAdviserSessionRescheduled,
} from "@/lib/notify/deskSounds";
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

/**
 * Fired when one of the signed-in adviser's own advisees is detected at risk.
 * `AdviserRiskAlertMonitor` treats it as a **board refetch hint** — the sound
 * itself is decided by diffing the adviser's interventions board, so a learner
 * rings once per detection and never again for a later card/session/outcome
 * update.
 *
 * Dispatched from the **realtime frames** (`RiskSnapshot` INSERT and
 * `Intervention` writes), not from the notification fanout: the fanout is only
 * the no-Supabase fallback (see `PUSH_ENABLED`) plus the login catch-up. A
 * `postgres_changes` frame is not throttled like a timer, so the board re-reads
 * while the tab is hidden or parked on another site.
 */
export const ADVISER_RISK_ALERT_EVENT = "zentra:adviser-risk-alert";

/**
 * Fired when guidance books an intervention session for one of the signed-in
 * adviser's own advisees. `AdviserRiskAlertMonitor` plays
 * `/sounds/intervention session alert booked.mp3` for it.
 *
 * Dispatched from the **`CounselingSession` realtime frame** (INSERT of a
 * `scheduled` row), not from the notification fanout: the clip must land even
 * if the notification row is late, throttled at the bell, or never fanned out.
 * RLS (`counseling_session_visible` in `0001_rls.sql`) already scopes the
 * stream to the adviser's own section, so anything that arrives here belongs to
 * one of their advisees. The notification path is only the no-Supabase fallback
 * (see `PUSH_ENABLED`) and the login catch-up.
 */
export const ADVISER_SESSION_ALERT_EVENT = "zentra:adviser-session-alert";

/**
 * Fired when guidance moves an intervention session for one of the signed-in
 * adviser's own advisees (`AdviserRiskAlertMonitor` plays the reschedule clip).
 * Same source as the booking event: an UPDATE of a `scheduled` session.
 */
export const ADVISER_SESSION_RESCHED_EVENT = "zentra:adviser-session-resched";

/**
 * Fired when guidance cancels an intervention session for one of the signed-in
 * adviser's own advisees (`AdviserRiskAlertMonitor` plays the cancellation clip).
 * Same source as the reschedule event: an UPDATE of a `scheduled` session whose
 * new status is `cancelled`.
 */
export const ADVISER_SESSION_CANCELLED_EVENT = "zentra:adviser-session-cancelled";

/**
 * Fired when guidance endorsed the ADM consultation on a referral the teacher
 * filed (the referral form was created/confirmed, case moves forward to the
 * coordinator). The monitor plays `/sounds/guidance create referral.mp3`.
 *
 * Referral status rows are delivered as notifications (the `Notification`
 * realtime stream), so this event is dispatched from the notification handler —
 * a referral session booking cannot ride `CounselingSession` because RLS only
 * publishes intervention sessions to the adviser.
 */
export const ADVISER_REFERRAL_UPDATE_EVENT = "zentra:adviser-referral-update";

/**
 * Fired when guidance rejected/closed a referral the teacher filed (ADM
 * consultation not endorsed, or a desk dismissed the case). The monitor plays
 * the cancelled-referral clip.
 */
export const ADVISER_REFERRAL_CLOSED_EVENT = "zentra:adviser-referral-closed";

/**
 * Fired when guidance rejected/dismissed an **ADM** referral the teacher filed.
 * The monitor plays `/sounds/guidance adm reject.mp3` — a distinct clip from the
 * generic cancelled-referral one, so the adviser hears that the ADM case was
 * rejected rather than withdrawn.
 */
export const ADVISER_ADM_REJECTED_EVENT = "zentra:adviser-adm-rejected";

/**
 * Fired when guidance booked a session on the **ADM** case the teacher filed
 * (booked without deciding yet). The monitor plays
 * `/sounds/guidance adm booked session.mp3` — adviser-only; the guidance desk
 * stays silent — instead of the generic session-booked one.
 */
export const ADVISER_ADM_BOOKED_EVENT = "zentra:adviser-adm-booked";

/**
 * Fired when guidance moved the session on the **ADM** case the teacher filed.
 * The monitor plays `/sounds/guidance adm reschedule.mp3` — adviser-only; the
 * guidance desk stays silent — instead of the generic session-reschedule clip.
 */
export const ADVISER_ADM_RESCHEDULED_EVENT = "zentra:adviser-adm-rescheduled";

/**
 * Fired when guidance booked, moved or rejected a **counseling** referral the
 * teacher filed. Each action has its own adviser-only clip
 * (`/sounds/guidance counseling session.mp3`,
 * `/sounds/guidance counseling reschedule.mp3`,
 * `/sounds/guidance counseling reject.mp3`), mirroring the ADM desk events.
 */
export const ADVISER_COUNSELING_BOOKED_EVENT = "zentra:adviser-counseling-booked";
export const ADVISER_COUNSELING_RESCHEDULED_EVENT = "zentra:adviser-counseling-rescheduled";
export const ADVISER_COUNSELING_REJECTED_EVENT = "zentra:adviser-counseling-rejected";

/**
 * Fired when the **clinic** (nurse) booked, moved or rejected a clinic referral
 * the teacher filed. Same one-clip-per-action rule as the counseling set, but
 * with the nurse clips (`/sounds/nurse_clinic_session.mp3`,
 * `/sounds/nurse_clinic_reschedule.mp3`, `/sounds/nurse_clinic_reject.mp3`).
 */
export const ADVISER_CLINIC_BOOKED_EVENT = "zentra:adviser-clinic-booked";
export const ADVISER_CLINIC_RESCHEDULED_EVENT = "zentra:adviser-clinic-rescheduled";
export const ADVISER_CLINIC_REJECTED_EVENT = "zentra:adviser-clinic-rejected";

function ringAdviserSession() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_SESSION_ALERT_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up/board poll still lands. */
  }
}

function ringAdviserSessionResched() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_SESSION_RESCHED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up/board poll still lands. */
  }
}

function ringAdviserSessionCancelled() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_SESSION_CANCELLED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up/board poll still lands. */
  }
}

function ringAdviserReferralUpdate(clinic = false) {
  try {
    window.dispatchEvent(
      new CustomEvent(ADVISER_REFERRAL_UPDATE_EVENT, { detail: { clinic } }),
    );
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserReferralClosed() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_REFERRAL_CLOSED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserAdmRejected(clinic = false) {
  try {
    window.dispatchEvent(
      new CustomEvent(ADVISER_ADM_REJECTED_EVENT, { detail: { clinic } }),
    );
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserAdmBooked(clinic = false) {
  try {
    window.dispatchEvent(
      new CustomEvent(ADVISER_ADM_BOOKED_EVENT, { detail: { clinic } }),
    );
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserAdmRescheduled(clinic = false) {
  try {
    window.dispatchEvent(
      new CustomEvent(ADVISER_ADM_RESCHEDULED_EVENT, { detail: { clinic } }),
    );
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}


function ringAdviserCounselingBooked() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_COUNSELING_BOOKED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserCounselingRescheduled() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_COUNSELING_RESCHEDULED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserCounselingRejected() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_COUNSELING_REJECTED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserClinicBooked() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_CLINIC_BOOKED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserClinicRescheduled() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_CLINIC_RESCHEDULED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserClinicRejected() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_CLINIC_REJECTED_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's catch-up still lands. */
  }
}

function ringAdviserRisk() {
  try {
    window.dispatchEvent(new CustomEvent(ADVISER_RISK_ALERT_EVENT));
  } catch {
    /* CustomEvent unavailable — the monitor's board poll still sees it. */
  }
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
      // The adviser rail's "new or updated" dots read `/api/teacher/nav-counts`;
      // any frame the desk receives may have moved a queue, so refresh it in
      // the same tick as the page data instead of waiting for the 5s poll.
      void queryClient.invalidateQueries({ queryKey: ["teacher-nav-counts"] });
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
      // An advisee was flagged at risk. Live playback rides the realtime
      // frames below (`RiskSnapshot` / `Intervention`) — the notification is
      // only the delivery path when Supabase realtime is off. It is never the
      // trigger for the sound while push is available, so a late/duplicated
      // fanout can't make the alert depend on notification delivery.
      // Own-action echoes are excluded (a teacher cannot detect their advisee).
      if (
        !PUSH_ENABLED &&
        (row.type ?? "").toLowerCase() === "intervention_detected" &&
        !isSelfNotification(row) &&
        !isOwnEcho
      ) {
        ringAdviserRisk();
      }
      // Guidance just booked an intervention session for one of this adviser's
      // advisees — ring the dedicated "session booked" clip.
      // Live playback comes from the `CounselingSession` frame below; the
      // notification is only the delivery path when Supabase realtime is off.
      if (!PUSH_ENABLED && isAdviserSessionBooked(row) && !isSelfNotification(row)) {
        ringAdviserSession();
      }
      // Guidance moved an intervention session — distinct clip so the adviser
      // knows the plan changed rather than hearing the new-booking sound.
      if (!PUSH_ENABLED && isAdviserSessionRescheduled(row) && !isSelfNotification(row)) {
        ringAdviserSessionResched();
      }
      // Guidance cancelled an intervention session the adviser already had on
      // their board — its own clip, so a dropped slot never sounds like a new
      // booking.
      if (!PUSH_ENABLED && isAdviserSessionCancelled(row) && !isSelfNotification(row)) {
        ringAdviserSessionCancelled();
      }
      // Referral pipeline the teacher filed: guidance/nurse decisions further
      // down the line (ADM review, dismissals, session booking/move/drop).
      // Referral sessions are not published to the adviser over realtime
      // (`counseling_session_visible` is intervention-scoped), so this
      // notification is the adviser's only path to the session clips here.
      if (!isSelfNotification(row)) {
        if (isAdviserClinicBooked(row)) ringAdviserClinicBooked();
        else if (isAdviserCounselingBooked(row)) ringAdviserCounselingBooked();
        else if (isAdviserAdmBookedClinic(row)) ringAdviserAdmBooked(true);
        else if (isAdviserAdmBooked(row)) ringAdviserAdmBooked();
        else if (isAdviserReferralSessionBooked(row)) ringAdviserSession();
        if (isAdviserClinicRescheduled(row)) ringAdviserClinicRescheduled();
        else if (isAdviserCounselingRescheduled(row)) ringAdviserCounselingRescheduled();
        else if (isAdviserAdmRescheduledClinic(row)) ringAdviserAdmRescheduled(true);
        else if (isAdviserAdmRescheduled(row)) ringAdviserAdmRescheduled();
        else if (isAdviserReferralSessionRescheduled(row)) ringAdviserSessionResched();
        if (isAdviserReferralSessionCancelled(row)) ringAdviserSessionCancelled();
        if (isAdviserAdmEndorsedClinic(row)) ringAdviserReferralUpdate(true);
        else if (isAdviserReferralEndorsed(row)) ringAdviserReferralUpdate();
        if (isAdviserClinicRejected(row)) ringAdviserClinicRejected();
        else if (isAdviserCounselingRejected(row)) ringAdviserCounselingRejected();
        else if (isAdviserAdmRejectedClinic(row)) ringAdviserAdmRejected(true);
        else if (isAdviserAdmRejected(row)) ringAdviserAdmRejected();
        else if (isAdviserReferralClosed(row)) ringAdviserReferralClosed();
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
        // adds a "no plan yet" card, a plan updated by its assignee, a referral
        // the receiving desk moved on). RLS (0001_rls.sql) scopes each stream
        // to the adviser's own section / the filer's own referrals.
        const ch = supabase
          .channel(`teacher-desk-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "Notification",
              // No `filter`: Supabase Realtime cannot filter on the camelCase
              // "userId" column — it lowercases the identifier, the binding is
              // rejected with "invalid column for filter userId", and that
              // rejected binding takes the whole channel's CDC stream down
              // (so Referral / Intervention / RiskSnapshot frames never arrived
              // either, and the adviser risk alert stayed silent). Notification
              // is RLS-scoped to the caller's rows (`notification_own`) and
              // `notify()` still drops rows that belong to another user.
            },
            (payload) => {
              notify((payload as unknown as { new?: TeacherNotification }).new as TeacherNotification);
            },
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Referral" },
            () => invalidate(scopesForRealtimeTable("Referral")),
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Intervention" },
            () => {
              // The plan itself moved (auto-opened by the risk engine, or opened
              // / approved / reassigned by guidance). Refresh the adviser's board
              // right away — the diff decides whether this is a learner who has
              // not rung yet; an update to an already-alerted card stays silent.
              // RLS (`intervention_visible`) scopes the stream to the adviser's
              // own section, so a frame here always belongs to an advisee.
              ringAdviserRisk();
              invalidate(scopesForRealtimeTable("Intervention"));
            },
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "CounselingSession" },
            (payload) => {
              // Session sounds are driven by the row itself, not the fanout
              // notification (which can be late, throttled, or skipped when the
              // counselor's own write path only emits a `_self` echo):
              //   INSERT status=scheduled → guidance just booked → booked clip
              //   UPDATE status=scheduled → guidance moved it → reschedule clip
              //   UPDATE status=cancelled → guidance dropped it → cancelled clip
              //   UPDATE completed → finishing work, no clip
              // RLS (`counseling_session_visible`) scopes this stream to the
              // adviser's own section, so a frame here is always their advisee.
              const change = payload as unknown as {
                eventType?: string;
                new?: { status?: unknown };
              };
              const status = change.new?.status;
              if (status === "scheduled") {
                if (change.eventType === "INSERT") ringAdviserSession();
                else if (change.eventType === "UPDATE") ringAdviserSessionResched();
              } else if (status === "cancelled" && change.eventType === "UPDATE") {
                ringAdviserSessionCancelled();
              }
              void invalidate(scopesForRealtimeTable("CounselingSession"));
            },
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "RiskSnapshot" },
            (payload) => {
              // RLS scopes this stream to the adviser's own learners, so a
              // High/Moderate snapshot here means one of their advisees was
              // just detected — refresh the board even if no notification row
              // was fanned out.
              const level = (payload as { new?: { riskLevel?: unknown } }).new?.riskLevel;
              if (level === "High" || level === "Moderate") ringAdviserRisk();
              invalidate(scopesForRealtimeTable("RiskSnapshot"));
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
          // touched (and the bell) instead of spamming toasts. The risk board
          // refetch hint still fires when this shipped without realtime push —
          // a risk sweep can flag several advisees at once, and those
          // detections must not be swallowed by the summary path.
          const scopes = new Set<TeacherInvalidateScope>(["notifications"]);
          let detected = false;
          let sessionBooked = false;
          let sessionResched = false;
          let sessionCancelled = false;
          let referralUpdate = false;
          let referralClosed = false;
          let admRejected = false;
          let admBooked = false;
          let admResched = false;
          let admRejectedClinic = false;
          let admBookedClinic = false;
          let admReschedClinic = false;
          let admEndorsedClinic = false;
          let counselingBooked = false;
          let counselingResched = false;
          let counselingRejected = false;
          let clinicBooked = false;
          let clinicResched = false;
          let clinicRejected = false;
          for (const n of fresh) {
            seenIds.current.add(n.id);
            for (const s of scopesForNotification(n)) scopes.add(s);
            if (
              !PUSH_ENABLED &&
              (n.type ?? "").toLowerCase() === "intervention_detected" &&
              !isSelfNotification(n) &&
              !/^you\b/i.test(n.message ?? "")
            ) {
              detected = true;
            }
            if (
              !PUSH_ENABLED &&
              isAdviserSessionBooked(n) &&
              !isSelfNotification(n)
            ) {
              sessionBooked = true;
            }
            if (
              !PUSH_ENABLED &&
              isAdviserSessionRescheduled(n) &&
              !isSelfNotification(n)
            ) {
              sessionResched = true;
            }
            if (
              !PUSH_ENABLED &&
              isAdviserSessionCancelled(n) &&
              !isSelfNotification(n)
            ) {
              sessionCancelled = true;
            }
            // Referral pipeline actions (see `notify`): always notification-
            // driven, so they do not gate on PUSH_ENABLED.
            if (!isSelfNotification(n)) {
              if (isAdviserClinicBooked(n)) clinicBooked = true;
              else if (isAdviserCounselingBooked(n)) counselingBooked = true;
              else if (isAdviserAdmBookedClinic(n)) admBookedClinic = true;
              else if (isAdviserAdmBooked(n)) admBooked = true;
              else if (isAdviserReferralSessionBooked(n)) sessionBooked = true;
              if (isAdviserClinicRescheduled(n)) clinicResched = true;
              else if (isAdviserCounselingRescheduled(n)) counselingResched = true;
              else if (isAdviserAdmRescheduledClinic(n)) admReschedClinic = true;
              else if (isAdviserAdmRescheduled(n)) admResched = true;
              else if (isAdviserReferralSessionRescheduled(n)) sessionResched = true;
              if (isAdviserReferralSessionCancelled(n)) sessionCancelled = true;
              if (isAdviserAdmEndorsedClinic(n)) admEndorsedClinic = true;
              else if (isAdviserReferralEndorsed(n)) referralUpdate = true;
              if (isAdviserClinicRejected(n)) clinicRejected = true;
              else if (isAdviserCounselingRejected(n)) counselingRejected = true;
              else if (isAdviserAdmRejectedClinic(n)) admRejectedClinic = true;
              else if (isAdviserAdmRejected(n)) admRejected = true;
              else if (isAdviserReferralClosed(n)) referralClosed = true;
            }
          }
          toast.info({
            title: `${fresh.length} new updates`,
            description: "Open the notifications bell to review them.",
          });
          if (detected) ringAdviserRisk();
          if (clinicBooked) ringAdviserClinicBooked();
          if (clinicResched) ringAdviserClinicRescheduled();
          if (clinicRejected) ringAdviserClinicRejected();
          if (counselingBooked) ringAdviserCounselingBooked();
          if (counselingResched) ringAdviserCounselingRescheduled();
          if (counselingRejected) ringAdviserCounselingRejected();
          if (admBooked) ringAdviserAdmBooked();
          if (admBookedClinic) ringAdviserAdmBooked(true);
          if (admResched) ringAdviserAdmRescheduled();
          if (admReschedClinic) ringAdviserAdmRescheduled(true);
          if (sessionBooked) ringAdviserSession();
          if (sessionResched) ringAdviserSessionResched();
          if (sessionCancelled) ringAdviserSessionCancelled();
          if (referralUpdate) ringAdviserReferralUpdate();
          if (admEndorsedClinic) ringAdviserReferralUpdate(true);
          if (admRejected) ringAdviserAdmRejected();
          if (admRejectedClinic) ringAdviserAdmRejected(true);
          if (referralClosed) ringAdviserReferralClosed();
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
