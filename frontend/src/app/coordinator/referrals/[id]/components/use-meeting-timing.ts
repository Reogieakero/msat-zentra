"use client";
import * as React from "react";
import type {
  AdmMeetingAttachment,
  AdmMeetingInvitee,
  MeetingAttendee,
} from "@/services/coordinator/coordinator.types";
export interface ParentMeetingItem {
  id: string;
  meetingDatetime: string;
  venue: string;
  attended: boolean;
  minutesOfMeeting: string | null;
  attendanceLogbookRef: string | null;
  attendees: MeetingAttendee[];
  invitees?: AdmMeetingInvitee[];
  attachments?: AdmMeetingAttachment[];
  recordedBy: string;
}
const JOIN_EARLY_MS = 15 * 60_000;
const MEETING_LEN_MS = 60 * 60_000;
export type MeetingTiming =
  | { state: "done" }
  | { state: "upcoming"; msUntil: number }
  | { state: "live" }
  | { state: "overdue"; msOverdue: number }
  | { state: "unknown" };
export function timingOf(m: ParentMeetingItem, now: number): MeetingTiming {
  if (m.attended) return { state: "done" };
  const start = new Date(m.meetingDatetime).getTime();
  if (!Number.isFinite(start)) return { state: "unknown" };
  const msUntil = start - now;
  if (msUntil > JOIN_EARLY_MS) return { state: "upcoming", msUntil };
  if (now <= start + MEETING_LEN_MS) return { state: "live" };
  return { state: "overdue", msOverdue: now - (start + MEETING_LEN_MS) };
}
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const mins = Math.floor((totalSeconds % 3_600) / 60);
  const secs = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}
export function useMeetingTiming(
  meeting: ParentMeetingItem,
  now: number,
  isLatest: boolean,
) {
  const ticking = isLatest && !meeting.attended;
  const [nowMs, setNowMs] = React.useState(now);
  const [trackedSlot, setTrackedSlot] = React.useState(meeting.meetingDatetime);
  if (trackedSlot !== meeting.meetingDatetime) {
    setTrackedSlot(meeting.meetingDatetime);
    setNowMs(now);
  }
  React.useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking, meeting.meetingDatetime]);
  const timing = timingOf(meeting, ticking ? nowMs : now);
  const needsOutcome =
    !meeting.attended &&
    (timing.state === "live" || timing.state === "overdue");
  const showCountdown =
    isLatest &&
    !meeting.attended &&
    (timing.state === "upcoming" ||
      timing.state === "live" ||
      timing.state === "overdue");
  const showOutcomeRecords =
    meeting.attended ||
    timing.state === "live" ||
    timing.state === "overdue";
  const needsAction =
    isLatest &&
    !meeting.attended &&
    (timing.state === "live" || timing.state === "overdue");
  return {
    timing,
    needsOutcome,
    showCountdown,
    showOutcomeRecords,
    needsAction,
    effectiveNow: ticking ? nowMs : now,
  };
}
