import type {
  CounselingSessionItem,
  GuidanceReferralItem,
  GuidanceReferralStatus,
  GuidanceReferralsSummary,
  GuidanceTypeSummary,
} from "@/services/guidance/guidance.types";
import { formatDate as sharedFormatDate, timeAgo as sharedTimeAgo, formatTime as sharedFormatTime, formatDateTime as sharedFormatDateTime, formatActionTime as sharedFormatActionTime, toDateInputValue as sharedToDateInputValue, toTimeInputValue as sharedToTimeInputValue, combineDateTime as sharedCombineDateTime, formatCountdown as sharedFormatCountdown } from "@/lib/labels/datetime";
import { formatStatus as sharedFormatStatus, initials as sharedInitials } from "@/lib/labels/text";
import { anecdotalCategoryColor as sharedAnecdotalCategoryColor, ANECDOTAL_CATEGORY_COLORS as sharedAnecdotalColors } from "@/lib/labels/anecdotal";
import { isEndorsed as sharedIsEndorsed, isWithdrawn as sharedIsWithdrawn, hasScheduledSession as sharedHasScheduledSession, activeSessionOf as sharedActiveSessionOf, statusLabel as sharedStatusLabel, statusHelp as sharedStatusHelp, rowStatusLabel as sharedRowStatusLabel, rowStatusHelp as sharedRowStatusHelp, statusVariant as sharedStatusVariant, watermarkLabel as sharedWatermarkLabel, watermarkColor as sharedWatermarkColor } from "@/lib/labels/referral-status";
import { latestActionOf as sharedLatestActionOf } from "@/lib/labels/referral-activity";
import { roleLabel as sharedRoleLabel } from "@/lib/labels/roles";
import { sessionTypeLabel as sharedSessionTypeLabel, SESSION_KIND_OPTIONS as sharedSessionKindOptions } from "@/lib/labels/sessions";
import { trackMenuCounts as sharedTrackMenuCounts } from "@/lib/labels/referral-filters";
export type GuidanceTypeFilter = "" | "Counseling" | "ADM";
export const GUIDANCE_TYPES: { value: GuidanceTypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Counseling", label: "Counseling" },
  { value: "ADM", label: "ADM" },
];
export type GuidanceAction =
  | ""
  | "counseling_needs"
  | "counseling_booked"
  | "counseling_done"
  | "counseling_followup"
  | "counseling_cancelled"
  | "adm_needs"
  | "endorse"
  | "adm_followup"
  | "adm_booked"
  | "adm_reject"
  | "adm_cancelled";
