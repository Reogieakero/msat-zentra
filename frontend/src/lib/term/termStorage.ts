/**
 * Term persistence.
 *
 * The active term is stored PER USER (`zentra.activeTerm.<userId>`), not in a
 * single shared slot, so one account's selection can never leak into another
 * account on the same browser. Only teacher role code ever writes here — the
 * request interceptor and the term UI are teacher-gated.
 *
 * The legacy shared key `zentra.activeTerm` is deliberately never read (it
 * cannot be attributed to an account) and is purged on mount/logout.
 */

export interface StoredTerm {
  schoolYearId: string;
  schoolYearName: string;
  termId: string;
  termNumber: number;
}

export const TERM_PROMPT_KEY = "zentra.termPrompt";
const LEGACY_TERM_KEY = "zentra.activeTerm";

function keyForUser(userId: string): string {
  return `zentra.activeTerm.${userId}`;
}

export function readStoredTerm(userId: string | null | undefined): StoredTerm | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTerm;
    if (!parsed.schoolYearId || !parsed.termId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredTerm(userId: string | null | undefined, term: StoredTerm): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(keyForUser(userId), JSON.stringify(term));
  } catch {
  }
}

export function readTermPrompt(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TERM_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTermPrompt(required: boolean): void {
  try {
    if (required) window.localStorage.setItem(TERM_PROMPT_KEY, "1");
    else window.localStorage.removeItem(TERM_PROMPT_KEY);
  } catch {
  }
}

/** Drops the legacy shared key, which predates per-user storage. */
export function purgeLegacyTermStorage(): void {
  try {
    window.localStorage.removeItem(LEGACY_TERM_KEY);
  } catch {
  }
}

/**
 * Clears term state for a signed-out user: their stored term (when the user
 * id is known), the prompt flag, and the legacy shared key.
 */
export function clearTermStorage(userId?: string | null): void {
  try {
    if (userId) window.localStorage.removeItem(keyForUser(userId));
    window.localStorage.removeItem(LEGACY_TERM_KEY);
    window.localStorage.removeItem(TERM_PROMPT_KEY);
  } catch {
  }
}
