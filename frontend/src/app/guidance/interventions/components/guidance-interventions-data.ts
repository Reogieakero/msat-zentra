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
  // When the session was booked (execution time). Falls back to
  // scheduledAt for legacy rows without it — never display the future
  // appointment as the action time.
  createdAt: string;
  completedAt: string;
  attachmentsCount: number;
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
  // When the intervention was opened (ISO, null for legacy rows).
  createdAt: string | null;
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
  /** Engine detection moment for the active term (RiskSnapshot date). */
  detectedAt: string | null;
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
  params: GuidanceInterventionsParams = {},
  opts: { signal?: AbortSignal } = {}
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
    `/api/interventions${query ? `?${query}` : ""}`,
    { signal: opts.signal }
  );
  return data;
}

// Every at-risk student carrying an intervention (all outcomes) for
// client-side tables. The endpoint caps pageSize at 100, so walk all
// pages — filtering and paging then happen locally.
export async function fetchAllGuidanceInterventions(): Promise<AtRiskStudentItem[]> {
  const first = await fetchGuidanceInterventions({ page: 1, pageSize: 100, outcome: "all" });
  const all = [...first.students];
  for (let p = 2; p <= first.totalPages; p++) {
    const res = await fetchGuidanceInterventions({ page: p, pageSize: 100, outcome: "all" });
    all.push(...res.students);
  }
  return all.filter((s) => s.intervention !== null);
}

export interface InterventionSessionDoc {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export async function listInterventionSessionDocs(
  followUpId: string,
  sessionId: string
): Promise<InterventionSessionDoc[]> {
  const { data } = await apiClient.get<InterventionSessionDoc[]>(
    `/api/interventions/${followUpId}/sessions/${sessionId}/attachments`
  );
  return Array.isArray(data) ? data : [];
}

const SESSION_DOC_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SESSION_DOC_BYTES = 5 * 1024 * 1024;

export function sessionDocError(files: File[]): string | null {
  if (files.length === 0) return "Choose at least one image to attach.";
  if (files.length > 5) return "Attach at most 5 images at a time.";
  for (const f of files) {
    if (!SESSION_DOC_IMAGE_TYPES.includes(f.type)) {
      return `"${f.name}" is not a JPG, PNG, or WEBP image.`;
    }
    if (f.size > MAX_SESSION_DOC_BYTES) {
      return `"${f.name}" is over 5 MB — pick a smaller photo.`;
    }
  }
  return null;
}

export async function uploadInterventionSessionDocs(
  followUpId: string,
  sessionId: string,
  files: File[]
): Promise<InterventionSessionDoc[]> {
  const form = new FormData();
  for (const f of files) form.append("files", f, f.name);
  const { data } = await apiClient.post<InterventionSessionDoc[]>(
    `/api/interventions/${followUpId}/sessions/${sessionId}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return Array.isArray(data) ? data : [];
}

export async function deleteInterventionSessionDoc(
  followUpId: string,
  sessionId: string,
  attachmentId: string
): Promise<void> {
  await apiClient.delete(
    `/api/interventions/${followUpId}/sessions/${sessionId}/attachments/${attachmentId}`
  );
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
