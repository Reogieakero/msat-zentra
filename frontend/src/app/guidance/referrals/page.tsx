"use client";

import { GuidanceReferralsView } from "./components/guidance-referrals-view";

/**
 * All referrals to guidance — kept for existing entry points (overview,
 * alerts, risk pages) that link here without knowing the track. The
 * sidebar's ADM Cases / Counseling Cases pages are the track-split views.
 */
export default function GuidanceReferralsPage() {
  return <GuidanceReferralsView />;
}
