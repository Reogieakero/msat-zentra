"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { GuidanceReferralsView } from "../components/guidance-referrals-view";
import { GuidanceReferralsSkeleton } from "../components/GuidanceReferralsSkeleton";

/**
 * ADM Cases — every ADM-track referral sent to guidance, newest first.
 * Locked to the ADM track so no track filter is needed.
 *
 * Deep-links from the alerts table (?highlight=<id>) scroll to and
 * highlight the case on arrival.
 */
function GuidanceAdmReferralsView() {
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  return (
    <GuidanceReferralsView
      lockedType="ADM"
      title="ADM Cases"
      highlightId={highlightId}
    />
  );
}

export default function GuidanceAdmReferralsPage() {
  return (
    <React.Suspense fallback={<GuidanceReferralsSkeleton lockType />}>
      <GuidanceAdmReferralsView />
    </React.Suspense>
  );
}
