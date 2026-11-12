"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ADVISER_RISK_ALERT_EVENT } from "@/lib/realtime/teacherChannel";
import { playDeskSound, primeDeskSounds } from "@/lib/notify/deskSounds";
import { useTeacherOverview } from "@/services/teacher/overview.service";
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
 * The realtime event and the `intervention_detected` notification fanout are
 * therefore only *refresh signals*: they make the board re-read immediately so
 * a brand-new learner rings sub-second, but they never play the clip themselves
 * — that is what used to re-ring the same student on every notification.
 */

const BOARD_POLL_MS = 15_000;

/** `/teacher/advisory/interventions` query key prefix (the board loads the whole queue). */
const BOARD_QUERY_KEY = ["advisory-interventions", "queue"] as const;

export function AdviserRiskAlertMonitor() {
  const queryClient = useQueryClient();
  // Only advisers receive advisee detections — subject teachers must not add
  // background polls for a sound they can never ring. Shares the overview query
  // the shell's sidebar already runs.
  const overview = useTeacherOverview();
  const isAdviser = overview.data?.isAdviser === true;
  const { activeTerm, termReady } = useTerm();
  const boardEnabled = isAdviser && termReady;

  // Create + arm the shared clips (and the first-gesture unlock) for this shell.
  // This desk only ever rings its own adviser clip.
  React.useEffect(() => {
    primeDeskSounds(["adviserRisk"]);
  }, []);

  // Delivery path 1: realtime frames (a `intervention_detected` fanout or a
  // High/Moderate `RiskSnapshot`). Only refreshes the board — the diff below
  // decides whether this is a learner who has not rung yet.
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

  /** Learner keys on the baseline board (previous payload). */
  const rowsRef = React.useRef<Set<string> | null>(null);
  /** Term the baseline belongs to — a new term is a new board. */
  const boardTermRef = React.useRef<string | null>(null);
  /** Learners already rung for this term, so a card update stays silent. */
  const alertedStudentsRef = React.useRef<Set<string>>(new Set());
  const students = boardQuery.data?.data;
  React.useEffect(() => {
    if (!Array.isArray(students) || !boardEnabled) return;
    const next = new Set(students.map((student) => student.key));

    // A term switch re-seeds the baseline and re-arms every learner — a learner
    // carried into the new term has not rung there yet.
    if (boardTermRef.current !== termKey) {
      boardTermRef.current = termKey;
      rowsRef.current = next;
      alertedStudentsRef.current = new Set();
      return;
    }

    const previous = rowsRef.current;
    rowsRef.current = next;
    // First payload only seeds the baseline — signing in must not ring for
    // every advisee that was already on the board.
    if (!previous) return;

    // A learner who left detection is forgotten, so coming back rings again.
    const alerted = alertedStudentsRef.current;
    for (const key of [...alerted]) {
      if (!next.has(key)) alerted.delete(key);
    }

    let ring = false;
    for (const key of next) {
      if (alerted.has(key)) continue;
      alerted.add(key);
      // Only a learner newly in detection rings. A change to a card that was
      // already on the board (plan opened by guidance, session booked, new
      // outcome, risk level moved) is work the adviser has already been alerted
      // to.
      if (!previous.has(key)) ring = true;
    }
    if (ring) playDeskSound("adviserRisk");
  }, [students, boardEnabled, termKey]);

  return null;
}
