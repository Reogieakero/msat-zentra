"use client";
export const MAX_SUGGESTIONS = 6;
export function matchByName<T extends { name: string }>(rows: T[], query: string): T | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return rows.find((r) => r.name.toLowerCase() === q);
}
export function suggestByName<T extends { id: string; name: string }>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return rows.filter((r) => r.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
}
