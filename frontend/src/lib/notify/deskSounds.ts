"use client";

/**
 * Desk alert sounds.
 *
 * The receiving desks (guidance, nurse, ADM coordinator, principal) ring a
 * short clip the moment work changes for them — `/sounds/referrals.mp3` for a
 * new referral, `/sounds/cancelled referral.mp3` when the filing teacher
 * withdraws one, `/sounds/risk alert.mp3` for a risk intervention on the
 * guidance desk, `/sounds/ADVISER RISK ALERT.mp3` when one of an adviser's
 * own advisees is flagged at risk, and
 * `/sounds/intervention session alert booked.mp3` /
 * `/sounds/intervention resched.mp3` / `/sounds/intervention cancelled.mp3`
 * when guidance books, moves or cancels an intervention session for one of the
 * adviser's advisees. The adviser desk also mirrors the referral pipeline it
 * filed: `/sounds/guidance%20create%20referral.mp3` when guidance endorses the
 * ADM consultation (the referral is created and moves forward),
 * `/sounds/cancelled%20referral.mp3` when it rejects/closes the case, and
 * `/sounds/guidance%20adm%20booked%20session.mp3` when guidance books a session
 * on the ADM case, and `/sounds/guidance%20adm%20reschedule.mp3` when it moves
 * that session; session messages on a
 * counseling referral ring the same
 * booked/rescheduled/cancelled clips as interventions. The ADM confirmation
 * clips (`/sounds/guidance adm booked session.mp3`,
 * `/sounds/guidance adm reschedule.mp3`,
 * `/sounds/guidance create referral.mp3`, `/sounds/guidance adm reject.mp3`)
 * belong to the **adviser's** desk only — the guidance desk stays silent on its
 * own ADM actions.
 * Everything
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
  adviserSession: "/sounds/intervention%20session%20alert%20booked.mp3",
  adviserSessionResched: "/sounds/intervention%20resched.mp3",
  adviserSessionCancelled: "/sounds/intervention%20cancelled.mp3",
  // Adviser-side referral pipeline (guidance acts on a referral the teacher
  // filed): the endorsement rings the "referral created" confirmation, and a
  // closure reuses the cancelled-referral clip.
  adviserReferralUpdate: "/sounds/guidance%20create%20referral.mp3",
  adviserReferralClosed: "/sounds/cancelled%20referral.mp3",
  // ADM desk actions — adviser-only. The filing teacher hears the
  // confirmation; the guidance desk stays silent on its own action.
  adviserAdmBooked: "/sounds/guidance%20adm%20booked%20session.mp3",
  adviserAdmRejected: "/sounds/guidance%20adm%20reject.mp3",
  adviserAdmRescheduled: "/sounds/guidance%20adm%20reschedule.mp3",
  // Clinic (nurse) desk actions on the same ADM track — the nurse desk reviews
  // the case before guidance, so the adviser hears the clinic variants of the
  // four ADM confirmations. Still adviser-only; the acting desk stays silent.
  adviserAdmBookedClinic: "/sounds/nurse_adm_booked_session.mp3",
  adviserAdmRejectedClinic: "/sounds/nurse_adm_reject.mp3",
  adviserAdmRescheduledClinic: "/sounds/nurse_adm_reschedule.mp3",
  adviserAdmEndorsedClinic: "/sounds/nurse_create_referral.mp3",
  // Counseling desk actions on a referral the teacher filed — adviser-only,
  // one clip per action so a counseling case never sounds like an ADM or an
  // intervention one.
  adviserCounselingBooked: "/sounds/guidance%20counseling%20session.mp3",
  adviserCounselingRejected: "/sounds/guidance%20counseling%20reject.mp3",
  adviserCounselingRescheduled: "/sounds/guidance%20counseling%20reschedule.mp3",
  // Clinic (nurse) desk on a **clinic** referral — the adviser hears the nurse
  // variants so a clinic case never sounds like a guidance counseling one.
  adviserClinicBooked: "/sounds/nurse_clinic_session.mp3",
  adviserClinicRejected: "/sounds/nurse_clinic_reject.mp3",
  adviserClinicRescheduled: "/sounds/nurse_clinic_reschedule.mp3",
} as const;

export type DeskSound = keyof typeof SOURCES;

/** One ring per burst — a fanout can produce several rows for the same event. */
const MIN_REPLAY_MS: Record<DeskSound, number> = {
  referral: 8_000,
  cancelled: 8_000,
  risk: 12_000,
  adviserRisk: 12_000,
  adviserSession: 12_000,
  adviserSessionResched: 12_000,
  adviserSessionCancelled: 12_000,
  adviserReferralUpdate: 12_000,
  adviserReferralClosed: 12_000,
  adviserAdmRejected: 8_000,
  adviserAdmBooked: 8_000,
  adviserAdmRescheduled: 8_000,
  adviserAdmRejectedClinic: 8_000,
  adviserAdmBookedClinic: 8_000,
  adviserAdmRescheduledClinic: 8_000,
  adviserAdmEndorsedClinic: 8_000,
  adviserCounselingBooked: 8_000,
  adviserCounselingRejected: 8_000,
  adviserCounselingRescheduled: 8_000,
  adviserClinicBooked: 8_000,
  adviserClinicRejected: 8_000,
  adviserClinicRescheduled: 8_000,
};

