"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ADVISER_ADM_BOOKED_EVENT,
  ADVISER_ADM_REJECTED_EVENT,
  ADVISER_ADM_RESCHEDULED_EVENT,
  ADVISER_COUNSELING_BOOKED_EVENT,
  ADVISER_COUNSELING_REJECTED_EVENT,
  ADVISER_COUNSELING_RESCHEDULED_EVENT,
  ADVISER_CLINIC_BOOKED_EVENT,
  ADVISER_CLINIC_REJECTED_EVENT,
  ADVISER_CLINIC_RESCHEDULED_EVENT,
  ADVISER_REFERRAL_CLOSED_EVENT,
  ADVISER_REFERRAL_UPDATE_EVENT,
  ADVISER_RISK_ALERT_EVENT,
  ADVISER_SESSION_ALERT_EVENT,
  ADVISER_SESSION_CANCELLED_EVENT,
  ADVISER_SESSION_RESCHED_EVENT,
} from "@/lib/realtime/teacherChannel";
import {
  playDeskSound,
  primeDeskSounds,
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
import { useDeskCatchUp } from "@/lib/notify/deskCatchUp";
import { useDeskSoundTitle } from "@/lib/notify/useDeskSoundTitle";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import {
  fetchAllAdvisoryInterventions,
  type AdvisoryInterventionsResponse,
} from "@/services/teacher/interventions.service";

/**
 * Headless risk-alert monitor for the teacher/adviser shell.
 *
 * Rings `/sounds/ADVISER RISK ALERT.mp3` when one of the adviser's own advisees
 * newly appears in intervention detection — on every teacher page and while the
 * tab sits on another site.
 *
 * The sound is decided in exactly one place: the diff of the adviser's own
 * interventions board (polled from this shell on the same cache key the page
 * uses, 15s, hidden tabs included). A learner rings **once** when they enter
 * detection and then stays silent for every later change on their card — a
 * guidance counselor opening an intervention, booking or completing a session,
 * a new outcome, or a `intervention_detected` notification fanned out for any
 * of those. If the learner leaves detection (resolved / corrected data) and
 * later comes back, they ring again. The alerted set resets per term.
 *
 * The realtime events are the delivery path: a `RiskSnapshot` insert or an
 * `Intervention` write makes the board re-read immediately so a brand-new
 * learner rings sub-second. The `intervention_detected` notification fanout is
 * only a fallback when Supabase realtime is off. None of them play the clip
 * themselves — the board diff below decides — so a learner cannot re-ring on
 * every later card/session/outcome update.
 *
 * Who already rang is persisted per adviser + term (`zentra.adviser.risk.rung.*`)
 * so a reload does not replay every learner on the board, while an advisee
 * detected while the adviser was signed out still rings once on arrival.
 */

const BOARD_POLL_MS = 15_000;
/** Learners this desk already rang for, per adviser + term. */
const RUNG_KEY_PREFIX = "zentra.adviser.risk.rung";

function rungStorageKey(userId: string, termKey: string): string {
  return `${RUNG_KEY_PREFIX}.${userId}.${termKey}`;
}

function readRung(key: string): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return null;
  }
}

function writeRung(key: string, keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...keys]));
  } catch {
    /* storage unavailable — the in-memory set still prevents a double ring */
  }
}

/** `/teacher/advisory/interventions` query key prefix (the board loads the whole queue). */
const BOARD_QUERY_KEY = ["advisory-interventions", "queue"] as const;

