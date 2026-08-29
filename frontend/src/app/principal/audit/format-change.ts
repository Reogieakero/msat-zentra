// Human-friendly rendering of audit old/new values for non-technical readers.
import { AuditActionType, AuditEntry } from "./audit-data";

type FieldMap = Record<string, string>;

// snake_case / enum key -> plain label
const FIELD_LABELS: FieldMap = {
  lock_status: "Grade lock",
  locked_by: "Locked by",
  status: "Status",
  eligibility_status: "Eligibility",
  approval_status: "Approval",
  outcome_status: "Outcome",
  approved_by: "Approved by",
  approval_date: "Approval date",
  current_version: "Version",
  validated_by: "Validated by",
  treatment_given: "Treatment given",
  diagnosis: "Diagnosis",
  notes_recommendations_actions: "Notes & recommendations",
  certification_by: "Certified by",
  attended: "Attendance marked",
  awarded: "Awarded",
  is_active: "Active school year",
  contact_number: "Contact number",
  reason: "Reason",
  certification_details: "Certification details",
  generated_at: "Generated at",
  referred_by: "Referred by",
  risk_level_at_flag: "Risk level at flag",
  recommended_action: "Recommended action",
  approved_action: "Approved action",
  outcome_notes: "Outcome notes",
};

// enum value -> plain word
const VALUE_LABELS: Record<string, string> = {
  unlocked: "Unlocked",
  locked: "Locked",
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  eligible: "Eligible",
  ineligible: "Not eligible",
  approved: "Approved",
  rejected: "Rejected",
  modified: "Modified",
  in_progress: "In progress",
  resolved: "Resolved",
  unresolved: "Unresolved",
  ongoing: "Ongoing",
  true: "Yes",
  false: "No",
};

function prettifyKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const str = String(value);
  if (VALUE_LABELS[str] !== undefined) return VALUE_LABELS[str];
  return str;
}

export type ChangeLine = {
  label: string;
  from: string;
  to: string;
};

// Build a readable list of changed fields for an entry.
export function buildChangeLines(entry: AuditEntry): ChangeLine[] {
  const oldV = entry.oldValue ?? {};
  const newV = entry.newValue ?? {};
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));

  const lines: ChangeLine[] = [];
  for (const key of keys) {
    const from = prettifyValue(oldV[key]);
    const to = prettifyValue(newV[key]);
    if (from === to) continue;
    lines.push({ label: prettifyKey(key), from, to });
  }
  return lines;
}

// A short, one-line plain summary of what happened.
const ACTION_VERB: Partial<Record<AuditActionType, string>> = {
  grade_lock: "locked grades",
  grade_unlock: "unlocked grades",
  adm_principal_approve: "final-signed an ADM case",
  account_approval: "approved an account",
  school_year_set_active: "set the active school year",
  honor_roll_mark_awarded: "published the honor roll",
  report_refresh: "refreshed a report",
  principal_profile_change: "updated their profile",
  principal_password_change: "changed their password",
  sf10_update: "updated an SF10 record",
  anecdotal_edit: "edited an anecdotal record",
  health_record_edit: "edited a health record",
  home_visitation_edit: "edited a home visitation record",
  adm_edit: "edited an ADM case",
  referral_status_change: "changed a referral status",
  intervention_approval: "approved an intervention",
  role_change: "changed a role",
  school_year_create: "created a school year",
  term_create: "created a term",
  school_year_edit: "edited a school year",
};

export function summarizeAction(entry: AuditEntry): string {
  const verb = ACTION_VERB[entry.actionType] ?? "made a change";
  return `${entry.user} ${verb}.`;
}
