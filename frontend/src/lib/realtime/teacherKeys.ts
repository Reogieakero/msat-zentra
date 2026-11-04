"use client";

/**
 * Teacher/adviser query-key registry and notification routing.
 *
 * Single source of truth shared by:
 * - `app/teacher/components/use-teacher-invalidate.ts` (mutation-side invalidation)
 * - `lib/realtime/teacherChannel.ts` (realtime notification invalidation)
 *
 * Keep this list in sync with the keys the teacher pages actually use. When a
 * new page/query is added, register its key here and give the notification
 * types that touch it a scope in `scopesForNotification`.
 */

export const TEACHER_QUERY_KEYS = [
  ["teacher-overview"],
  ["teacher-overview-secondary"],
  ["teacher-overview-gradebook"],
  ["teacher-student-list"],
  ["teacher-reports"],
  ["advisory-students"],
  ["advisory-students-archived"],
  ["advisory-modules"],
  ["teacher-sf10-access"],
  ["advisee-academic"],
  ["advisee-anecdotal"],
  ["advisee-attendance"],
  ["adm-my-cases"],
  ["adm-monitoring"],
  ["myReferrals"],
  ["referableAnecdotal"],
  ["anecdotal-mine"],
  ["teacher-anecdotes"],
  ["teacher-notifications"],
  ["teacher-schedule"],
  ["teacher-schedule-summary"],
  ["teacher-schedule-section"],
  ["teacher-schedule-subjects"],
  ["teacher-schedule-teachers"],
  ["teacher-schedule-config"],
  ["teacher-schedule-conflicts"],
  ["teacher-schedule-me"],
  ["teacher-my-slots"],
  ["teacher-grading-class"],
  ["teacher-settings-adviser-sections"],
  ["teacher-profile-settings"],
  ["teacher-data-sharing"],
  ["grade-flags"],
  ["attendance-sheet-marks"],
  ["attendance-subject-days"],
  ["attendance-section-summary"],
  ["attendance-section-matrix"],
  ["attendance-section-roster"],
  ["offered-subjects"],
] as const;

export const TEACHER_SCOPE_KEYS = {
  marks: [
    ["attendance-sheet-marks"],
    ["attendance-subject-days"],
    ["attendance-section-summary"],
    ["attendance-section-matrix"],
    ["attendance-section-roster"],
    ["offered-subjects"],
  ],
  grading: [
    ["teacher-grading-class"],
    ["advisee-academic"],
    ["advisory-students"],
    ["teacher-overview"],
    ["teacher-overview-secondary"],
    ["teacher-overview-gradebook"],
    ["teacher-reports"],
  ],
  schedule: [
    ["teacher-schedule"],
    ["teacher-schedule-summary"],
    ["teacher-schedule-section"],
    ["teacher-schedule-subjects"],
    ["teacher-schedule-teachers"],
    ["teacher-schedule-config"],
    ["teacher-schedule-conflicts"],
    ["teacher-schedule-me"],
    ["teacher-my-slots"],
  ],
  overview: [
    ["teacher-overview"],
    ["teacher-overview-secondary"],
    ["teacher-overview-gradebook"],
    ["teacher-student-list"],
    ["teacher-reports"],
  ],
  referrals: [["myReferrals"], ["referableAnecdotal"], ["anecdotal-mine"]],
  advisory: [
    ["advisory-students"],
    ["advisory-students-archived"],
    ["advisory-modules"],
    ["teacher-sf10-access"],
    ["advisee-academic"],
    ["advisee-anecdotal"],
    ["advisee-attendance"],
    ["adm-my-cases"],
    ["adm-monitoring"],
  ],
  modules: [["advisory-modules"], ["advisory-students"], ["teacher-overview"]],
  adm: [
    ["adm-my-cases"],
    ["adm-monitoring"],
    ["advisory-students"],
    ["advisee-academic"],
    ["advisee-attendance"],
  ],
  anecdotal: [["anecdotal-mine"], ["teacher-anecdotes"], ["referableAnecdotal"]],
  flags: [["grade-flags"], ["teacher-overview"], ["teacher-overview-secondary"]],
  sf10: [["teacher-sf10-access"]],
  settings: [
    ["teacher-settings-adviser-sections"],
    ["teacher-profile-settings"],
    ["teacher-data-sharing"],
  ],
  notifications: [["teacher-notifications"]],
} as const;

export type TeacherInvalidateScope = keyof typeof TEACHER_SCOPE_KEYS;

