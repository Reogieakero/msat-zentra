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
import { GUIDANCE_RISK_ALERT_EVENT, isSelfNotified } from "@/lib/realtime/guidanceChannel";
import { markRealtimeUpdate } from "@/lib/api/fresh";

/**
 * Headless risk-alert monitor for the guidance shell.
 *
 * Rings `/sounds/risk alert.mp3` automatically and prefixes the browser tab
 * title with the live High/Moderate count whenever guidance work changes: a new
 * at-risk learner from the engine, a new/updated referral, an intervention or
 * counseling-session move. Two independent triggers feed it, so it survives
 * either one being unavailable:
 *
 *  - the realtime channel (`GUIDANCE_RISK_ALERT_EVENT`), which fires from
 *    WebSocket frames — not throttled while the tab is hidden, so the sound
 *    still plays when the counselor is on another page or another site;
 *  - the live High/Moderate counter poll, which also runs while hidden and
 *    covers an engine detection that produced no notification row.
 *
 * Browsers only allow programmatic audio after a user gesture — the first
 * click/key anywhere on the desk primes the element so later background alerts
 * can sound.
 */

const SOUND_SRC = "/sounds/risk%20alert.mp3";
const COUNT_POLL_MS = 10_000;
/** Shares the sidebar dot's `/guidance/nav-counts` query — its 5s poll drives
 *  both the dot and this monitor's "something changed" detection. */
const NAV_POLL_MS = 5_000;
/** Only the actionable queues ring; derived pages (insights/anecdotal/overview)
 *  must not produce a second sound for the same underlying change. */
const SOUND_QUEUES = new Set<keyof GuidanceNavQueues>(["alerts", "interventions"]);
/** One ring per burst — the hourly sweep can flag several learners at once. */
const MIN_REPLAY_MS = 12_000;
const TITLE_PREFIX = /^\(\d+\+?\)\s*/;

export function GuidanceRiskAlertMonitor() {
  const queryClient = useQueryClient();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const unlockedRef = React.useRef(false);
  const lastPlayedRef = React.useRef(0);
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

  // Create the audio element and unlock playback on the first user gesture.
  React.useEffect(() => {
    const audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 0.9;
    audioRef.current = audio;

    const unlockOpts: AddEventListenerOptions = { capture: true };
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {
          /* Autoplay still blocked — the gesture listener stays gone. */
        });
    };
    window.addEventListener("pointerdown", unlock, unlockOpts);
    window.addEventListener("keydown", unlock, unlockOpts);

    return () => {
      window.removeEventListener("pointerdown", unlock, unlockOpts);
      window.removeEventListener("keydown", unlock, unlockOpts);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const play = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Never restart/overlap a clip that is already ringing — one update must be
    // one sound even when several triggers (realtime frame + poll + counter)
    // report the same change.
    if (!audio.paused) return;
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

  // Any badge-visible change refreshes the page it belongs to *and* rings the
  // alert sound. The sound used to follow only the High/Moderate risk total, so
  // referral/intervention/document updates never rang even though a badge lit.
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
    let ring = false;
    for (const [queue, entries] of next) {
      const before = previous.get(queue) ?? new Map<string, string>();
      let queueChanged = false;
      let nonSelf = false;
      for (const [id, version] of entries) {
        if (before.get(id) === version) continue;
        queueChanged = true;
        // The counselor's own save already refreshed its board; only somebody
        // else's change deserves the sound.
        if (!isSelfNotified(id)) nonSelf = true;
      }
      // A case leaving the queue (resolved/moved) changes the board too, but it
      // is not a "new work" alert — refresh the page without ringing.
      if (!queueChanged && entries.size !== before.size) queueChanged = true;
      if (queueChanged) changed.push(queue);
      if (nonSelf && SOUND_QUEUES.has(queue)) ring = true;
    }
    if (changed.length === 0) return;

    markRealtimeUpdate();
    for (const queue of changed) {
      for (const key of NAV_QUEUE_QUERY_KEYS[queue]) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }
    if (ring) play();
  }, [navQuery.data, play, queryClient]);

  // Ring once per detection burst, keep the tab title in sync, and pull the
  // at-risk boards forward so `/guidance/interventions` shows the new learner at
  // the same moment the sound rings instead of waiting out its own poll.
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
      if (total > previous) play();
    }
  }, [countsQuery.isSuccess, total, play, queryClient]);

  React.useEffect(() => {
    const base = document.title.replace(TITLE_PREFIX, "");
    const next = total > 0 ? `(${total}) ${base}` : base;
    if (document.title !== next) document.title = next;
    return () => {
      document.title = base;
    };
  }, [total]);

  React.useEffect(() => {
    const onAlert = () => play();
    window.addEventListener(GUIDANCE_RISK_ALERT_EVENT, onAlert);
    return () => window.removeEventListener(GUIDANCE_RISK_ALERT_EVENT, onAlert);
  }, [play]);

  return null;
}
