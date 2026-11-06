"use client";
import {
  formatActionTime,
  formatDate,
  hasScheduledSession,
  latestActionOf,
} from "./guidance-referrals-format";
import type { GuidanceReferralItem } from "@/services/guidance/guidance.types";
export function latestActionDay(time: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(time);
  return m ? m[1] : null;
}
export function observedSentence(row: GuidanceReferralItem): string {
  if (!row.date || row.date === "—") return "Observation date is not recorded.";
  return `Observed on ${formatDate(row.date)}.`;
}
export function latestSentence(latest: { label: string; time: string }): string {
  const label = latest.label
    ? latest.label.charAt(0).toLowerCase() + latest.label.slice(1)
    : "an update";
  if (!latest.time || latest.time === "—") return `Latest update was ${label}.`;
  return `Latest update was ${label} on ${formatActionTime(latest.time)}.`;
}
export function useGuidanceEntryMeta(row: GuidanceReferralItem) {
  const isPending = row.status === "pending";
  const isDismissed = row.status === "dismissed";
  const isClosed = row.status === "resolved" || isDismissed;
  const isAdmTrack = row.type === "ADM";
  const hasRail = !!row.anecdotalId || row.sessions.length > 0;
  const isEndorsedRow = isAdmTrack && row.status === "in_progress";
  const canManageSessions = !isAdmTrack || (isAdmTrack && row.status === "pending");
  const latest = latestActionOf(row);
  const booked = hasScheduledSession(row.sessions);
  return {
    isPending,
    isDismissed,
    isClosed,
    isAdmTrack,
    hasRail,
    isEndorsedRow,
    canManageSessions,
    latest,
    booked,
  };
}
