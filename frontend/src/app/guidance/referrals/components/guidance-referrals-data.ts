import { apiClient } from "@/lib/api/client";

export type GuidanceReferralStatus =
  | "pending"
  | "in_progress"
  | "resolved"
  | "escalated"
  | "info_requested"
  | "dismissed"
  | "follow_up";

export type CounselingSessionType =
  | "individual"
  | "parent_conference"
  | "group"
  | "home_visit";

export type CounselingSessionStatus = "scheduled" | "completed" | "cancelled";

export interface CounselingSessionItem {
  id: string;
  sessionType: CounselingSessionType;
  scheduledAt: string;
  date: string;
  venue: string;
  status: CounselingSessionStatus;
  sessionNotes: string;
  outcome: string;
  cancelReason: string;
  completedAt: string;
}

export interface GuidanceReferralItem {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  category: string;
  referredBy: string;
  observer: string;
  reason: string;
  status: GuidanceReferralStatus;
  date: string;
  anecdotalId: string;
  anecdotalExcerpt: string;
  location: string;
  recommendations: string;
  confidentiality: string;
  notes?: string;
  escalationReason?: string;
  followUpDate?: string;
  escalatedTo?: string;
  priority: string;
  intakeNotes: string;
  acceptedAt: string;
  resolutionSummary: string;
  sessions: CounselingSessionItem[];
  completedSessions: number;
}

export interface GuidanceReferralsSummary {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  escalated?: number;
  infoRequested?: number;
  dismissed?: number;
  followUp?: number;
}

export interface GuidanceReferralsData {
  summary: GuidanceReferralsSummary;
  referrals: GuidanceReferralItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuidanceReferralsParams {
  q?: string;
  status?: "" | GuidanceReferralStatus;
  page?: number;
  pageSize?: number;
}

export async function fetchGuidanceReferrals(
  params: GuidanceReferralsParams = {}
): Promise<GuidanceReferralsData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceReferralsData>(
    `/api/guidance/referrals${query ? `?${query}` : ""}`
  );
  return data;
}

export async function updateReferralStatus(
  id: string,
  status: GuidanceReferralStatus,
  resolutionSummary?: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/status`, {
    status,
    ...(resolutionSummary ? { resolutionSummary } : {}),
  });
  return data;
}

export interface AcceptReferralInput {
  priority: "low" | "normal" | "high";
  intakeNotes?: string;
  firstSession?: {
    scheduledAt: string;
    sessionType: CounselingSessionType;
    venue?: string;
  };
}

export async function acceptReferral(
  id: string,
  input: AcceptReferralInput
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/accept`, input);
  return data;
}

export interface ScheduleSessionInput {
  scheduledAt: string;
  sessionType: CounselingSessionType;
  venue?: string;
}

export async function scheduleSession(
  id: string,
  input: ScheduleSessionInput
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/sessions`, input);
  return data;
}

export async function completeSession(
  id: string,
  sessionId: string,
  input: {
    sessionNotes: string;
    outcome?: string;
    followUpSession?: ScheduleSessionInput;
  }
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/referrals/${id}/sessions/${sessionId}/complete`,
    input
  );
  return data;
}

export async function rescheduleSession(
  id: string,
  sessionId: string,
  scheduledAt: string
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/referrals/${id}/sessions/${sessionId}/reschedule`,
    { scheduledAt }
  );
  return data;
}

export async function cancelSession(
  id: string,
  sessionId: string,
  cancelReason?: string
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/api/referrals/${id}/sessions/${sessionId}/cancel`,
    cancelReason ? { cancelReason } : {}
  );
  return data;
}

export async function escalateReferral(
  id: string,
  escalationReason: string,
  escalatedTo: "principal" | "nurse" | "adm_coordinator"
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/escalate`, {
    escalationReason,
    escalatedTo,
  });
  return data;
}

export async function reassignReferral(
  id: string,
  referredToRole: "nurse" | "guidance_counselor" | "adm_coordinator" | "principal"
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/reassign`, {
    referredToRole,
  });
  return data;
}

export async function addReferralNote(
  id: string,
  notes: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/note`, { notes });
  return data;
}

export async function flagReferralFollowUp(
  id: string,
  followUpDate: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/follow-up`, {
    followUpDate,
  });
  return data;
}

export async function dismissReferral(
  id: string,
  reason: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/dismiss`, {
    reason,
  });
  return data;
}

export async function referToSpecialist(
  id: string,
  referredToRole: "nurse" | "adm_coordinator" | "principal",
  reason: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/specialist`, {
    referredToRole,
    reason,
  });
  return data;
}

export async function initiateAdm(
  id: string,
  reason: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/adm`, {
    reason,
  });
  return data;
}