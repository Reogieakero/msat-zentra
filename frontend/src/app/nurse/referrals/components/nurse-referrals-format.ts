import type { NurseAlertItem } from "@/services/nurse/nurse.types";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import { formatDate as sharedFormatDate, timeAgo as sharedTimeAgo, formatTime as sharedFormatTime, formatActionTime as sharedFormatActionTime, formatCountdown as sharedFormatCountdown, isSessionStarted as sharedIsSessionStarted } from "@/lib/labels/datetime";
import { initials as sharedInitials } from "@/lib/labels/text";
import { ANECDOTAL_CATEGORY_COLORS as sharedAnecdotalColors, anecdotalCategoryColor as sharedAnecdotalCategoryColor } from "@/lib/labels/anecdotal";
import { isEndorsed as sharedIsEndorsed, isWithdrawn as sharedIsWithdrawn, hasScheduledSession as sharedHasScheduledSession, activeSessionOf as sharedActiveSessionOf, statusLabel as sharedStatusLabel, statusHelp as sharedStatusHelp, rowStatusLabel as sharedRowStatusLabel, rowStatusHelp as sharedRowStatusHelp, statusVariant as sharedStatusVariant, watermarkLabel as sharedWatermarkLabel, watermarkColor as sharedWatermarkColor } from "@/lib/labels/referral-status";
import { labelForActionType as sharedLabelForActionType, latestActionOf as sharedLatestActionOf } from "@/lib/labels/referral-activity";
import { sessionKindLabel as sharedSessionKindLabel } from "@/lib/labels/sessions";
export const ANECDOTAL_CATEGORY_COLORS = sharedAnecdotalColors;
export const anecdotalCategoryColor = sharedAnecdotalCategoryColor;
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
export const isWithdrawn = sharedIsWithdrawn;
export function watermarkLabel(row: NurseQueueRow): string {
  return sharedWatermarkLabel(row, { escalatedText: "Sent to clinic", rawFallback: true });
}
export const watermarkColor = sharedWatermarkColor;
export const isSessionStarted = sharedIsSessionStarted;
export const formatCountdown = sharedFormatCountdown;