const players = new Map<DeskSound, HTMLAudioElement>();
const lastPlayed = new Map<DeskSound, number>();
let unlockBound = false;
/** True once the page has seen any pointer/key gesture (audio is unlocked). */
let gestureSeen = false;
/**
 * Clips requested before the page saw its first gesture. Browsers reject
 * `play()` until then, so a live arrival on a page nobody has clicked yet used
 * to be dropped entirely (the desk looked silent while its data updated). The
 * request is parked here and rings on the unlocking gesture instead.
 */
const pendingUntilGesture = new Map<DeskSound, number>();
/** A parked clip older than this is stale work, not an alert — drop it. */
const PENDING_MAX_AGE_MS = 90_000;
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
  watchClip(audio);
}

export function unregisterDeskSoundClip(audio: HTMLAudioElement) {
  registeredClips.delete(audio);
  unwatchClip(audio);
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

/**
 * True while an *audible* clip is ringing. The mute-probe that unlocks autoplay
 * (volume 0, played for a frame) is not a real alert, so the tab badge below
 * ignores it.
 */
function isDeskSoundAudible(): boolean {
  for (const audio of [...registeredClips, ...players.values()]) {
    if (!audio.paused && !audio.muted && audio.volume > 0) return true;
  }
  return false;
}

/**
 * Subscribe to "a desk clip started / stopped ringing". Used by the tab badge
 * to show the speaker icon only while a sound is actually playing.
 */
const playingListeners = new Set<(playing: boolean) => void>();
let lastPlayingState = false;

function notifyPlayingState() {
  const playing = isDeskSoundAudible();
  if (playing === lastPlayingState) return;
  lastPlayingState = playing;
  for (const listener of playingListeners) listener(playing);
}

export function subscribeDeskSoundPlaying(
  listener: (playing: boolean) => void
): () => void {
  playingListeners.add(listener);
  // Sync the newcomer immediately so a clip already ringing shows up.
  listener(lastPlayingState || isDeskSoundAudible());
  return () => {
    playingListeners.delete(listener);
  };
}

const clipWatchCleanups = new WeakMap<HTMLAudioElement, () => void>();

function watchClip(audio: HTMLAudioElement) {
  if (clipWatchCleanups.has(audio)) return;
  const sync = () => notifyPlayingState();
  for (const event of ["play", "playing", "pause", "ended", "emptied", "volumechange"]) {
    audio.addEventListener(event, sync);
  }
  clipWatchCleanups.set(audio, () => {
    for (const event of ["play", "playing", "pause", "ended", "emptied", "volumechange"]) {
      audio.removeEventListener(event, sync);
    }
  });
}

function unwatchClip(audio: HTMLAudioElement) {
  clipWatchCleanups.get(audio)?.();
  clipWatchCleanups.delete(audio);
}

function createPlayer(kind: DeskSound): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const audio = new Audio(SOURCES[kind]);
  audio.preload = "auto";
  audio.volume = 0.9;
  players.set(kind, audio);
  watchClip(audio);
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
    flushPendingSounds();
  };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
}

/** Ring anything that arrived before audio was unlocked (one clip at a time). */
function flushPendingSounds() {
  if (pendingUntilGesture.size === 0) return;
  const now = Date.now();
  const due = [...pendingUntilGesture.entries()]
    .filter(([, at]) => now - at < PENDING_MAX_AGE_MS)
    .map(([kind]) => kind);
  pendingUntilGesture.clear();
  if (due.length === 0) return;
  // Let the muted unlock probe settle so the one-clip bus is free.
  window.setTimeout(() => {
    for (const kind of due) playDeskSound(kind);
  }, 150);
}

