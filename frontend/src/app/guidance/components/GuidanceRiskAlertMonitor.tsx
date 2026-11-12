"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGuidanceAlertCounts } from "@/services/guidance/alerts.service";
import {
  GUIDANCE_NAV_COUNTS_KEY,
  NAV_QUEUE_QUERY_KEYS,
  fetchGuidanceNavQueues,
  type GuidanceNavQueues,
} from "@/services/guidance/navCounts.service";
import {
  GUIDANCE_REFERRAL_EVENT,
  GUIDANCE_RISK_ALERT_EVENT,
  isSelfNotified,
} from "@/lib/realtime/guidanceChannel";
import {
  isDeskSoundPlaying,
  isIncomingReferral,
  isReferralCancelled,
  primeDeskSounds,
  registerDeskSoundClip,
  unregisterDeskSoundClip,
} from "@/lib/notify/deskSounds";
import {
  useDeskCatchUp,
} from "@/lib/notify/deskCatchUp";
import { useSession } from "@/lib/auth/useSession";
import { markRealtimeUpdate } from "@/lib/api/fresh";
import { guidanceLiveQueryOptions } from "@/lib/api/live";
import { useTerm } from "@/lib/term/TermContext";
import { fetchAllGuidanceInterventions } from "@/services/guidance/interventions.service";
import type {
  AtRiskStudentItem,
  GuidanceInterventionsData,
} from "@/services/guidance/interventions.types";

/**
 * Headless risk-alert monitor for the guidance shell.
 *
 * Rings `/sounds/referrals.mp3` for an arriving (or withdrawn) referral and
 * `/sounds/risk alert.mp3` only when the interventions desk's data changes —
 * a new at-risk learner or an intervention move. Alerts-only, counseling,
 * ADM and anecdote changes refresh caches without ringing. It also prefixes
 * the browser tab title with the live High/Moderate count. Two independent
 * triggers feed the risk alarm, so it survives either one being unavailable:
 *
 *  - the realtime channel (`GUIDANCE_RISK_ALERT_EVENT`), which fires from
 *    WebSocket frames — not throttled while the tab is hidden, so the sound
 *    still plays when the counselor is on another page or another site;
 *  - the `/guidance/nav-counts` interventions queue diff, which also runs
 *    while hidden and covers an engine detection that produced no
 *    notification row;
 *  - the `/guidance/interventions` board payload itself, polled by this shell in
 *    the background (15s, hidden tabs included) exactly like the referral poll:
 *    the board's risk levels are recomputed live from grades, attendance and
 *    anecdotes, so a card can change with no `Intervention` write and no
 *    notification at all. Polling it here — not from the page — is what makes
 *    the alarm sound on every guidance page and on other sites.
 *
 * All three triggers only *refresh* the board; the sound is decided in one
 * place by diffing the board payload. A learner rings once when they appear in
 * intervention detection and stays silent while they remain on the board, no
 * matter how many cards/sessions/outcomes update. If they leave detection
 * (resolved, corrected data) and later come back, they ring again. Opening or
 * clicking a card never rings.
 *
 * Browsers only allow programmatic audio after a user gesture — the first
 * click/key anywhere on the desk primes the element so later background alerts
 * can sound.
 */

const SOUND_SRC = "/sounds/risk%20alert.mp3";
/** New referrals ring this clip instead of the risk alarm. */
const REFERRAL_SOUND_SRC = "/sounds/referrals.mp3";
/** A withdrawn referral rings its own clip — the case left the desk. */
const CANCEL_SOUND_SRC = "/sounds/cancelled%20referral.mp3";
const REFERRAL_REPLAY_MS = 8_000;
const COUNT_POLL_MS = 10_000;
/** Shares the sidebar dot's `/guidance/nav-counts` query — its 5s poll drives
 *  both the dot and this monitor's "something changed" detection. */
const NAV_POLL_MS = 5_000;
/** One ring per burst — the hourly sweep can flag several learners at once. */
const MIN_REPLAY_MS = 12_000;
const TITLE_PREFIX = /^\(\d+\+?\)\s*/;

const RISK_RANK: Record<string, number> = { High: 0, Moderate: 1, Low: 2 };

/** The parts of an interventions card the counselor can see change. */
interface BoardRow {
  rank: number;
  riskCount: number;
  factors: string;
  interventionId: string | null;
  outcome: string;
  detectedAt: string;
}

