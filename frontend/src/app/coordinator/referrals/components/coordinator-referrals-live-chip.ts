import type { AdmMeeting } from "@/services/coordinator/coordinator.types";
export const JOIN_EARLY_MS = 15 * 60_000;
export const MEETING_LEN_MS = 60 * 60_000;
export function liveChip(
  m: Pick<AdmMeeting, "meetingDatetime" | "attended">,
  now: number,
): "live" | "overdue" | null {
  if (m.attended) return null;
  const start = new Date(m.meetingDatetime).getTime();
  if (!Number.isFinite(start)) return null;
  if (now < start - JOIN_EARLY_MS) return null;
  return now <= start + MEETING_LEN_MS ? "live" : "overdue";
}
