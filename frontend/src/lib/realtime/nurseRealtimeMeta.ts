/**
 * Shared realtime bookkeeping for the nurse desk.
 *
 * - `markNurseLocalMutation` is called on every confirmed local mutation
 *   success so inbound realtime events within a short window are treated as
 *   echoes of our own write (initiator already toasted locally → skip toast).
 * - `seenRealtimeEvent` deduplicates redelivered postgres_changes payloads
 *   by event key (table + row id + commit timestamp).
 */

let lastLocalMutationAt = 0;

export function markNurseLocalMutation(): void {
  lastLocalMutationAt = Date.now();
  try {
    (window as unknown as { __nurseLocalMutationAt?: number }).__nurseLocalMutationAt =
      lastLocalMutationAt;
  } catch {
    /* storage unavailable — module timestamp still applies */
  }
}

export function wasRecentLocalMutation(windowMs = 5000): boolean {
  try {
    const w = (window as unknown as { __nurseLocalMutationAt?: number })
      .__nurseLocalMutationAt;
    if (typeof w === "number" && Date.now() - w < windowMs) return true;
  } catch {
    /* ignore */
  }
  return Date.now() - lastLocalMutationAt < windowMs;
}

const seen = new Map<string, number>();
const SEEN_TTL_MS = 15_000;
const SEEN_MAX = 500;

export function seenRealtimeEvent(key: string): boolean {
  const now = Date.now();
  // Opportunistic expiry so the map never grows unbounded.
  if (seen.size > SEEN_MAX) {
    for (const [k, t] of seen) {
      if (now - t > SEEN_TTL_MS) seen.delete(k);
      if (seen.size <= SEEN_MAX) break;
    }
  }
  const prev = seen.get(key);
  if (prev !== undefined && now - prev < SEEN_TTL_MS) return true;
  seen.set(key, now);
  return false;
}

export function realtimeEventKey(
  table: string,
  eventType: string,
  rowId: string | null,
  commitTimestamp: string | null
): string {
  return `${table}:${eventType}:${rowId ?? "?"}:${commitTimestamp ?? "?"}`;
}