/** Types the server emits (`TYPE_MAP` in `backend/src/lib/notify.ts`). */
const SCOPES_BY_TYPE: Record<string, readonly TeacherInvalidateScope[]> = {
  // Grading / finals
  finals_ready: ["grading", "overview"],
  grade_locked: ["grading", "overview"],
  score_saved: ["grading", "overview"],
  score_saved_self: ["grading"],

  // Grade flags
  grade_flag_opened: ["flags", "overview"],
  grade_flag_opened_self: ["flags"],
  grade_flag_resolved: ["flags", "overview"],
  grade_flag_resolved_self: ["flags"],

  // Advisory modules
  module_submitted: ["modules", "overview"],

  // Referrals / interventions
  referral_status_change: ["referrals"],
  referral_form_saved: ["referrals"],
  referral_form_saved_self: ["referrals"],
  referral_deleted_self: ["referrals"],
  new_followup: ["anecdotal", "referrals"],
  intervention_detected: ["advisory", "referrals"],
  intervention_assigned: ["advisory", "referrals"],
  intervention_assigned_self: ["advisory"],
  intervention_session: ["advisory", "referrals"],
  intervention_session_self: ["advisory"],
  intervention_outcome: ["advisory", "referrals"],
  intervention_outcome_self: ["advisory"],
  intervention_approved: ["advisory", "referrals"],
  intervention_alert: ["advisory", "referrals"],

  // Attendance
  attendance_submitted: ["marks", "overview"],
  attendance_subject_alert: ["marks", "overview"],
  attendance_created: ["marks", "overview"],
  attendance_sweep: ["marks", "overview"],
  attendance_unlocked: ["marks"],

  // Schedule / academics
  schedule_submitted: ["schedule"],
  schedule_approved: ["schedule"],
  schedule_rejected: ["schedule"],
  schedule_updated: ["schedule"],
  assignment_created: ["schedule", "grading", "marks", "overview"],
  assignment_removed: ["schedule", "grading", "marks", "overview"],
  adviser_assigned: ["overview", "advisory", "schedule"],
  academics_updated: ["schedule", "grading", "marks", "overview"],
  teacher_code_claimed: ["schedule", "overview"],
  teacher_code_claimed_self: ["schedule"],
  teacher_code_released: ["schedule", "overview"],
  master_teacher_changed: ["settings", "schedule"],

  // SF10
  sf10_access_requested: ["sf10"],
  sf10_access_decision: ["sf10"],
  sf10_needs_validation: ["sf10"],
  sf10_validated: ["sf10"],
  sf10_released: ["sf10"],

  // ADM / meetings / devices
  new_adm_case: ["adm"],
  adm_decision: ["adm"],
  adm_decision_self: ["adm"],
  adm_endorse: ["adm"],
  adm_endorse_self: ["adm"],
  adm_forward_self: ["adm"],
  adm_certify_self: ["adm"],
  adm_complete_self: ["adm"],
  principal_verdict: ["adm"],
  meeting_booked: ["adm"],
  meeting_booked_self: ["adm"],
  meeting_rescheduled: ["adm"],
  meeting_rescheduled_self: ["adm"],
  meeting_outcome: ["adm"],
  meeting_outcome_self: ["adm"],
  meeting_cancelled: ["adm"],
  device_issued: ["adm"],
  device_issued_self: ["adm"],
  device_returned: ["adm"],
  device_returned_self: ["adm"],
  device_overdue: ["adm"],

  // Roster
  roster_enlisted: ["advisory", "overview", "modules"],
  roster_enlisted_self: ["advisory", "overview"],
  roster_updated: ["advisory", "overview", "modules"],
  roster_updated_self: ["advisory", "overview"],
  roster_archived: ["advisory", "overview", "modules"],
  roster_archived_self: ["advisory", "overview"],
  roster_restored: ["advisory", "overview", "modules"],
  roster_restored_self: ["advisory", "overview"],
};

/** Fallback when the type is unknown: match the notification's source table. */
function scopesForTable(table: string): readonly TeacherInvalidateScope[] | null {
  if (table.startsWith("attendance")) return ["marks", "overview"];
  if (table.startsWith("student_grade") || table.startsWith("final_grade"))
    return ["grading", "overview"];
  if (table.startsWith("grade_flag")) return ["flags", "overview"];
  if (table.startsWith("advisory_module")) return ["modules", "overview"];
  if (table.startsWith("adm_")) return ["adm"];
  if (table.startsWith("referral") || table.startsWith("counseling_session"))
    return ["referrals"];
  if (table.startsWith("anecdotal")) return ["anecdotal", "referrals"];
  if (table.startsWith("intervention")) return ["advisory", "referrals"];
  if (table.startsWith("student_roster")) return ["advisory", "overview", "modules"];
  if (table.startsWith("adviser_sf10_access") || table.startsWith("sf10_record"))
    return ["sf10"];
  if (
    table.startsWith("section") ||
    table.startsWith("teacher_") ||
    table.startsWith("subject")
  )
    return ["schedule"];
  return null;
}

/**
 * Notification type → teacher query scopes. Server-authored types win; the
 * source table is only a fallback so an unknown type still refreshes the
 * right panel instead of the whole desk.
 */
export function scopesForNotification(row: {
  type?: string | null;
  sourceTable?: string | null;
}): readonly TeacherInvalidateScope[] {
  const type = (row.type ?? "").toLowerCase();
  if (
    type &&
    Object.prototype.hasOwnProperty.call(SCOPES_BY_TYPE, type)
  ) {
    return SCOPES_BY_TYPE[type];
  }

  const fromTable = scopesForTable((row.sourceTable ?? "").toLowerCase());
  if (fromTable) return fromTable;

  return ["notifications"];
}

export function isSelfNotification(row: { type?: string | null }): boolean {
  return (row.type ?? "").toLowerCase().endsWith("_self");
}

/** Keys covered by one or more scopes, de-duplicated. */
export function keysForScopes(
  scopes: readonly TeacherInvalidateScope[],
): (readonly string[])[] {
  const seen = new Map<string, readonly string[]>();
  for (const scope of scopes) {
    for (const key of TEACHER_SCOPE_KEYS[scope]) {
      seen.set(key.join("\u0000"), key);
    }
  }
  return [...seen.values()];
}
