import type { NurseAlertItem } from "@/services/nurse/nurse.types";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import { formatDate as sharedFormatDate, timeAgo as sharedTimeAgo, formatTime as sharedFormatTime, formatActionTime as sharedFormatActionTime, formatCountdown as sharedFormatCountdown, isSessionStarted as sharedIsSessionStarted } from "@/lib/labels/datetime";
import { initials as sharedInitials } from "@/lib/labels/text";
import { ANECDOTAL_CATEGORY_COLORS as sharedAnecdotalColors, anecdotalCategoryColor as sharedAnecdotalCategoryColor, anecdotalCategoryPillClass as sharedAnecdotalCategoryPillClass, anecdotalCategoryBadgeVariant as sharedAnecdotalCategoryBadgeVariant } from "@/lib/labels/anecdotal";
import { isEndorsed as sharedIsEndorsed, isWithdrawn as sharedIsWithdrawn, hasScheduledSession as sharedHasScheduledSession, activeSessionOf as sharedActiveSessionOf, latestSessionOf as sharedLatestSessionOf, statusLabel as sharedStatusLabel, statusHelp as sharedStatusHelp, rowStatusLabel as sharedRowStatusLabel, rowStatusHelp as sharedRowStatusHelp, statusVariant as sharedStatusVariant, watermarkLabel as sharedWatermarkLabel, watermarkColor as sharedWatermarkColor } from "@/lib/labels/referral-status";
import { labelForActionType as sharedLabelForActionType, latestActionOf as sharedLatestActionOf } from "@/lib/labels/referral-activity";
import { sessionKindLabel as sharedSessionKindLabel } from "@/lib/labels/sessions";
export const ANECDOTAL_CATEGORY_COLORS = sharedAnecdotalColors;
export const anecdotalCategoryColor = sharedAnecdotalCategoryColor;
export const anecdotalCategoryPillClass = sharedAnecdotalCategoryPillClass;
export const anecdotalCategoryBadgeVariant = sharedAnecdotalCategoryBadgeVariant;
export type TypeFilter = "" | "Clinic" | "ADM";
export const TYPES: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Clinic", label: "Clinic" },
  { value: "ADM", label: "ADM" },
];
export type ActionFilter =
  | ""
  | "adm_needs"
  | "endorse"
  | "followup"
  | "booked"
  | "reject"
  | "adm_cancelled"
  | "clinic_needs"
  | "clinic_booked"
  | "clinic_done"
  | "clinic_followup"
  | "clinic_cancelled";
export type ActionValue = Exclude<ActionFilter, "">;
export const ADM_MENU: { value: ActionValue; label: string }[] = [
  { value: "adm_needs", label: "Needs review" },
  { value: "endorse", label: "Endorse" },
  { value: "followup", label: "Follow-up" },
  { value: "booked", label: "Book session" },
  { value: "reject", label: "Reject" },
  { value: "adm_cancelled", label: "Cancelled" },
];
export const CLINIC_MENU: { value: ActionValue; label: string }[] = [
  { value: "clinic_needs", label: "Needs review" },
  { value: "clinic_booked", label: "Booked session" },
  { value: "clinic_done", label: "Done" },
  { value: "clinic_followup", label: "Follow-up" },
  { value: "clinic_cancelled", label: "Cancelled" },
];
export function matchesActionFilter(row: NurseQueueRow, filter: ActionValue): boolean {
  switch (filter) {
    case "adm_needs":
      return row.type === "ADM" && row.status === "pending";
    case "endorse":
      return row.type === "ADM" && sharedIsEndorsed(row.type, row.status);
    case "followup":
      return row.type === "ADM" && row.status === "follow_up";
    case "booked":
      return row.type === "ADM" && row.sessions.length > 0;
    case "reject":
      return row.type === "ADM" && row.status === "dismissed" && !sharedIsWithdrawn(row);
    case "adm_cancelled":
      return row.type === "ADM" && sharedIsWithdrawn(row);
    case "clinic_needs":
      return row.type === "Clinic" && row.status === "pending";
    case "clinic_booked":
      return row.type === "Clinic" && row.sessions.length > 0;
    case "clinic_done":
      return row.type === "Clinic" && row.sessions.some((s) => s.status === "completed");
    case "clinic_followup":
      return row.type === "Clinic" && row.status === "follow_up";
    case "clinic_cancelled":
      return row.type === "Clinic" && sharedIsWithdrawn(row);
    default:
      return false;
  }
}
export type CaseStageVariant = "amber" | "blue" | "green" | "violet" | "red" | "outline";

