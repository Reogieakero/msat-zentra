"use client";

/**
 * Desk alert sounds.
 *
 * The receiving desks (guidance, nurse, ADM coordinator, principal) ring a
 * short clip the moment work changes for them — `/sounds/referrals.mp3` for a
 * new referral, `/sounds/cancelled referral.mp3` when the filing teacher
 * withdraws one, `/sounds/risk alert.mp3` for a risk intervention on the
 * guidance desk, and `/sounds/ADVISER RISK ALERT.mp3` when one of an adviser's
 * own advisees is flagged at risk. Everything
 * is module-level so several realtime channels (or a route change) share one
 * player per clip instead of stacking overlapping Audio elements.
 *
 * Browsers block programmatic audio until the user interacts with the page, so
 * each desk primes the players through `primeDeskSounds()` (called from the
 * realtime channel effect) and the first click/keypress unlocks them.
 *
 * Each desk only primes (and can only ring) the clips it actually owns: the
 * guidance desk never loads or plays `/sounds/ADVISER RISK ALERT.mp3`, and an
 * adviser desk never loads or plays the guidance `/sounds/risk alert.mp3`.
 * `playDeskSound` refuses a kind this page did not prime, so a stray event from
 * another desk's code cannot make the wrong clip audible.
 */

const SOURCES = {
  referral: "/sounds/referrals.mp3",
  cancelled: "/sounds/cancelled%20referral.mp3",
  risk: "/sounds/risk%20alert.mp3",
  adviserRisk: "/sounds/ADVISER%20RISK%20ALERT.mp3",
} as const;

export type DeskSound = keyof typeof SOURCES;

/** One ring per burst — a fanout can produce several rows for the same event. */
const MIN_REPLAY_MS: Record<DeskSound, number> = {
  referral: 8_000,
  cancelled: 8_000,
  risk: 12_000,
  adviserRisk: 12_000,
};

const players = new Map<DeskSound, HTMLAudioElement>();
const lastPlayed = new Map<DeskSound, number>();
let unlockBound = false;
/** True once the page has seen any pointer/key gesture (audio is unlocked). */
let gestureSeen = false;
/**
 * Clips this page is allowed to ring. Replaced on every `primeDeskSounds` call
 * so a desk owns exactly the clips it passes — the guidance desk never reaches
 * for the adviser alert, and vice versa.
 */
let ownedKinds = new Set<DeskSound>();

/** Whether playback is allowed yet — the login catch-up ring waits for this. */
export function hasDeskSoundGesture(): boolean {
  return gestureSeen;
}

/**
 * Every desk clip on the page (this module's players plus any owned by a
 * shell, e.g. the guidance monitor). Only one may ring at a time — a referral
 * and a risk alert landing together must not talk over each other.
 */
const registeredClips = new Set<HTMLAudioElement>();

/** Let a shell-owned clip join the one-at-a-time audio bus. */
export function registerDeskSoundClip(audio: HTMLAudioElement) {
  registeredClips.add(audio);
}

export function unregisterDeskSoundClip(audio: HTMLAudioElement) {
  registeredClips.delete(audio);
}

/** True while any desk clip is still ringing. */
export function isDeskSoundPlaying(): boolean {
  for (const audio of registeredClips) {
    if (!audio.paused) return true;
  }
  for (const audio of players.values()) {
    if (!audio.paused) return true;
  }
  return false;
}

function createPlayer(kind: DeskSound): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const audio = new Audio(SOURCES[kind]);
  audio.preload = "auto";
  audio.volume = 0.9;
  players.set(kind, audio);
  return audio;
}

function unlockAll() {
  for (const audio of players.values()) {
    if (!audio.paused) continue;
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
        // Still blocked — the next gesture retries.
        audio.volume = volume;
      });
  }
}

/**
 * Create the clips this desk owns and arm the gesture unlock. Safe to call
 * repeatedly (every realtime channel effect calls it on mount).
 *
 * Pass only the clips the desk rings — nothing else is preloaded or unlocked,
 * which is what keeps `/sounds/ADVISER RISK ALERT.mp3` off the guidance desk.
 */
export function primeDeskSounds(kinds: readonly DeskSound[]) {
  if (typeof window === "undefined") return;
  ownedKinds = new Set(kinds);
  for (const kind of ownedKinds) {
    if (!players.has(kind)) createPlayer(kind);
  }
  if (unlockBound) return;
  unlockBound = true;
  const opts: AddEventListenerOptions = { capture: true };
  const unlock = () => {
    gestureSeen = true;
    unlockAll();
    window.removeEventListener("pointerdown", unlock, opts);
    window.removeEventListener("keydown", unlock, opts);
  };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
}

/** Ring a desk sound, throttled per clip so one event is one sound. */
export function playDeskSound(kind: DeskSound) {
  if (typeof window === "undefined") return;
  // A desk never rings another desk's clip — the guidance desk must not reach
  // for the adviser alert, and an adviser desk must never ring the guidance
  // alarm. `primeDeskSounds` decides which clips this page owns.
  if (!ownedKinds.has(kind)) return;
  const audio = players.get(kind) ?? createPlayer(kind);
  if (!audio) return;
  // One clip at a time across every desk sound, not just this kind.
  if (isDeskSoundPlaying()) return;
  const now = Date.now();
  if (now - (lastPlayed.get(kind) ?? 0) < MIN_REPLAY_MS[kind]) return;
  lastPlayed.set(kind, now);
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // No gesture yet or audio policy — the next detection retries.
    });
  } catch {
    /* ignore */
  }
}

/**
 * True when `kind` rang within `windowMs`. The guidance nav-count monitor uses
 * this to stay quiet while the dedicated referral clip is already playing for
 * the same event (a referral also bumps the alerts/interventions badges).
 */
export function deskSoundPlayedWithin(kind: DeskSound, windowMs: number): boolean {
  return Date.now() - (lastPlayed.get(kind) ?? 0) < windowMs;
}

/**
 * True when a notification row means "a referral was withdrawn from this desk"
 * (the filing teacher cancelled it). The desk already received the case, so it
 * rings the same referral clip the arrival used.
 */
export function isReferralCancelled(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^(you|your)\b/i.test(message)) return false;
  return /\b(withdrawn|cancell?ed|dismissed)\b/i.test(message);
}

/**
 * True when a notification row means "a referral just landed on this desk"
 * (as opposed to a status echo of the user's own action).
 */
export function isIncomingReferral(row: {
  type?: string | null;
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  // "You …"/"Your …" rows are the actor's own confirmation, never an arrival.
  if (/^(you|your)\b/i.test(message)) return false;
  if (row.type === "new_adm_referral") return true;
  return (
    /\breferr(ed|al)\b/i.test(message) &&
    /(to you|to the|to adm|needs consultation)/i.test(message)
  );
}