/** Ring a desk sound, throttled per clip so one event is one sound. */
export function playDeskSound(kind: DeskSound) {
  if (typeof window === "undefined") return;
  // A desk never rings another desk's clip — the guidance desk must not reach
  // for the adviser alert, and an adviser desk must never ring the guidance
  // alarm. `primeDeskSounds` decides which clips this page owns.
  if (!ownedKinds.has(kind)) return;
  if (!gestureSeen) {
    // Park it — `primeDeskSounds` rings it on the first gesture.
    pendingUntilGesture.set(kind, Date.now());
    return;
  }
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
 * True when a notification row means "guidance just scheduled an intervention
 * session for one of this adviser's own advisees". The adviser's session clip is
 * only for a booking (or the first session attached to a newly opened
 * follow-up) — plan reviews, assignments and completions share the server's
 * `intervention_session` type and must not ring it (moves and cancellations have
 * their own clips below).
 */
export function isAdviserSessionBooked(row: {
  type?: string | null;
  message?: string | null;
}): boolean {
  if ((row.type ?? "").toLowerCase() !== "intervention_session") return false;
  const message = row.message ?? "";
  if (/^(you|your)\b/i.test(message)) return false;
  return (
    /\bbooked an intervention session\b/i.test(message) ||
    /\bopened a follow-up\b/i.test(message)
  );
}

/**
 * True when a notification row means "guidance moved an intervention session
 * for one of this adviser's own advisees" — the adviser rings the reschedule
 * clip instead of the booking one.
 */
export function isAdviserSessionRescheduled(row: {
  type?: string | null;
  message?: string | null;
}): boolean {
  if ((row.type ?? "").toLowerCase() !== "intervention_session") return false;
  const message = row.message ?? "";
  if (/^(you|your)\b/i.test(message)) return false;
  return /\brescheduled an intervention session\b/i.test(message);
}

/**
 * True when a notification row means "guidance dropped an intervention session
 * for one of this adviser's own advisees" — a distinct clip so the adviser hears
 * that the confirmed slot is gone instead of a booking sound.
 */
export function isAdviserSessionCancelled(row: {
  type?: string | null;
  message?: string | null;
}): boolean {
  if ((row.type ?? "").toLowerCase() !== "intervention_session") return false;
  const message = row.message ?? "";
  if (/^(you|your)\b/i.test(message)) return false;
  return /\bcancelled an intervention session\b/i.test(message);
}

/**
 * True when a notification row means "guidance endorsed the ADM consultation
 * this teacher filed" — the referral form was created/confirmed and the case
 * moves forward to the coordinator. The adviser desk rings the "referral
 * created" confirmation clip; the guidance desk stays silent.
 */
export function isAdviserReferralEndorsed(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return (
    /\bendorsed the ADM consultation\b/i.test(message) ||
    /\bADM consultation endorsed\b/i.test(message)
  );
}

/**
 * True when a notification row means "guidance rejected / dismissed the ADM
 * referral this teacher filed". ADM rejections have their own clip
 * (`adviserAdmRejected`); every other closure keeps the cancelled-referral clip.
 * Check this **before** `isAdviserReferralClosed` — a rejected ADM case also
 * matches that broader classifier.
 */
export function isAdviserAdmRejected(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return (
    /\bADM referral\b/i.test(message) &&
    /\b(?:not endorsed|rejected|dismissed|closed)\b/i.test(message)
  );
}

/**
 * True when a notification row means "guidance booked an ADM consultation
 * session on the ADM case this teacher filed" (booked without endorsing yet).
 * ADM bookings ring their own clip (`adviserAdmBooked`), so check this
 * **before** `isAdviserReferralSessionBooked`.
 */
export function isAdviserAdmBooked(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bbooked an ADM consultation session for\b/i.test(message);
}

/**
 * True when a notification row means "guidance moved the ADM consultation
 * session on the ADM case this teacher filed". ADM moves ring their own clip
 * (`adviserAdmRescheduled`), so check this **before**
 * `isAdviserReferralSessionRescheduled`.
 */
export function isAdviserAdmRescheduled(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\brescheduled an ADM consultation session for\b/i.test(message);
}

/**
 * Clinic-desk variants of the four ADM confirmations. The nurse desk reviews the
 * ADM case before guidance, and its fanout messages are prefixed with
 * "(Clinic)" / "Clinic" (or say "by the clinic") so the filing adviser hears the
 * `nurse_adm_*` clips instead of the guidance ones. Check these **before** their
 * guidance counterparts — every clinic row also matches the generic classifier.
 */
export function isAdviserAdmBookedClinic(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return (
    /\(Clinic\)\s+booked an ADM consultation session for\b/i.test(message) ||
    /\bClinic booked an ADM consultation session for\b/i.test(message)
  );
}

export function isAdviserAdmRescheduledClinic(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bClinic rescheduled an ADM consultation session for\b/i.test(message);
}

export function isAdviserAdmRejectedClinic(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bADM referral for .+? was not endorsed by the clinic\b/i.test(message);
}

export function isAdviserAdmEndorsedClinic(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return (
    /\(Clinic\)\s+endorsed the ADM consultation\b/i.test(message) ||
    /\bADM referral for .+? was endorsed by the clinic\b/i.test(message)
  );
}

/**
 * True when a notification row means "guidance booked a **counseling** session
 * on the referral this teacher filed". Counseling bookings ring their own clip
 * (`adviserCounselingBooked`) instead of the ADM / intervention ones, so check
 * this **before** the generic session classifiers.
 */
export function isAdviserCounselingBooked(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bbooked a counseling session for\b/i.test(message);
}

/**
 * True when a notification row means "guidance moved the **counseling** session
 * on the referral this teacher filed". Check before the generic session
 * reschedule classifier.
 */
export function isAdviserCounselingRescheduled(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\brescheduled a counseling session for\b/i.test(message);
}

/**
 * True when a notification row means "guidance rejected / dismissed the
 * **counseling** referral this teacher filed". Check before
 * `isAdviserReferralClosed` — a rejected counseling case also matches that
 * broader classifier.
 */
export function isAdviserCounselingRejected(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bcounseling referral for .+? was (?:dismissed|rejected|closed)\b/i.test(message);
}

/**
 * Clinic (nurse) desk variants for a **clinic** referral the teacher filed.
 * Same one-clip-per-action rule as the counseling set, so a clinic case never
 * rings the guidance clips. Check these **before** the counseling/generic
 * classifiers — the clinic wording also matches the generic ones.
 */
export function isAdviserClinicBooked(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return (
    /\(Clinic\)\s+booked a session for\b/i.test(message) ||
    // Accepting a clinic case can book the first session in the same action —
    // that is a booking from the adviser's point of view, so it rings the
    // same clinic-session clip.
    /\bclinic accepted your referral for .+? with a first session\b/i.test(message)
  );
}

export function isAdviserClinicRescheduled(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bClinic rescheduled a session for\b/i.test(message);
}

export function isAdviserClinicRejected(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return (
    /\bclinic referral for .+? was (?:dismissed|rejected|closed)\b/i.test(message) ||
    /\bClinic (?:rejected|dismissed|closed) your referral for\b/i.test(message)
  );
}

/**
 * True when a notification row means "guidance rejected / closed the referral
 * this teacher filed" (ADM consultation not endorsed, or a desk dismissed it).
 * The adviser desk rings the cancelled-referral clip.
 */
export function isAdviserReferralClosed(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return (
    /\bnot endorsed\b/i.test(message) ||
    /\breferral for .+? was (?:dismissed|closed)\b/i.test(message) ||
    /\bcase closed\b/i.test(message)
  );
}

/**
 * True when a notification row means "guidance/nurse booked a session on the
 * referral this teacher filed" (an ADM consultation or a clinic/counseling
 * session). Referral sessions are not published to the adviser over realtime
 * (`counseling_session_visible` is intervention-scoped), so this notification
 * is the adviser's delivery path for the booking clip.
 *
 * ADM-track bookings have their own clip — check `isAdviserAdmBooked` first.
 */
export function isAdviserReferralSessionBooked(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bbooked (?:a|an) (?:clinic |guidance )?session for\b/i.test(message);
}

/**
 * True when guidance/nurse moved a session on the teacher's own referral.
 * ADM-track moves have their own clip — check `isAdviserAdmRescheduled` first.
 */
export function isAdviserReferralSessionRescheduled(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\brescheduled (?:a|an) (?:clinic |guidance )?session for\b/i.test(message);
}

/** True when guidance/nurse dropped a session on the teacher's own referral. */
export function isAdviserReferralSessionCancelled(row: {
  sourceTable?: string | null;
  message?: string | null;
}): boolean {
  if (row.sourceTable !== "referrals") return false;
  const message = row.message ?? "";
  if (/^you\b/i.test(message)) return false;
  return /\bcancelled (?:a|an) (?:clinic |guidance )?session for\b/i.test(message);
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
