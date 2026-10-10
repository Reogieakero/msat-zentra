import { apiClient } from "@/lib/api/client";
import { asArray } from "@/lib/api/payload";
import type {
  CounselingSessionAttachment,
  ScheduleSessionInput,
} from "./guidance.types";

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

export async function deleteSession(id: string, sessionId: string): Promise<unknown> {
  const { data } = await apiClient.delete(
    `/api/referrals/${id}/sessions/${sessionId}`
  );
  return data;
}

export async function listSessionAttachments(
  referralId: string,
  sessionId: string
): Promise<CounselingSessionAttachment[]> {
  const { data } = await apiClient.get<CounselingSessionAttachment[]>(
    `/api/referrals/${referralId}/sessions/${sessionId}/attachments`
  );
  return asArray<CounselingSessionAttachment>(data);
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
  return asArray<CounselingSessionAttachment>(data);
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

export interface DaySchedule {
  date: string;
  taken: string[];
}

/** Booked `HH:MM` slots for the current counselor on one UTC day. */
export async function fetchDaySchedule(
  dateKey: string,
  opts: { signal?: AbortSignal } = {}
): Promise<string[]> {
  const { data } = await apiClient.get<DaySchedule>(
    `/api/guidance/schedule?date=${encodeURIComponent(dateKey)}`,
    { signal: opts.signal }
  );
  const taken = (data as DaySchedule | null)?.taken;
  return Array.isArray(taken) ? taken.filter((t): t is string => typeof t === "string") : [];
}
