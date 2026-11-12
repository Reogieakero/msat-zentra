"use client";

import type { PillTone } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";

/** What an event on the guidance calendar is. */
export type GuidanceCalendarTrack =
  | "intervention"
  | "counseling"
  | "adm"
  | "adm_meeting";

export interface GuidanceCalendarEvent {
  id: string;
  track: GuidanceCalendarTrack;
  learner: string;
  lrn: string;
  section: string;
  sessionType: string;
  /** ISO instant — render it in the browser's local time. */
  start: string;
  venue: string;
  status: string;
  outcome: string;
  referralId: string | null;
  interventionId: string | null;
  admProfileId: string | null;
  /** Parent meetings only: is this counselor one of the booking's invitees? */
  invited: boolean | null;
}

export interface GuidanceCalendarData {
  range: { from: string; to: string };
  status: "all" | "scheduled";
  counts: Record<GuidanceCalendarTrack, number>;
  events: GuidanceCalendarEvent[];
}

export interface GuidanceCalendarParams {
  /** ISO instants — the page sends its local month/week boundaries. */
  from: string;
  to: string;
  status: "all" | "scheduled";
}

export async function fetchGuidanceCalendar(
  params: GuidanceCalendarParams,
  opts: { signal?: AbortSignal } = {}
): Promise<GuidanceCalendarData> {
  const search = new URLSearchParams();
  search.set("from", params.from);
  search.set("to", params.to);
  search.set("status", params.status);
  const { data } = await apiClient.get<GuidanceCalendarData>(
    `/api/guidance/calendar?${search.toString()}`,
    { signal: opts.signal }
  );
  return {
    ...data,
    events: Array.isArray(data?.events) ? data.events : [],
    counts: data?.counts ?? {
      intervention: 0,
      counseling: 0,
      adm: 0,
      adm_meeting: 0,
    },
  };
}

/** Filter state shared by the toolbar, the grids and the day rail. */
export const ALL_CALENDAR_TRACKS: GuidanceCalendarTrack[] = [
  "intervention",
  "counseling",
  "adm",
  "adm_meeting",
];

export const TRACK_LABELS: Record<GuidanceCalendarTrack, string> = {
  intervention: "Interventions",
  counseling: "Counseling",
  adm: "ADM cases",
  adm_meeting: "ADM meetings",
};

/** Colour family per track — used by the toolbar pills and every event card. */
export const TRACK_TONES: Record<GuidanceCalendarTrack, PillTone> = {
  intervention: "blue",
  counseling: "violet",
  adm: "amber",
  adm_meeting: "teal",
};

export function calendarFilterKey(
  tracks: GuidanceCalendarTrack[],
  status: "all" | "scheduled"
) {
  return `${[...tracks].sort().join(",")}|${status}`;
}
