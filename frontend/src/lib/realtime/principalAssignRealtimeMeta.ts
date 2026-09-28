/**
 * Realtime bookkeeping for the principal assignment desk.
 * Mirrors nurseRealtimeMeta: the initiator toasts from the mutation response,
 * so inbound Section events inside the echo window are treated as echoes of
 * our own write and merged silently (never re-toasted, never refetched).
 */

let lastLocalMutationAt = 0;
const WINDOW_KEY = "__principalAssignLocalMutationAt";

export function markPrincipalAssignLocalMutation(): void {
  lastLocalMutationAt = Date.now();
  try {
    (window as unknown as { [WINDOW_KEY]?: number })[WINDOW_KEY] = lastLocalMutationAt;
  } catch {
    /* storage unavailable — module timestamp still applies */
  }
}

export function wasRecentPrincipalAssignMutation(windowMs = 5000): boolean {
  try {
    const w = (window as unknown as { [WINDOW_KEY]?: number })[WINDOW_KEY];
    if (typeof w === "number" && Date.now() - w < windowMs) return true;
  } catch {
    /* ignore */
  }
  return Date.now() - lastLocalMutationAt < windowMs;
}
