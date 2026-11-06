import { formatStatus, friendlyWords } from "./text";
export { deskFromSessionMessage, isFilingTeacher } from "@/lib/notifications/action-label";
export const CONSULT_REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
};
export const REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
  adm_coordinator: "ADM Coordinator",
};
export const TARGET_ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};
export const ROLE_TOKEN_LABELS: Record<string, string> = {
  adm_coordinator: "ADM Coordinator",
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  principal: "Principal",
  adviser: "Adviser",
  subject_teacher: "Subject Teacher",
  registrar: "Registrar",
  record_keeper: "Record Keeper",
  lrpc: "LRPC",
};
export const MEETING_INVITER_ROLE_LABELS: Record<string, string> = {
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adviser: "Adviser",
};
export const MEETING_ATTENDEE_ROLE_LABELS: Record<string, string> = {
  parent_guardian: "Parent/Guardian",
  teacher: "Teacher",
  student: "Student",
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  principal: "Principal",
  lrpc: "LRPC",
  other: "Other",
};
export const INVITE_ROLE_LABELS: Record<string, string> = {
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adviser: "Adviser",
};
export const DESK_NAMES: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
  adviser: "Adviser",
  subject_teacher: "Adviser",
};
export function consultReviewerLabel(value: string | null | undefined): string {
  if (!value) return "Direct referral";
  return CONSULT_REVIEWER_LABELS[value] ?? friendlyWords(value);
}
export function meetingInviteeLabel(u: { fullName: string; role: string }): string {
  const role = MEETING_INVITER_ROLE_LABELS[u.role] ?? friendlyWords(u.role);
  return `${u.fullName} · ${role}`;
}
export function attendeeLabel(a: { name: string; role: string }): string {
  return `${a.name} · ${MEETING_ATTENDEE_ROLE_LABELS[a.role]}`;
}
export function roleLabel(value: string): string {
  switch (value) {
    case "principal":
      return "Principal";
    case "nurse":
      return "Nurse";
    case "adm_coordinator":
      return "ADM coordinator";
    case "guidance_counselor":
      return "Guidance";
    default:
      return formatStatus(value);
  }
}
export function venueLabel(venue: string): string {
  return venue === "home" ? "Home visit" : "In school";
}
export function inviteRoleLabel(role: string): string {
  return INVITE_ROLE_LABELS[role] ?? role.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
