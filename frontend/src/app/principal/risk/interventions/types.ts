export type ApprovalStatus = "pending" | "approved" | "rejected" | "modified";
export type OutcomeStatus = "ongoing" | "resolved" | "unresolved";
export type RiskLevelKey = "Low" | "Moderate" | "High";

export interface InterventionSession {
  id: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  completedAt: string | null;
}

export interface InterventionLink {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignedStaffName: string | null;
  approvalStatus: ApprovalStatus;
  outcomeStatus: OutcomeStatus;
  sessions: InterventionSession[];
  createdAt: string | null;
}

export interface SubjectGrade {
  subject: string;
  code: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  belowThreshold: boolean;
}

export interface RiskFactors {
  academic: boolean;
  attendance: boolean;
  behavioral: boolean;
}

export interface RiskSnapshotStudent {
  studentId: string;
  lrn: string;
  studentName: string;
  section: string;
  gradeLevel: string;
  riskLevel: RiskLevelKey;
  riskCount: number;
  snapshotDate: string | null;
  factors: RiskFactors;
  subjectGrades: SubjectGrade[];
  intervention: InterventionLink | null;
  /** Learner's own profile mascot — the character the adviser's list shows. */
  mascot?: string | null;
}

export interface InterventionStudentsResult {
  students: RiskSnapshotStudent[];
  total: number;
  page: number;
  pageSize: number;
  highModerate: number;
}

export type RiskFactorKey = "Academic" | "Attendance" | "Behavioral";

export interface StudentFilters {
  riskLevel?: RiskLevelKey | "all";
  hasIntervention?: boolean;
  factor?: RiskFactorKey | "all";
  q?: string;
  section?: string;
  outcomeStatus?: OutcomeStatus;
  /** Plan state: ongoing only when guidance has booked a session. */
  plan?: "ongoing" | "none";
  /** Queue order requested from the API. */
  sort?: "risk" | "detected";
}

export interface StaffOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CreateInterventionBody {
  studentId: string;
  recommendedAction: string;
  assignedTo: string;
  riskLevelAtFlag?: RiskLevelKey;
}

export interface PatchInterventionBody {
  approvalStatus?: ApprovalStatus;
  outcomeStatus?: OutcomeStatus;
  assignedTo?: string;
  recommendedAction?: string;
}
