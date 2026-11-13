"use client";

import type { PillTone } from "@/components/ui/pill";
import type { CalendarEvent } from "@/app/guidance/schedule/components/calendar-utils";
import { apiClient } from "@/lib/api/client";

/** What an event on the nurse (clinic) calendar is. */
export type NurseCalendarTrack = "clinic" | "adm" | "adm_meeting";

export type NurseCalendarEvent = Omit<CalendarEvent, "track"> & {
  track: NurseCalendarTrack;
};

export interface NurseCalendarData {
  range: { from: string; to: string };
  status: "all" | "scheduled";
  counts: Record<NurseCalendarTrack, number>;
  events: NurseCalendarEvent[];
}

export interface NurseCalendarParams {
  /** ISO instants — the page sends its local month/week boundaries. */
  from: string;
  to: string;
  status: "all" | "scheduled";
}

export async function fetchNurseCalendar(
  params: NurseCalendarParams,
  opts: { signal?: AbortSignal } = {}
): Promise<NurseCalendarData> {
  const search = new URLSearchParams();
  search.set("from", params.from);
  search.set("to", params.to);
  search.set("status", params.status);
  const { data } = await apiClient.get<NurseCalendarData>(
    `/api/nurse/calendar?${search.toString()}`,
    { signal: opts.signal }
  );
  return {
    ...data,
    events: Array.isArray(data?.events) ? data.events : [],
    counts: data?.counts ?? { clinic: 0, adm: 0, adm_meeting: 0 },
  };
}

/** Filter state shared by the toolbar, the grids and the day rail. */
export const ALL_NURSE_CALENDAR_TRACKS: NurseCalendarTrack[] = [
  "clinic",
  "adm",
  "adm_meeting",
];

export const NURSE_TRACK_LABELS: Record<NurseCalendarTrack, string> = {
  clinic: "Clinic sessions",
  adm: "ADM cases",
  adm_meeting: "ADM meetings",
};

/** Colour family per track — used by the toolbar pills and every event card. */
export const NURSE_TRACK_TONES: Record<NurseCalendarTrack, PillTone> = {
  clinic: "blue",
  adm: "amber",
  adm_meeting: "teal",
};

export function nurseTrackLabel(track: string): string {
  switch (track) {
    case "clinic":
      return "Clinic session";
    case "adm":
      return "ADM case";
    case "adm_meeting":
      return "ADM parent meeting";
    default:
      return track;
  }
}

/** Where "Open case" goes on the nurse desk — booking stays on the case desk. */
export function nurseEventHref(event: CalendarEvent): string | null {
  if (!event.referralId) return null;
  const desk = event.track === "adm" || event.track === "adm_meeting" ? "adm" : "clinic";
  return `/nurse/referrals/${desk}?highlight=${encodeURIComponent(event.referralId)}`;
}