export type CaseStage = { key: string; label: string; variant: CaseStageVariant };

/** The card's pipeline stage — the same buckets the action tabs filter by
    (Needs review / Booked session / Done / Follow-up / Cancelled), so the
    kanban header badge reports where the case stands, not the raw status.
    Each stage carries its own coloured pill tone. */
export function caseStage(row: NurseQueueRow): CaseStage {
  const hasCompleted = row.sessions.some((s) => s.status === "completed");
  const hasScheduled = row.sessions.some((s) => s.status === "scheduled");

  if (sharedIsWithdrawn(row)) {
    return { key: "cancelled", label: "Cancelled", variant: "red" };
  }
  if (row.status === "dismissed") {
    return row.type === "ADM"
      ? { key: "reject", label: "Reject", variant: "red" }
      : { key: "cancelled", label: "Cancelled", variant: "red" };
  }
  if (row.status === "resolved") {
    return { key: "done", label: "Done", variant: "green" };
  }
  if (row.status === "follow_up") {
    return { key: "followup", label: "Follow-up", variant: "violet" };
  }
  if (hasCompleted) {
    return { key: "done", label: "Done", variant: "green" };
  }
  if (hasScheduled) {
    return { key: "booked", label: "Booked session", variant: "blue" };
  }
  if (row.status === "pending") {
    return { key: "needs_review", label: "Needs review", variant: "amber" };
  }
  if (sharedIsEndorsed(row.type, row.status)) {
    return { key: "endorsed", label: "Endorsed", variant: "green" };
  }
  if (row.status === "escalated") {
    return { key: "escalated", label: "Sent to clinic", variant: "amber" };
  }
  return {
    key: row.status,
    label: rowStatusLabel(row.type, row.status, row),
    variant: "outline",
  };
}
export const formatDate = sharedFormatDate;
export const timeAgo = sharedTimeAgo;
export const formatTime = sharedFormatTime;
export const sessionKindLabel = sharedSessionKindLabel;
export const isEndorsed = sharedIsEndorsed;
export function statusLabel(status: string): string {
  return sharedStatusLabel(status, { escalatedText: "Sent to clinic", rawFallback: true });
}
export function rowStatusLabel(type: string, status: string, row?: NurseQueueRow): string {
  return sharedRowStatusLabel(type, status, row, { escalatedText: "Sent to clinic", rawFallback: true });
}
export function statusHelp(status: string): string {
  return sharedStatusHelp(status, { escalatedHelp: "This was sent to the clinic for you to handle." });
}
export function rowStatusHelp(type: string, status: string, row?: NurseQueueRow): string {
  return sharedRowStatusHelp(type, status, row, { escalatedHelp: "This was sent to the clinic for you to handle." });
}
export function labelForActionType(
  actionType: string,
  row: NurseQueueRow,
  alert: NurseAlertItem
): string {
  return sharedLabelForActionType(actionType, row, { scope: "nurse", fallback: alert.title });
}
export function latestActionOf(
  row: NurseQueueRow,
  alert: NurseAlertItem
): { label: string; time: string } {
  return sharedLatestActionOf(row, { scope: "nurse", fallback: alert.title });
}
export const formatActionTime = sharedFormatActionTime;
export function statusVariant(
  type: string,
  status: string,
  row?: NurseQueueRow
): "amber" | "destructive" | "secondary" | "outline" | "success" {
  return sharedStatusVariant(type, status, row);
}
export const initials = sharedInitials;
export function activeSessionOf(sessions: NurseSessionItem[]): NurseSessionItem | null {
  return sharedActiveSessionOf(sessions);
}
export const hasScheduledSession = sharedHasScheduledSession;
export function latestSessionOf(sessions: NurseSessionItem[]): NurseSessionItem | null {
  return sharedLatestSessionOf(sessions);
}
export const isWithdrawn = sharedIsWithdrawn;
export function watermarkLabel(row: NurseQueueRow): string {
  return sharedWatermarkLabel(row, { escalatedText: "Sent to clinic", rawFallback: true });
}
export const watermarkColor = sharedWatermarkColor;
export const isSessionStarted = sharedIsSessionStarted;
export const formatCountdown = sharedFormatCountdown;
