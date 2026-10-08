"use client";
export const typedCache = new Map<string, string>();
export function scoreDraftKey(teacherId: string, assessmentId: string) {
  return `zentra.score-drafts.${teacherId}.${assessmentId}`;
}
export function readStoredDrafts(teacherId: string, assessmentId: string): { scores: Record<string, string>; max: string | null } {
  try {
    if (typeof window === "undefined") return { scores: {}, max: null };
    const raw = window.localStorage.getItem(scoreDraftKey(teacherId, assessmentId));
    if (!raw) return { scores: {}, max: null };
    const parsed = JSON.parse(raw) as { scores?: Record<string, string>; max?: string | null };
    if (parsed && typeof parsed === "object") {
      return { scores: parsed.scores ?? {}, max: parsed.max ?? null };
    }
  } catch {
  }
  return { scores: {}, max: null };
}
export function writeStoredDrafts(teacherId: string, assessmentId: string, scores: Record<string, string>, max: string | null) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(scoreDraftKey(teacherId, assessmentId), JSON.stringify({ scores, max }));
  } catch {
  }
}
export function clearStoredDrafts(teacherId: string, assessmentId: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(scoreDraftKey(teacherId, assessmentId));
  } catch {
  }
}
