"use client";
import * as React from "react";
import { useActiveNowTick } from "@/lib/clock";
import type { GuidanceReferralItem } from "@/services/guidance/guidance.types";
export function useGuidanceReferralsFilter({
  referrals,
  highlightId,
}: {
  referrals: GuidanceReferralItem[];
  highlightId: string | null;
}) {
  const hasScheduledOnPage = referrals.some((r) =>
    r.sessions.some((s) => s.status === "scheduled")
  );
  const now = useActiveNowTick(hasScheduledOnPage);
  React.useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`guidance-case-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, referrals]);
  return { now, hasScheduledOnPage };
}