export function AdviserRiskAlertMonitor() {
  const queryClient = useQueryClient();
  useDeskSoundTitle();
  // Only advisers receive advisee detections — subject teachers must not add
  // background polls for a sound they can never ring. Shares the overview query
  // the shell's sidebar already runs.
  const overview = useTeacherOverview();
  const isAdviser = overview.data?.isAdviser === true;
  const session = useSession();
  const { activeTerm, termReady } = useTerm();
  const boardEnabled = isAdviser && termReady;

  // Create + arm the shared clips (and the first-gesture unlock) for this shell.
  // This desk only ever rings its own adviser clips.
  React.useEffect(() => {
    primeDeskSounds([
      "adviserRisk",
      "adviserSession",
      "adviserSessionResched",
      "adviserSessionCancelled",
      "adviserReferralUpdate",
      "adviserReferralClosed",
      "adviserAdmRejected",
      "adviserAdmBooked",
      "adviserAdmRescheduled",
      "adviserAdmRejectedClinic",
      "adviserAdmBookedClinic",
      "adviserAdmRescheduledClinic",
      "adviserAdmEndorsedClinic",
      "adviserCounselingBooked",
      "adviserCounselingRejected",
      "adviserCounselingRescheduled",
      "adviserClinicBooked",
      "adviserClinicRejected",
      "adviserClinicRescheduled",
    ]);
  }, []);

  // Guidance booked, moved or dropped an intervention session for one of this
  // adviser's advisees — the notification fanout (or the realtime
  // `CounselingSession` frame) fires the matching event. Referral-pipeline
  // actions on a referral the teacher filed (ADM endorse/reject, session
  // booked/moved/dropped) fire the same session events plus the referral ones.
  React.useEffect(() => {
    if (!isAdviser) return;
    const onSessionBooked = () => playDeskSound("adviserSession");
    const onSessionResched = () => playDeskSound("adviserSessionResched");
    const onSessionCancelled = () => playDeskSound("adviserSessionCancelled");
    const isClinic = (event: Event) =>
      (event as CustomEvent<{ clinic?: boolean } | undefined>).detail?.clinic === true;
    const onReferralUpdate = (event: Event) =>
      playDeskSound(isClinic(event) ? "adviserAdmEndorsedClinic" : "adviserReferralUpdate");
    const onReferralClosed = () => playDeskSound("adviserReferralClosed");
    const onAdmRejected = (event: Event) =>
      playDeskSound(isClinic(event) ? "adviserAdmRejectedClinic" : "adviserAdmRejected");
    const onAdmBooked = (event: Event) =>
      playDeskSound(isClinic(event) ? "adviserAdmBookedClinic" : "adviserAdmBooked");
    const onAdmRescheduled = (event: Event) =>
      playDeskSound(
        isClinic(event) ? "adviserAdmRescheduledClinic" : "adviserAdmRescheduled",
      );
    const onCounselingBooked = () => playDeskSound("adviserCounselingBooked");
    const onCounselingRejected = () => playDeskSound("adviserCounselingRejected");
    const onCounselingRescheduled = () =>
      playDeskSound("adviserCounselingRescheduled");
    const onClinicBooked = () => playDeskSound("adviserClinicBooked");
    const onClinicRejected = () => playDeskSound("adviserClinicRejected");
    const onClinicRescheduled = () => playDeskSound("adviserClinicRescheduled");
    window.addEventListener(ADVISER_SESSION_ALERT_EVENT, onSessionBooked);
    window.addEventListener(ADVISER_SESSION_RESCHED_EVENT, onSessionResched);
    window.addEventListener(ADVISER_SESSION_CANCELLED_EVENT, onSessionCancelled);
    window.addEventListener(ADVISER_REFERRAL_UPDATE_EVENT, onReferralUpdate);
    window.addEventListener(ADVISER_REFERRAL_CLOSED_EVENT, onReferralClosed);
    window.addEventListener(ADVISER_ADM_REJECTED_EVENT, onAdmRejected);
    window.addEventListener(ADVISER_ADM_BOOKED_EVENT, onAdmBooked);
    window.addEventListener(ADVISER_ADM_RESCHEDULED_EVENT, onAdmRescheduled);
    window.addEventListener(ADVISER_COUNSELING_BOOKED_EVENT, onCounselingBooked);
    window.addEventListener(
      ADVISER_COUNSELING_REJECTED_EVENT,
      onCounselingRejected,
    );
    window.addEventListener(
      ADVISER_COUNSELING_RESCHEDULED_EVENT,
      onCounselingRescheduled,
    );
    window.addEventListener(ADVISER_CLINIC_BOOKED_EVENT, onClinicBooked);
    window.addEventListener(ADVISER_CLINIC_REJECTED_EVENT, onClinicRejected);
    window.addEventListener(
      ADVISER_CLINIC_RESCHEDULED_EVENT,
      onClinicRescheduled,
    );
    return () => {
      window.removeEventListener(ADVISER_SESSION_ALERT_EVENT, onSessionBooked);
      window.removeEventListener(ADVISER_SESSION_RESCHED_EVENT, onSessionResched);
      window.removeEventListener(ADVISER_SESSION_CANCELLED_EVENT, onSessionCancelled);
      window.removeEventListener(ADVISER_REFERRAL_UPDATE_EVENT, onReferralUpdate);
      window.removeEventListener(ADVISER_REFERRAL_CLOSED_EVENT, onReferralClosed);
      window.removeEventListener(ADVISER_ADM_REJECTED_EVENT, onAdmRejected);
      window.removeEventListener(ADVISER_ADM_BOOKED_EVENT, onAdmBooked);
      window.removeEventListener(ADVISER_ADM_RESCHEDULED_EVENT, onAdmRescheduled);
      window.removeEventListener(
        ADVISER_COUNSELING_BOOKED_EVENT,
        onCounselingBooked,
      );
      window.removeEventListener(
        ADVISER_COUNSELING_REJECTED_EVENT,
        onCounselingRejected,
      );
      window.removeEventListener(
        ADVISER_COUNSELING_RESCHEDULED_EVENT,
        onCounselingRescheduled,
      );
      window.removeEventListener(ADVISER_CLINIC_BOOKED_EVENT, onClinicBooked);
      window.removeEventListener(ADVISER_CLINIC_REJECTED_EVENT, onClinicRejected);
      window.removeEventListener(
        ADVISER_CLINIC_RESCHEDULED_EVENT,
        onClinicRescheduled,
      );
    };
  }, [isAdviser]);

  // Login catch-up: if a "session booked"/"session moved"/"session cancelled"/
  // referral decision landed while the adviser was signed out (or on another
  // device), ring it once on arrival instead of staying silent until the next
  // live change.
  useDeskCatchUp({
    role: "adviser",
    userId: session?.sub ?? null,
    enabled: isAdviser,
    title: "Updates for your advisees",
    clipFor: (row) => {
      if (isAdviserClinicBooked(row)) return "adviserClinicBooked";
      if (isAdviserClinicRejected(row)) return "adviserClinicRejected";
      if (isAdviserClinicRescheduled(row)) return "adviserClinicRescheduled";
      if (isAdviserCounselingBooked(row)) return "adviserCounselingBooked";
      if (isAdviserCounselingRejected(row)) return "adviserCounselingRejected";
      if (isAdviserCounselingRescheduled(row)) return "adviserCounselingRescheduled";
      if (isAdviserAdmBookedClinic(row)) return "adviserAdmBookedClinic";
      if (isAdviserAdmBooked(row)) return "adviserAdmBooked";
      if (isAdviserAdmRejectedClinic(row)) return "adviserAdmRejectedClinic";
      if (isAdviserAdmRejected(row)) return "adviserAdmRejected";
      if (isAdviserReferralClosed(row)) return "adviserReferralClosed";
      if (isAdviserAdmEndorsedClinic(row)) return "adviserAdmEndorsedClinic";
      if (isAdviserReferralEndorsed(row)) return "adviserReferralUpdate";
      if (isAdviserSessionCancelled(row) || isAdviserReferralSessionCancelled(row)) {
        return "adviserSessionCancelled";
      }
      if (isAdviserAdmRescheduledClinic(row)) return "adviserAdmRescheduledClinic";
      if (isAdviserAdmRescheduled(row)) return "adviserAdmRescheduled";
      if (isAdviserSessionRescheduled(row) || isAdviserReferralSessionRescheduled(row)) {
        return "adviserSessionResched";
      }
      if (isAdviserSessionBooked(row) || isAdviserReferralSessionBooked(row)) {
        return "adviserSession";
      }
      return null;
    },
  });

  // Delivery path 1: realtime frames (`RiskSnapshot` inserts and `Intervention`
  // writes — live, not throttled like a timer). Only refreshes the board — the
  // diff below decides whether this is a learner who has not rung yet. The
  // `intervention_detected` notification fanout is a fallback for setups
  // without Supabase realtime, never the trigger while push is available.
  React.useEffect(() => {
    if (!isAdviser) return;
    const onAlert = () => {
      void queryClient.invalidateQueries({ queryKey: [...BOARD_QUERY_KEY] });
    };
    window.addEventListener(ADVISER_RISK_ALERT_EVENT, onAlert);
    return () => window.removeEventListener(ADVISER_RISK_ALERT_EVENT, onAlert);
  }, [isAdviser, queryClient]);

  // Delivery path 2: the adviser's own Interventions board, polled from the
  // shell on the same cache key the page uses. Off that page (or on another
  // site) this poll is what sees an advisee being flagged, because most live
  // risk changes write no `Intervention` row.
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const boardQuery = useQuery<AdvisoryInterventionsResponse>({
    queryKey: [...BOARD_QUERY_KEY, termKey],
    queryFn: ({ signal }) => fetchAllAdvisoryInterventions({ signal }),
    refetchInterval: BOARD_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    enabled: boardEnabled,
  });

  /** Learners already rung for this adviser + term (persisted), so a reload
   *  does not replay the board while a detection that landed offline still
   *  rings once on arrival. */
  const rungRef = React.useRef<Set<string> | null>(null);
  /** Storage key the current `rungRef` belongs to (adviser + term). */
  const rungKeyRef = React.useRef<string | null>(null);
  const students = boardQuery.data?.data;
  const userId = session?.sub ?? null;
  React.useEffect(() => {
    if (!Array.isArray(students) || !boardEnabled || !userId) return;
    const storageKey = rungStorageKey(userId, termKey);
    // A different adviser or term is a different board.
    if (rungKeyRef.current !== storageKey) {
      rungKeyRef.current = storageKey;
      rungRef.current = readRung(storageKey);
    }
    const next = new Set(students.map((student) => student.key));

    // First visit to this desk+term: seed silently — signing in must not ring
    // for the whole backlog, and a reload must stay quiet.
    const stored = rungRef.current;
    if (stored === null) {
      rungRef.current = new Set(next);
      writeRung(storageKey, next);
      return;
    }

    // Forget learners who left detection, so coming back rings again.
    for (const key of [...stored]) {
      if (!next.has(key)) stored.delete(key);
    }

    // Anyone on the board who has not rung yet is a detection this adviser has
    // not been alerted to — a learner detected while they were signed out
    // (first payload) or a brand-new card (later poll). A card that merely
    // changed — guidance opened the intervention, a session was booked, the
    // outcome moved — is already in the set and stays silent.
    let ring = false;
    for (const key of next) {
      if (stored.has(key)) continue;
      stored.add(key);
      ring = true;
    }
    writeRung(storageKey, stored);
    if (ring) playDeskSound("adviserRisk");
  }, [students, boardEnabled, termKey, userId]);

  return null;
}