export type GuidanceActionValue = Exclude<GuidanceAction, "">;
export type GuidanceTrack = "Counseling" | "ADM";
const COUNSELING_ROWS: { value: GuidanceActionValue; label: string }[] = [
  { value: "counseling_needs", label: "Needs review" },
  { value: "counseling_booked", label: "Booked session" },
  { value: "counseling_done", label: "Done" },
  { value: "counseling_followup", label: "Follow-up" },
  { value: "counseling_cancelled", label: "Cancelled" },
];
const ADM_ROWS: { value: GuidanceActionValue; label: string }[] = [
  { value: "adm_needs", label: "Needs review" },
  { value: "endorse", label: "Endorse" },
  { value: "adm_followup", label: "Follow-up" },
  { value: "adm_booked", label: "Book session" },
  { value: "adm_reject", label: "Reject" },
  { value: "adm_cancelled", label: "Cancelled" },
];
export const COUNSELING_MENU = COUNSELING_ROWS;
export const ADM_MENU = ADM_ROWS;
export interface GuidanceActionParams {
  type: "" | "counseling" | "adm";
  status: "" | GuidanceReferralStatus;
  booked: boolean;
  completed: boolean;
  open: boolean;
  withdrawn: boolean;
}
export function resolveActionParams(action: GuidanceAction): GuidanceActionParams {
  switch (action) {
    case "counseling_needs":
      return { type: "counseling", status: "pending", booked: false, completed: false, open: false, withdrawn: false };
    case "counseling_booked":
      return { type: "counseling", status: "", booked: true, completed: false, open: false, withdrawn: false };
    case "counseling_done":
      return { type: "counseling", status: "", booked: false, completed: true, open: false, withdrawn: false };
    case "counseling_followup":
      return { type: "counseling", status: "follow_up", booked: false, completed: false, open: false, withdrawn: false };
    case "counseling_cancelled":
      return { type: "counseling", status: "dismissed", booked: false, completed: false, open: false, withdrawn: true };
    case "adm_needs":
      return { type: "adm", status: "pending", booked: false, completed: false, open: false, withdrawn: false };
    case "endorse":
      return { type: "adm", status: "in_progress", booked: false, completed: false, open: false, withdrawn: false };
    case "adm_followup":
      return { type: "adm", status: "follow_up", booked: false, completed: false, open: false, withdrawn: false };
    case "adm_booked":
      return { type: "adm", status: "", booked: true, completed: false, open: false, withdrawn: false };
    case "adm_reject":
      return { type: "adm", status: "dismissed", booked: false, completed: false, open: false, withdrawn: false };
    case "adm_cancelled":
      return { type: "adm", status: "dismissed", booked: false, completed: false, open: false, withdrawn: true };
    default:
      return { type: "", status: "", booked: false, completed: false, open: false, withdrawn: false };
  }
}
export function trackMenuCounts(
  summary: GuidanceReferralsSummary | null,
  track: GuidanceTrack
): Record<GuidanceActionValue, number> {
  return sharedTrackMenuCounts(summary, track) as Record<GuidanceActionValue, number>;
}
export const formatStatus = sharedFormatStatus;
export const ANECDOTAL_CATEGORY_COLORS = sharedAnecdotalColors;
export const anecdotalCategoryColor = sharedAnecdotalCategoryColor;
export const formatDate = sharedFormatDate;
export const timeAgo = sharedTimeAgo;
export function statusLabel(status: string): string {
  return sharedStatusLabel(status);
}
export function statusHelp(status: string): string {
  return sharedStatusHelp(status);
}
export const watermarkColor = sharedWatermarkColor;
export const isEndorsed = sharedIsEndorsed;
export function rowStatusLabel(type: string, status: string, row?: GuidanceReferralItem): string {
  return sharedRowStatusLabel(type, status, row);
}
export function rowStatusHelp(type: string, status: string, row?: GuidanceReferralItem): string {
  return sharedRowStatusHelp(type, status, row);
}
export const roleLabel = sharedRoleLabel;
export const sessionTypeLabel = sharedSessionTypeLabel;
export const formatTime = sharedFormatTime;
export const formatDateTime = sharedFormatDateTime;
export function latestActionOf(row: GuidanceReferralItem): { label: string; time: string } {
  return sharedLatestActionOf(row, { scope: "guidance" });
}
export const formatActionTime = sharedFormatActionTime;
export const toDateInputValue = sharedToDateInputValue;
export const toTimeInputValue = sharedToTimeInputValue;
export const SESSION_KIND_OPTIONS = sharedSessionKindOptions;
export const combineDateTime = sharedCombineDateTime;
export const initials = sharedInitials;
export function statusVariant(
  status: string,
  type?: string,
  row?: GuidanceReferralItem
): "amber" | "destructive" | "secondary" | "outline" | "success" {
  return sharedStatusVariant(type ?? "", status, row);
}
export function activeSessionOf(sessions: CounselingSessionItem[]): CounselingSessionItem | null {
  return sharedActiveSessionOf(sessions);
}
export const hasScheduledSession = sharedHasScheduledSession;
export const isWithdrawn = sharedIsWithdrawn;
export function watermarkLabel(row: GuidanceReferralItem): string {
  return sharedWatermarkLabel(row);
}
export function matchesGuidanceFilters(
  row: GuidanceReferralItem,
  q: string,
  params: GuidanceActionParams,
): boolean {
  if (params.status !== "" && row.status !== params.status) return false;
  if (params.type === "adm" && row.type !== "ADM") return false;
  if (params.type === "counseling" && row.type !== "Counseling") return false;
  if (params.booked && row.sessions.length === 0) return false;
  if (params.completed && !row.sessions.some((s) => s.status === "completed")) return false;
  if (params.open && (row.status === "resolved" || row.status === "dismissed")) return false;
  if (params.withdrawn && !sharedIsWithdrawn(row)) return false;
  if (!params.withdrawn && params.status === "dismissed" && sharedIsWithdrawn(row)) return false;
  const needle = q.trim().toLowerCase();
  if (
    needle !== "" &&
    !`${row.student} ${row.lrn} ${row.section} ${row.referredBy} ${row.observer} ${row.reason} ${row.anecdotalExcerpt} ${row.category}`
      .toLowerCase()
      .includes(needle)
  )
    return false;
  return true;
}
export function buildGuidanceSummary(
  rows: GuidanceReferralItem[],
): GuidanceReferralsSummary {
  const byType = (type: "Counseling" | "ADM"): GuidanceTypeSummary => {
    const scoped = rows.filter((r) => r.type === type);
    const open = scoped.filter((r) => r.status !== "resolved" && r.status !== "dismissed");
    return {
      pending: scoped.filter((r) => r.status === "pending").length,
      inProgress: scoped.filter((r) => r.status === "in_progress").length,
      followUp: scoped.filter((r) => r.status === "follow_up").length,
      escalated: scoped.filter((r) => r.status === "escalated").length,
      resolved: scoped.filter((r) => r.status === "resolved").length,
      dismissed: scoped.filter((r) => r.status === "dismissed").length,
      cancelled: scoped.filter((r) => sharedIsWithdrawn(r)).length,
      booked: scoped.filter((r) => r.sessions.length > 0).length,
      done: scoped.filter((r) => r.sessions.some((s) => s.status === "completed")).length,
      open: open.length,
    };
  };
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    escalated: rows.filter((r) => r.status === "escalated").length,
    dismissed: rows.filter((r) => r.status === "dismissed").length,
    followUp: rows.filter((r) => r.status === "follow_up").length,
    byType: { Counseling: byType("Counseling"), ADM: byType("ADM") },
  };
}
export const formatCountdown = sharedFormatCountdown;
