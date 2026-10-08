"use client";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
export function isBookableRow(r: AdmCaseRow): boolean {
  if (r.referralStatus === "dismissed" || r.referralStatus === "resolved") return false;
  if (r.id.startsWith("referral:")) return true;
  return r.stage === "meeting_parents";
}
export function buildInterpretation(rows: AdmCaseRow[]): string {
  const atMeeting = rows.filter((r) => r.stage === "meeting_parents").length;
  const unbooked = rows.filter((r) => !r.meeting && isBookableRow(r)).length;
  return (
    `${rows.length} case${rows.length === 1 ? "" : "s"} on this page` +
    ` · ${atMeeting} at parent meeting` +
    ` · ${unbooked} bookable without a meeting booked.`
  );
}
