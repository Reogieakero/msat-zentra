"use client";

import { GuidanceReferralsView } from "../components/guidance-referrals-view";

/**
 * ADM Cases — every ADM-track referral sent to guidance, newest first.
 * Locked to the ADM track so no track filter is needed.
 */
export default function GuidanceAdmReferralsPage() {
  return <GuidanceReferralsView lockedType="ADM" title="ADM Cases" />;
}
