/**
 * Realtime freshness window.
 *
 * A write's Redis cache-tag invalidation and its notification fanout are both
 * fire-and-forget on the backend, so a board that refetches the instant the
 * realtime notification (or risk detection) arrives can lose the race and read
 * the pre-write payload — the sound rings but the row shows up a poll later.
 *
 * The realtime channels open this window just before they invalidate their
 * queries; the API client then sends `x-zentra-fresh: 1` on every GET, which
 * makes the cache middleware skip its read (and overwrite the entry with the
 * fresh body). After the window, normal caching resumes — polls stay cheap.
 */
const FRESH_WINDOW_MS = 10_000;

let freshUntil = 0;

/** Open (or extend) the cache-bypass window. Called by the realtime channels. */
export function markRealtimeUpdate() {
  freshUntil = Date.now() + FRESH_WINDOW_MS;
}

/** True while a realtime event says the server data just changed. */
export function isRealtimeFresh(): boolean {
  return Date.now() < freshUntil;
}
