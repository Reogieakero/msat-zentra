// Clinic sessions on one nurse referral: schedule / complete /
// reschedule / cancel / delete, plus optional photo documentation.
// Same workflow as the guidance referrals page (POST
// /api/referrals/:id/sessions*). Nurse sessions are always one-on-one
// clinic talks at the school clinic unless another venue is given.
import { apiClient } from "@/lib/api/client";
import type { ClinicAttachment, NurseScheduleSessionInput } from "./nurse.types";

export async function scheduleClinicSession(
  id: string,
  input: NurseScheduleSessionInput
): Promise<void> {
  await apiClient.post(`/api/referrals/${id}/sessions`, {
    scheduledAt: input.scheduledAt,
    sessionType: "individual",
    ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
  });
}

export async function completeClinicSession(
  id: string,
  sessionId: string,
  input: { sessionNotes: string; outcome?: string; followUpAt?: string; followUpVenue?: string }
): Promise<void> {
  const body: Record<string, unknown> = { sessionNotes: input.sessionNotes };
  if (input.outcome?.trim()) body.outcome = input.outcome.trim();
  if (input.followUpAt) {
    body.followUpSession = {
      scheduledAt: input.followUpAt,
      sessionType: "individual",
      ...(input.followUpVenue?.trim() ? { venue: input.followUpVenue.trim() } : {}),
    };
  }
  await apiClient.post(`/api/referrals/${id}/sessions/${sessionId}/complete`, body);
}

export async function rescheduleClinicSession(
  id: string,
  sessionId: string,
  scheduledAt: string
): Promise<void> {
  await apiClient.post(`/api/referrals/${id}/sessions/${sessionId}/reschedule`, {
    scheduledAt,
  });
}

export async function cancelClinicSession(
  id: string,
  sessionId: string,
  cancelReason?: string
): Promise<void> {
  await apiClient.post(
    `/api/referrals/${id}/sessions/${sessionId}/cancel`,
    cancelReason?.trim() ? { cancelReason: cancelReason.trim() } : {}
  );
}

export async function deleteClinicSession(
  id: string,
  sessionId: string
): Promise<void> {
  await apiClient.delete(`/api/referrals/${id}/sessions/${sessionId}`);
}

// Optional documentation on one clinic session: list / upload / remove
// image attachments. Filing is optional before Done — these helpers only
// build the evidence trail, they never gate the resolve call.
export async function listClinicAttachments(
  referralId: string,
  sessionId: string
): Promise<ClinicAttachment[]> {
  const { data } = await apiClient.get<ClinicAttachment[]>(
    `/api/referrals/${referralId}/sessions/${sessionId}/attachments`
  );
  return Array.isArray(data) ? data : [];
}

const CLINIC_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_CLINIC_IMAGE_BYTES = 5 * 1024 * 1024;

export function clinicAttachmentError(files: File[]): string | null {
  if (files.length === 0) return "Choose at least one image to attach.";
  if (files.length > 5) return "Attach at most 5 images at a time.";
  for (const f of files) {
    if (!CLINIC_IMAGE_TYPES.includes(f.type)) {
      return `"${f.name}" is not a JPG, PNG, or WEBP image.`;
    }
    if (f.size > MAX_CLINIC_IMAGE_BYTES) {
      return `"${f.name}" is over 5 MB — pick a smaller photo.`;
    }
  }
  return null;
}

export async function uploadClinicAttachments(
  referralId: string,
  sessionId: string,
  files: File[],
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<ClinicAttachment[]> {
  const form = new FormData();
  for (const f of files) form.append("files", f, f.name);
  const { data } = await apiClient.post<ClinicAttachment[]>(
    `/api/referrals/${referralId}/sessions/${sessionId}/attachments`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      // Photo uploads (up to 5×5MB) must never hang the spinner forever:
      // 60s timeout + caller-provided abort on dialog close/unmount.
      // Never auto-retried — a retry could file duplicates.
      timeout: opts?.timeoutMs ?? 60_000,
      ...(opts?.signal ? { signal: opts.signal } : {}),
    }
  );
  return Array.isArray(data) ? data : [];
}

export async function deleteClinicAttachment(
  referralId: string,
  sessionId: string,
  attachmentId: string
): Promise<void> {
  await apiClient.delete(
    `/api/referrals/${referralId}/sessions/${sessionId}/attachments/${attachmentId}`
  );
}
