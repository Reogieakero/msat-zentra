// Shared shapes + vocabulary for the teacher grade-flags board.
export type FlagStatus = "open" | "resolved" | "escalated";
export type FlagReason =
  | "wrong_score"
  | "missing_assessment"
  | "transmutation_error"
  | "late_submission"
  | "other";

export type FlagScope = "mine" | "against-me" | "advisees";

export const REASON_LABELS: Record<FlagReason, string> = {
  wrong_score: "Wrong score",
  missing_assessment: "Missing assessment",
  transmutation_error: "Transmutation error",
  late_submission: "Late submission",
  other: "Other",
};

export const STATUS_LABELS: Record<FlagStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  escalated: "Escalated",
};

export interface FlagStudent {
  id: string;
  name: string;
  lrn: string;
  sectionId?: string | null;
}

export interface GradeFlagRow {
  id: string;
  reason: FlagReason;
  note: string | null;
  status: FlagStatus;
  ageDays: number;
  createdAt: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  student: { id: string; name: string; lrn: string };
  subject: { id: string; name: string };
  section: { id: string; name: string };
  term: { id: string; termNumber: number };
  raisedBy: { id: string; fullName: string };
  owner: { id: string; fullName: string } | null;
}

export interface FlagClassOption {
  subjectId: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  termId: string;
  termNumber: number;
  ownerName?: string;
}

export interface FlagOptions {
  students: FlagStudent[];
  classes: FlagClassOption[];
  sectionClasses: FlagClassOption[];
}

export interface FlagsPage {
  rows: GradeFlagRow[];
  total: number;
  unfilteredTotal: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

export interface RaiseFlagPayload {
  studentId: string;
  subjectId: string;
  sectionId: string;
  termId: string;
  reason: FlagReason;
  note?: string;
}
