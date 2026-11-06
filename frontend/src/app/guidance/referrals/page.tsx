"use client";

import * as React from "react";
import { GuidanceReferralsView } from "./components/guidance-referrals-view";
import { GuidanceReferralsSkeleton } from "./components/GuidanceReferralsSkeleton";

export default function GuidanceReferralsPage() {
  return (
    <React.Suspense fallback={<GuidanceReferralsSkeleton />}>
      <GuidanceReferralsView />
    </React.Suspense>
  );
}
