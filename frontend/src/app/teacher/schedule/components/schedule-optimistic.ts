// Placeholder rows painted by the optimistic add flows carry ids that start
// with this prefix until the server row lands. Deleting one before it settles
// would otherwise 404 (and the server row would pop back into the list), so the
// delete hooks mark the placeholder cancelled here and the add mutations
// compensate by removing the real row instead of inserting it.
const OPTIMISTIC_PREFIX = "optimistic-";
const cancelled = new Set<string>();

export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

export function markOptimisticCancelled(id: string): void {
  if (isOptimisticId(id)) cancelled.add(id);
}

export function consumeOptimisticCancelled(id: string): boolean {
  if (!cancelled.has(id)) return false;
  cancelled.delete(id);
  return true;
}
