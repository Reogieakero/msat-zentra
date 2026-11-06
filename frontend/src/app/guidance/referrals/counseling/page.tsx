"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { GuidanceReferralsView } from "../components/guidance-referrals-view";
import { GuidanceReferralsSkeleton } from "../components/GuidanceReferralsSkeleton";

function GuidanceCounselingReferralsView() {
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  return (
    <GuidanceReferralsView
      lockedType="Counseling"
      title="Counseling Cases"
      highlightId={highlightId}
    />
  );
}

export default function GuidanceCounselingReferralsPage() {
  return (
    <React.Suspense fallback={<GuidanceReferralsSkeleton lockType />}>
      <GuidanceCounselingReferralsView />
    </React.Suspense>
  );
}
