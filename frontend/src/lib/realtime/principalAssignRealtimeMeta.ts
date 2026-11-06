let lastLocalMutationAt = 0;
const WINDOW_KEY = "__principalAssignLocalMutationAt";

export function markPrincipalAssignLocalMutation(): void {
  lastLocalMutationAt = Date.now();
  try {
    (window as unknown as { [WINDOW_KEY]?: number })[WINDOW_KEY] = lastLocalMutationAt;
  } catch {
  }
}

export function wasRecentPrincipalAssignMutation(windowMs = 5000): boolean {
  try {
    const w = (window as unknown as { [WINDOW_KEY]?: number })[WINDOW_KEY];
    if (typeof w === "number" && Date.now() - w < windowMs) return true;
  } catch {
  }
  return Date.now() - lastLocalMutationAt < windowMs;
}
