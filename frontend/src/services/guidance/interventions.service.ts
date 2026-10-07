// Follow-up actions for the guidance interventions desk: at-risk queue
// fetch, session docs, staff/review/assign/outcome, engine breakdown,
// follow-up lifecycle (start + session schedule/complete/move/cancel).
import { apiClient } from "@/lib/api/client";
import type {
  AtRiskStudentItem,
  EngineBreakdown,
  GuidanceInterventionsData,
  GuidanceInterventionsParams,
  InterventionOutcome,
  InterventionSessionDoc,
  InterventionStaffMember,
  ReviewDecision,
  ScheduleSessionInput,
  StartFollowUpInput,
} from "./interventions.types";

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
  const { data } = await apiClient.get<
    GuidanceInterventionsData | { students: AtRiskStudentItem[] }
  >(
    `/api/interventions${query ? `?${query}` : ""}`,
    { signal: opts.signal }
  );
  // Defensive: the endpoint has served bare {students} shapes — never let
  // a shape change crash the table.
  const students = Array.isArray((data as { students?: unknown }).students)
    ? (data as { students: AtRiskStudentItem[] }).students
    : [];
  return { ...(data as GuidanceInterventionsData), students };
}

// Every live at-risk student (High + Moderate, all outcomes) for
// client-side tables — including flagged students whose follow-up hasn't
// been opened yet (intervention === null renders with the table's
// "Ongoing" / "Intervention recorded" fallbacks). The endpoint caps
// pageSize at 100, so walk all pages — filtering and paging then happen
// locally. `level: "All"` is required: the endpoint defaults to High-only.
export async function fetchAllGuidanceInterventions(): Promise<AtRiskStudentItem[]> {
  const first = await fetchGuidanceInterventions({
    page: 1,
    pageSize: 100,
    level: "All",
    outcome: "all",
  });
  const all = [...first.students];
  for (let p = 2; p <= first.totalPages; p++) {
    const res = await fetchGuidanceInterventions({
      page: p,
      pageSize: 100,
      level: "All",
      outcome: "all",
    });
    all.push(...res.students);
  }
  return all;
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

export async function fetchInterventionStaff(): Promise<InterventionStaffMember[]> {
  const { data } = await apiClient.get<{ staff: InterventionStaffMember[] }>(
    "/api/interventions/staff"
  );
  return data.staff;
}

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

export async function fetchInterventionEngine(
  studentKey: string,
  opts: { signal?: AbortSignal } = {}
): Promise<EngineBreakdown> {
  const rosterPrefix = "roster:";
  const query = studentKey.startsWith(rosterPrefix)
    ? `rosterId=${encodeURIComponent(studentKey.slice(rosterPrefix.length))}`
    : `studentId=${encodeURIComponent(studentKey)}`;
  const { data } = await apiClient.get<EngineBreakdown>(
    `/api/interventions/engine?${query}`,
    { signal: opts.signal }
  );
  return data;
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
