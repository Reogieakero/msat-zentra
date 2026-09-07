/**
 * Shared local-persistence key for the referrals workflow card: the canvas
 * reopens on the last student referral the teacher viewed. Imported by the
 * referrals page and by surfaces that deep-link into it (e.g. ADM cases).
 */
export const LAST_VIEWED_REFERRAL_KEY = "teacher-advisory-referrals:lastViewedId";

export function readLastViewedReferralId(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LAST_VIEWED_REFERRAL_KEY);
  } catch {
    return null;
  }
}

export function writeLastViewedReferralId(id: string): void {
  try {
    window.localStorage.setItem(LAST_VIEWED_REFERRAL_KEY, id);
  } catch {
    // Private-mode storage failures must never break the page.
  }
}
