import { apiClient } from "@/lib/api/client";
import { asArray } from "@/lib/api/payload";
import { parseMeetingAttendees } from "./labels";
import type {
  AdmHistoryEvent,
  AdmMeeting,
  AdmMeetingAttachment,
  AdmMeetingInvitee,
  CoordinatorCaseDetail,
} from "./coordinator.types";

export async function fetchCaseHistory(
  opts: { profileId?: string; referralId?: string },
  signal?: AbortSignal,
): Promise<AdmHistoryEvent[]> {
  const res = await apiClient.get<{ events: AdmHistoryEvent[] }>("/api/adm/history", {
    params: {
      ...(opts.profileId ? { profileId: opts.profileId } : {}),
      ...(opts.referralId ? { referralId: opts.referralId } : {}),
    },
    signal,
  });
  return res.data.events;
}

export async function uploadMeetingAttachments(
  meetingId: string,
  files: File[],
): Promise<AdmMeetingAttachment[]> {
  const form = new FormData();
  for (const f of files) form.append("files", f, f.name);
  const { data } = await apiClient.post<AdmMeetingAttachment[]>(
    `/api/adm/meetings/${encodeURIComponent(meetingId)}/attachments`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
    },
  );
  return asArray<AdmMeetingAttachment>(data);
}

export async function deleteMeetingAttachment(
  meetingId: string,
  attachmentId: string,
): Promise<void> {
  await apiClient.delete(
    `/api/adm/meetings/${encodeURIComponent(meetingId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
}

export async function fetchCaseMeetings(
  profileId: string,
  signal?: AbortSignal,
): Promise<AdmMeeting[]> {
  const res = await apiClient.get<{ meetings: AdmMeeting[] }>(
    `/api/adm/${profileId}/meetings`,
    { signal },
  );
  return (res.data.meetings ?? []).map((m) => ({
    ...m,
    attendees: parseMeetingAttendees(
      (m as { attendees?: unknown }).attendees,
    ),
    invitees: Array.isArray((m as { invitees?: unknown }).invitees)
      ? ((m as { invitees?: unknown }).invitees as AdmMeetingInvitee[])
      : [],
    attachments: Array.isArray((m as { attachments?: unknown }).attachments)
      ? ((m as { attachments?: unknown }).attachments as AdmMeetingAttachment[])
      : [],
  }));
}

export async function fetchCoordinatorCaseDetail(
  id: string,
  signal?: AbortSignal,
): Promise<CoordinatorCaseDetail> {
  const res = await apiClient.get<CoordinatorCaseDetail>(
    `/api/adm/case/${encodeURIComponent(id)}`,
    { signal },
  );
  const data = res.data;
  return {
    ...data,
    meetings: (data.meetings ?? []).map((m) => ({
      ...m,
      attendees: parseMeetingAttendees(
        (m as { attendees?: unknown }).attendees,
      ),
      invitees: Array.isArray((m as { invitees?: unknown }).invitees)
        ? ((m as { invitees?: unknown }).invitees as AdmMeetingInvitee[])
        : [],
      attachments: Array.isArray((m as { attachments?: unknown }).attachments)
        ? ((m as { attachments?: unknown }).attachments as AdmMeetingAttachment[])
        : [],
    })),
  };
}
