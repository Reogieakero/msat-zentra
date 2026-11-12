import { apiClient } from "@/lib/api/client";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { pickList } from "@/lib/api/payload";
import { asArray } from "@/lib/api/payload";
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
  if (params.grade) search.set("grade", params.grade);
  if (params.factor) search.set("factor", params.factor);
  if (params.outcome) search.set("outcome", params.outcome);
  if (params.mine) search.set("mine", "true");
  if (params.sort) search.set("sort", params.sort);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<
    GuidanceInterventionsData | { students: AtRiskStudentItem[] }
  >(
    `/api/interventions${query ? `?${query}` : ""}`,
    { signal: opts.signal }
  );

  const students = pickList<AtRiskStudentItem>(data, "students");
  return { ...(data as GuidanceInterventionsData), students };
}

// The interventions board filters locally, so it loads the whole queue once
// (same approach as the alerts desk) instead of refetching on every keystroke.
const FETCH_ALL_PAGE_SIZE = PAGE_SIZE;

export async function fetchAllGuidanceInterventions(
  opts: { signal?: AbortSignal } = {}
): Promise<GuidanceInterventionsData> {
  const first = await fetchGuidanceInterventions(
    {
      page: 1,
      pageSize: FETCH_ALL_PAGE_SIZE,
      level: "All",
      outcome: "all",
      // Board reads newest detection first (ties keep risk order).
      sort: "detected",
    },
    opts
  );
  if (first.totalPages <= 1) return first;
  // Pages are independent — fetch in parallel instead of sequentially.
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      fetchGuidanceInterventions(
        {
          page: i + 2,
          pageSize: FETCH_ALL_PAGE_SIZE,
          level: "All",
          outcome: "all",
          sort: "detected",
        },
        opts
      )
    )
  );
  return {
    ...first,
    students: [first.students, ...rest.map((r) => r.students)].flat(),
    page: 1,
  };
}

export async function listInterventionSessionDocs(
  followUpId: string,
  sessionId: string
): Promise<InterventionSessionDoc[]> {
  const { data } = await apiClient.get<InterventionSessionDoc[]>(
    `/api/interventions/${followUpId}/sessions/${sessionId}/attachments`
  );
  return asArray<InterventionSessionDoc>(data);
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
  return asArray<InterventionSessionDoc>(data);
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
