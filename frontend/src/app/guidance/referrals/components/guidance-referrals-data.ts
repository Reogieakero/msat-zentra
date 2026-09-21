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

export interface CounselingSessionAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

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
  // When the session was booked (execution time). Falls back to
  // scheduledAt for legacy rows without it.
  createdAt: string;
  completedAt: string;
  // Optional documentation filed on the session (photos). Empty when
  // nothing is filed — docs never gate Done.
  attachments: CounselingSessionAttachment[];
}

export interface GuidanceReferralItem {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  // Account userId (or roster id for enlisted students without accounts)
  // for the live risk lookup. The endpoint serves both.
  studentId: string | null;
  // Action track: "ADM" needs ADM action (escalated toward the ADM
  // coordinator), otherwise regular "Counseling" handled on this desk.
  type: string;
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
  // Latest execution across referral + sessions (backend audit, ISO).
  // Empty when no audit trail exists (legacy rows) — callers fall back.
  lastActionAt: string;
  lastActionType: string;
}

export interface GuidanceTypeSummary {
  pending: number;
  inProgress: number;
  followUp: number;
  escalated: number;
  // Optional for backward-compat with cached responses.
  infoRequested?: number;
  resolved: number;
  dismissed: number;
  booked: number;
  done: number;
  open: number;
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
  // Per-track totals for the sidebar's separate Counseling vs ADM menus.
  byType?: Record<"Counseling" | "ADM", GuidanceTypeSummary>;
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
  type?: "" | "counseling" | "adm";
  booked?: boolean;
  completed?: boolean;
  open?: boolean;
  page?: number;
  pageSize?: number;
}

export async function fetchGuidanceReferrals(
  params: GuidanceReferralsParams = {},
  opts: { signal?: AbortSignal } = {}
): Promise<GuidanceReferralsData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.type) search.set("type", params.type);
  if (params.booked) search.set("booked", "1");
  if (params.completed) search.set("completed", "1");
  if (params.open) search.set("open", "1");
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceReferralsData>(
    `/api/guidance/referrals${query ? `?${query}` : ""}`,
    { signal: opts.signal }
  );
  return data;
}

// Every referral on the desk (newest pages first) for client-side tables.
// The endpoint caps pageSize at 100, so walk all pages — filtering and
// paging then happen locally. Optional params (e.g. type) scope the walk
// to the same track a locked page shows.
export async function fetchAllGuidanceReferrals(
  params: GuidanceReferralsParams = {}
): Promise<GuidanceReferralItem[]> {
  const first = await fetchGuidanceReferrals({ ...params, page: 1, pageSize: 100 });
  const all = [...first.referrals];
  for (let p = 2; p <= first.totalPages; p++) {
    const res = await fetchGuidanceReferrals({ ...params, page: p, pageSize: 100 });
    all.push(...res.referrals);
  }
  return all;
}

export type GuidanceRiskLevel = "High" | "Moderate" | "Low";

// Live rule-based risk level per referred student (GET /api/risk/students/:id
// → { lrn, riskLevel }). The guidance role is allowed this limited
// projection, and the endpoint serves roster ids too — pass the referral's
// studentId (account or roster) so every row resolves a level.
// Resolves each id independently so one failure never blocks the rest;
// ids with no result are simply absent from the map (table shows "—").
export async function fetchGuidanceRiskLevels(
  studentIds: string[]
): Promise<Record<string, GuidanceRiskLevel>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const settled = await Promise.allSettled(
    unique.map(async (id) => {
      const { data } = await apiClient.get<{ lrn: string; riskLevel: GuidanceRiskLevel }>(
        `/api/risk/students/${id}`
      );
      return { id, riskLevel: data?.riskLevel ?? null };
    })
  );
  const map: Record<string, GuidanceRiskLevel> = {};
  for (const s of settled) {
    if (
      s.status === "fulfilled" &&
      s.value.riskLevel !== null &&
      (s.value.riskLevel === "High" ||
        s.value.riskLevel === "Moderate" ||
        s.value.riskLevel === "Low")
    ) {
      map[s.value.id] = s.value.riskLevel;
    }
  }
  return map;
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

// Permanently remove a cancelled session (only cancelled sessions can be
// deleted; scheduled/completed must be finished or cancelled first).
export async function deleteSession(id: string, sessionId: string): Promise<unknown> {
  const { data } = await apiClient.delete(
    `/api/referrals/${id}/sessions/${sessionId}`
  );
  return data;
}

// Optional documentation on one counseling session: list / upload / remove
// image attachments. Filing is optional — these helpers only build the
// evidence trail, they never gate Done or resolve.
export async function listSessionAttachments(
  referralId: string,
  sessionId: string
): Promise<CounselingSessionAttachment[]> {
  const { data } = await apiClient.get<CounselingSessionAttachment[]>(
    `/api/referrals/${referralId}/sessions/${sessionId}/attachments`
  );
  return Array.isArray(data) ? data : [];
}

const SESSION_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SESSION_IMAGE_BYTES = 5 * 1024 * 1024;

export function sessionAttachmentError(files: File[]): string | null {
  if (files.length === 0) return "Choose at least one image to attach.";
  if (files.length > 5) return "Attach at most 5 images at a time.";
  for (const f of files) {
    if (!SESSION_IMAGE_TYPES.includes(f.type)) {
      return `"${f.name}" is not a JPG, PNG, or WEBP image.`;
    }
    if (f.size > MAX_SESSION_IMAGE_BYTES) {
      return `"${f.name}" is over 5 MB — pick a smaller photo.`;
    }
  }
  return null;
}

export async function uploadSessionAttachments(
  referralId: string,
  sessionId: string,
  files: File[]
): Promise<CounselingSessionAttachment[]> {
  const form = new FormData();
  for (const f of files) form.append("files", f, f.name);
  const { data } = await apiClient.post<CounselingSessionAttachment[]>(
    `/api/referrals/${referralId}/sessions/${sessionId}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return Array.isArray(data) ? data : [];
}

export async function deleteSessionAttachment(
  referralId: string,
  sessionId: string,
  attachmentId: string
): Promise<void> {
  await apiClient.delete(
    `/api/referrals/${referralId}/sessions/${sessionId}/attachments/${attachmentId}`
  );
}

// Backend errors arrive as { error: { code, message } } — surface the
// server's message instead of a generic failure notice.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    if (data?.error?.message) return data.error.message;
  }
  return fallback;
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