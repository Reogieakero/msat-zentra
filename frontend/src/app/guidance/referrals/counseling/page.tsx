"use client";

import { GuidanceReferralsView } from "../components/guidance-referrals-view";

/**
 * Counseling Cases — every counseling-track referral sent to guidance,
 * newest first. Locked to the Counseling track so no track filter is
 * needed.
 */
export default function GuidanceCounselingReferralsPage() {
  return <GuidanceReferralsView lockedType="Counseling" title="Counseling Cases" />;
}
