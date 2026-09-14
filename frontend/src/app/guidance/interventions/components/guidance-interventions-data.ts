import { apiClient } from "@/lib/api/client";

export type InterventionApproval =
  | "pending"
  | "approved"
  | "rejected"
  | "modified";

export type InterventionOutcome = "ongoing" | "resolved" | "unresolved";

export type RiskLevelFilter = "High" | "Moderate" | "All";
export type FactorFilter =
  | ""
  | "Academic"
  | "Attendance"
  | "Behavioral";
export type FollowUpStatusFilter = "" | InterventionOutcome | "all";

export interface AtRiskFactors {
  academic: boolean;
  attendance: boolean;
  behavioral: boolean;
}

export type CounselingSessionType =
  | "individual"
  | "parent_conference"
  | "group"
  | "home_visit";

export interface CounselingSessionItem {
  id: string;
  sessionType: CounselingSessionType;
  scheduledAt: string;
  date: string;
  venue: string;
  status: "scheduled" | "completed" | "cancelled";
  sessionNotes: string;
  outcome: string;
  cancelReason: string;
  completedAt: string;
}

export interface StudentFollowUp {
  id: string;
  recommendedAction: string;
  assigneeId: string;
  assignee: string;
  approvalStatus: InterventionApproval;
  outcomeStatus: InterventionOutcome;
  outcomeNotes: string;
  priority: string;
  intakeNotes: string;
  sessions: CounselingSessionItem[];
  completedSessions: number;
}

export interface ReferralContext {
  open: number;
  closed: number;
}

export interface AtRiskStudentItem {
  studentKey: string;
  lrn: string;
  student: string;
  section: string;
  grade: string;
  riskLevel: string;
  riskCount: number;
  factors: AtRiskFactors;
  /** Read-only context: adviser-referred cases exist separately. Never mixed. */
  referralContext: ReferralContext;
  intervention: StudentFollowUp | null;
}

export interface GuidanceInterventionsSummary {
  high: number;
  moderate: number;
  waitingReview: number;
  ongoing: number;
  resolved: number;
  mine: number;
}

export interface GuidanceInterventionsData {
  summary: GuidanceInterventionsSummary;
  students: AtRiskStudentItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuidanceInterventionsParams {
  q?: string;
  level?: RiskLevelFilter;
  factor?: FactorFilter;
  outcome?: FollowUpStatusFilter;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export async function fetchGuidanceInterventions(
  params: GuidanceInterventionsParams = {}
): Promise<GuidanceInterventionsData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.level) search.set("level", params.level);
  if (params.factor) search.set("factor", params.factor);
  if (params.outcome) search.set("outcome", params.outcome);
  if (params.mine) search.set("mine", "true");
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceInterventionsData>(
    `/api/interventions${query ? `?${query}` : ""}`
  );
  return data;
}

export interface InterventionStaffMember {
  id: string;
  fullName: string;
  role: string;
}

export async function fetchInterventionStaff(): Promise<InterventionStaffMember[]> {
  const { data } = await apiClient.get<{ staff: InterventionStaffMember[] }>(
    "/api/interventions/staff"
  );
  return data.staff;
}

export type ReviewDecision = "approved" | "rejected" | "modified";

export async function reviewIntervention(
  id: string,
  input: { decision: ReviewDecision; recommendedAction?: string }
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/interventions/${id}/review`,
    input
  );
  return data;
}

export async function assignIntervention(
  id: string,
  assigneeId: string | null
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/interventions/${id}/assign`, {
    assigneeId,
  });
  return data;
}

export async function recordInterventionOutcome(
  id: string,
  input: { outcomeStatus: InterventionOutcome; outcomeNotes?: string }
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/interventions/${id}/outcome`,
    input
  );
  return data;
}

export interface StartFollowUpInput {
  recommendedAction: string;
  priority: "low" | "normal" | "high";
  intakeNotes?: string;
  firstSession?: {
    scheduledAt: string;
    sessionType: CounselingSessionType;
    venue?: string;
  };
}

export async function startFollowUp(
  studentKey: string,
  input: StartFollowUpInput
): Promise<unknown> {
  const rosterPrefix = "roster:";
  const body = studentKey.startsWith(rosterPrefix)
    ? { rosterId: studentKey.slice(rosterPrefix.length), ...input }
    : { studentId: studentKey, ...input };
  const { data } = await apiClient.post("/api/interventions/start", body);
  return data;
}

export interface ScheduleSessionInput {
  scheduledAt: string;
  sessionType: CounselingSessionType;
  venue?: string;
}

export async function scheduleFollowUpSession(
  followUpId: string,
  input: ScheduleSessionInput
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/interventions/${followUpId}/sessions`,
    input
  );
  return data;
}

export async function completeFollowUpSession(
  followUpId: string,
  sessionId: string,
  input: {
    sessionNotes: string;
    outcome?: string;
    followUpSession?: ScheduleSessionInput;
  }
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/interventions/${followUpId}/sessions/${sessionId}/complete`,
    input
  );
  return data;
}

export async function rescheduleFollowUpSession(
  followUpId: string,
  sessionId: string,
  scheduledAt: string
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/interventions/${followUpId}/sessions/${sessionId}/reschedule`,
    { scheduledAt }
  );
  return data;
}

export async function cancelFollowUpSession(
  followUpId: string,
  sessionId: string,
  cancelReason?: string
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/interventions/${followUpId}/sessions/${sessionId}/cancel`,
    cancelReason ? { cancelReason } : {}
  );
  return data;
}