function boardRow(student: AtRiskStudentItem): BoardRow {
  return {
    rank: RISK_RANK[student.riskLevel] ?? 3,
    riskCount: student.riskCount,
    factors: `${+student.factors.academic}${+student.factors.attendance}${+student.factors.behavioral}`,
    interventionId: student.intervention?.id ?? null,
    outcome: student.intervention?.outcomeStatus ?? "",
    detectedAt: student.detectedAt ?? "",
  };
}

/** `/guidance/interventions` query key prefix (the board loads the whole queue). */
const BOARD_QUERY_KEY = ["guidance-interventions", "queue"] as const;

export function GuidanceRiskAlertMonitor() {
  const queryClient = useQueryClient();
  const session = useSession();
  const { activeTerm, termReady } = useTerm();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const referralAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const cancelAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const unlockedRef = React.useRef(false);
  const lastPlayedRef = React.useRef(0);
  const lastReferralPlayedRef = React.useRef(0);
  const lastCancelPlayedRef = React.useRef(0);
  const lastTotalRef = React.useRef<number | null>(null);

  const countsQuery = useQuery({
    queryKey: ["guidance-alerts", "count"],
    queryFn: ({ signal }) => fetchGuidanceAlertCounts({ signal }),
    refetchInterval: COUNT_POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 10_000,
  });
  const total = countsQuery.data?.total ?? 0;

  // Same payload the sidebar badges diff against. Badge counts move for *any*
  // guidance write (referral status, intervention outcome, booked session,
  // filed document) — not just the High/Moderate risk total — so the sound and
  // the page refresh ride this instead of the alert counter alone.
  const navQuery = useQuery({
    queryKey: [...GUIDANCE_NAV_COUNTS_KEY],
    queryFn: ({ signal }) => fetchGuidanceNavQueues(signal),
    refetchInterval: NAV_POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  // Last seen id→version per queue: a badge-visible change also invalidates that
  // page's queries here, so the board is already fresh when the counselor opens
  // it instead of showing the pre-write rows behind a new badge.
  const navVersionsRef = React.useRef<
    Map<keyof GuidanceNavQueues, Map<string, string>> | null
  >(null);

  // The interventions board itself, polled from the shell — same query key as
  // `/guidance/interventions`, so the page shares this cache entry instead of
  // fetching a second copy. Off that page this poll is the only thing that can
  // see a card change that emits no notification and no published row, so the
  // alarm keeps working on every guidance page and while the tab is elsewhere.
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const boardQuery = useQuery<GuidanceInterventionsData>({
    ...guidanceLiveQueryOptions,
    queryKey: [...BOARD_QUERY_KEY, termKey],
    queryFn: ({ signal }) => fetchAllGuidanceInterventions({ signal }),
    enabled: termReady,
  });

  // Create both clips and unlock playback on the first user gesture. The
  // referral clip reuses this exact mechanism so it behaves like the risk
  // alarm: unlocked by any click, audible even while the tab is hidden.
  React.useEffect(() => {
    // Also arms the shared desk-sound players + gesture flag, so the login
    // catch-up ring below can tell when playback is allowed. Only this desk's
    // clips are primed — never the adviser alert.
    primeDeskSounds(["referral", "cancelled", "risk"]);
    const risk = new Audio(SOUND_SRC);
    risk.preload = "auto";
    risk.volume = 0.9;
    audioRef.current = risk;

    const referral = new Audio(REFERRAL_SOUND_SRC);
    referral.preload = "auto";
    referral.volume = 0.9;
    referralAudioRef.current = referral;

    const cancel = new Audio(CANCEL_SOUND_SRC);
    cancel.preload = "auto";
    cancel.volume = 0.9;
    cancelAudioRef.current = cancel;

    const clips = [risk, referral, cancel];
    // Join the shared one-at-a-time audio bus (referral vs risk vs cancel).
    for (const clip of clips) registerDeskSoundClip(clip);
    const unlockOpts: AddEventListenerOptions = { capture: true };
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      // Unlock silently: play() must run inside the gesture, but the probe is
      // muted so the first click (e.g. opening a case card) never leaks a
      // fraction of the alert clip.
      for (const audio of clips) {
        const volume = audio.volume;
        audio.volume = 0;
        void audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = volume;
          })
          .catch(() => {
            /* Autoplay still blocked — the gesture listener stays gone. */
            audio.volume = volume;
          });
      }
    };
    window.addEventListener("pointerdown", unlock, unlockOpts);
    window.addEventListener("keydown", unlock, unlockOpts);

    return () => {
      window.removeEventListener("pointerdown", unlock, unlockOpts);
      window.removeEventListener("keydown", unlock, unlockOpts);
      for (const audio of clips) {
        audio.pause();
        unregisterDeskSoundClip(audio);
      }
      audioRef.current = null;
      referralAudioRef.current = null;
      cancelAudioRef.current = null;
    };
  }, []);

  const play = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Never restart/overlap a clip that is already ringing — one update must be
    // one sound even when several triggers (realtime frame + poll + counter)
    // report the same change, and a referral clip must never talk over it.
    if (isDeskSoundPlaying()) return;
    const now = Date.now();
    if (now - lastPlayedRef.current < MIN_REPLAY_MS) return;
    lastPlayedRef.current = now;
    try {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        /* No gesture yet or audio policy — next detection retries. */
      });
    } catch {
      /* ignore */
    }
  }, []);

  const playReferral = React.useCallback(() => {
    const audio = referralAudioRef.current;
    if (!audio) return;
    // One clip at a time — wait out the risk alarm instead of layering.
    if (isDeskSoundPlaying()) return;
    const now = Date.now();
    if (now - lastReferralPlayedRef.current < REFERRAL_REPLAY_MS) return;
    lastReferralPlayedRef.current = now;
    try {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        /* No gesture yet or audio policy — next arrival retries. */
      });
    } catch {
      /* ignore */
    }
  }, []);

  const playCancel = React.useCallback(() => {
    const audio = cancelAudioRef.current;
    if (!audio) return;
    // Same one-at-a-time bus as the referral/risk clips.
    if (isDeskSoundPlaying()) return;
    const now = Date.now();
    if (now - lastCancelPlayedRef.current < REFERRAL_REPLAY_MS) return;
    lastCancelPlayedRef.current = now;
    try {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        /* No gesture yet or audio policy — next event retries. */
      });
    } catch {
      /* ignore */
    }
  }, []);

  // Any badge-visible change refreshes the page it belongs to. The sound is
  // *not* decided here: it follows the interventions board diff below, so a
  // learner who is already in detection never rings again just because their
  // card moved. A brand-new learner still rings — their card appears on the
  // board this invalidation re-reads.
  React.useEffect(() => {
    if (!navQuery.data) return;
    const queues = Object.keys(NAV_QUEUE_QUERY_KEYS) as (keyof GuidanceNavQueues)[];
    const next = new Map<keyof GuidanceNavQueues, Map<string, string>>();
    for (const queue of queues) {
      next.set(queue, new Map(navQuery.data[queue].map((entry) => [entry.id, entry.v])));
    }
    const previous = navVersionsRef.current;
    navVersionsRef.current = next;
    // First payload only seeds the baseline — signing in must not ring for
    // every case that was already waiting.
    if (!previous) return;

    const changed: (keyof GuidanceNavQueues)[] = [];
    for (const [queue, entries] of next) {
      const before = previous.get(queue) ?? new Map<string, string>();
      let queueChanged = false;
      for (const [id, version] of entries) {
        if (before.get(id) === version) continue;
        queueChanged = true;
      }
      // A case leaving the queue (resolved/moved) changes the board too, but it
      // is not a "new work" alert — refresh the page without ringing.
      if (!queueChanged && entries.size !== before.size) queueChanged = true;
      if (queueChanged) changed.push(queue);
    }
    if (changed.length === 0) return;

    markRealtimeUpdate();
    for (const queue of changed) {
      for (const key of NAV_QUEUE_QUERY_KEYS[queue]) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }
  }, [navQuery.data, queryClient]);

  // The board's risk levels are recomputed live from grades, attendance and
  // anecdote counts, so most of what a counselor sees change on
  // `/guidance/interventions` never touches an `Intervention` row — no
  // notification is fanned out and `/guidance/nav-counts` does not move, which
  // used to leave the desk updating in silence. This diff is the one place the
  // risk alarm is decided: a learner rings **once** when they enter detection
  // and stays silent while they remain on the board. It runs on any guidance
  // page and while the tab sits on another site because this poll runs in the
  // shell.
  const boardRowsRef = React.useRef<Map<string, BoardRow> | null>(null);
  /** Term the baseline belongs to — a new term is a new board. */
  const boardTermRef = React.useRef<string | null>(null);
  /** Learners already rung for in this term, so a card update stays silent. */
  const alertedStudentsRef = React.useRef<Set<string>>(new Set());
  const boardStudents = boardQuery.data?.students;
  React.useEffect(() => {
    if (!Array.isArray(boardStudents)) return;
    const next = new Map<string, BoardRow>();
    for (const student of boardStudents) next.set(student.studentKey, boardRow(student));

    // A term switch re-seeds the baseline and re-arms every learner — a learner
    // carried into the new term has not rung there yet.
    if (boardTermRef.current !== termKey) {
      boardTermRef.current = termKey;
      boardRowsRef.current = next;
      alertedStudentsRef.current = new Set();
      return;
    }

    const previous = boardRowsRef.current;
    boardRowsRef.current = next;
    // First payload only seeds the baseline — signing in must not ring for
    // every case that was already on the board.
    if (!previous) return;

    // A learner who left detection is forgotten, so coming back rings again.
    const alerted = alertedStudentsRef.current;
    for (const key of [...alerted]) {
      if (!next.has(key)) alerted.delete(key);
    }

    let ring = false;
    for (const [key, row] of next) {
      if (alerted.has(key)) continue;
      // The counselor's own save already patched its card optimistically and
      // must never ring — but mark it as heard so a later poll stays silent too.
      alerted.add(key);
      const self = row.interventionId ? isSelfNotified(row.interventionId) : false;
      if (self) continue;
      // Only a learner newly in detection rings. A change to a card that was
      // already on the board (higher risk, booked session, new outcome) is an
      // update to work the counselor has already been alerted to.
      if (!previous.has(key)) ring = true;
    }
    if (ring) play();
  }, [boardStudents, termKey, play]);

  // Keep the tab title in sync and pull the at-risk boards forward so
  // `/guidance/interventions` shows a new learner at the same moment the sound
  // rings instead of waiting out its own poll. The alert counter itself never
  // rings — the risk alarm follows the interventions board only.
  React.useEffect(() => {
    if (!countsQuery.isSuccess) return;
    const previous = lastTotalRef.current;
    lastTotalRef.current = total;
    if (previous !== null && total !== previous) {
      markRealtimeUpdate();
      void queryClient.invalidateQueries({ queryKey: ["guidance-interventions"] });
      void queryClient.invalidateQueries({ queryKey: ["guidance-alerts", "cases"] });
      void queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["guidance-nav-counts"] });
    }
  }, [countsQuery.isSuccess, total, queryClient]);

  React.useEffect(() => {
    const base = document.title.replace(TITLE_PREFIX, "");
    const next = total > 0 ? `(${total}) ${base}` : base;
    if (document.title !== next) document.title = next;
    return () => {
      document.title = base;
    };
  }, [total]);

  React.useEffect(() => {
    // A realtime detection / risk-factor frame only refreshes the board; the
    // board diff above decides whether this is a learner who has not rung yet.
    // Playing here directly would re-ring an already-alerted learner every time
    // their plan, session or outcome changed.
    const onAlert = () => {
      markRealtimeUpdate();
      void queryClient.invalidateQueries({ queryKey: [...BOARD_QUERY_KEY] });
    };
    const onReferral = (event: Event) => {
      const detail = (
        event as CustomEvent<{ sourceTable?: string | null; message?: string | null }>
      ).detail;
      // A withdrawn case left the desk — ring the cancel clip, not the
      // arrival clip the case originally rang.
      if (detail && isReferralCancelled(detail)) playCancel();
      else playReferral();
    };
    window.addEventListener(GUIDANCE_RISK_ALERT_EVENT, onAlert);
    window.addEventListener(GUIDANCE_REFERRAL_EVENT, onReferral);
    return () => {
      window.removeEventListener(GUIDANCE_RISK_ALERT_EVENT, onAlert);
      window.removeEventListener(GUIDANCE_REFERRAL_EVENT, onReferral);
    };
  }, [queryClient, playReferral, playCancel]);

  // Login catch-up: work that landed while this user was signed out rings once
  // on arrival at the desk (deferred to the first click if audio is still
  // locked) instead of replaying the whole backlog or staying silent.
  useDeskCatchUp({
    role: "guidance",
    userId: session?.sub ?? null,
    title: "New work on the guidance desk",
    // Referral arrivals/withdrawals can be caught up; the risk clip is reserved
    // for a realtime detection / risk-factor update, never for a card that was
    // merely sitting on the board when the user clicked it.
    clipFor: (row) =>
      isReferralCancelled(row)
        ? "cancelled"
        : isIncomingReferral(row)
          ? "referral"
          : null,
  });

  return null;
}
