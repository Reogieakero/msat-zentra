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

  }
}
