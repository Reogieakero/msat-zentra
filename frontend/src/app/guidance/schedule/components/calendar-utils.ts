"use client";

import type { PillTone } from "@/components/ui/pill";
import type {
  GuidanceCalendarEvent,
  GuidanceCalendarTrack,
} from "@/services/guidance/calendar.service";

/**
 * Shared event shape for the desk calendars. The guidance payload extends it
 * (its `track` is a narrower union), and the nurse calendar reuses the same
 * grids/week/rail with its own track family.
 */
export interface CalendarEvent {
  id: string;
  track: string;
  learner: string;
  lrn: string;
  section: string;
  sessionType: string;
  /** ISO instant — render it in the browser's local time. */
  start: string;
  venue: string;
  status: string;
  outcome?: string;
  referralId: string | null;
  interventionId: string | null;
  admProfileId: string | null;
  invited: boolean | null;
}

/** Per-desk track family: order, labels, pill tones and case deep-links. */
export interface CalendarTrackConfig {
  tracks: readonly string[];
  labels: Record<string, string>;
  tones: Record<string, PillTone>;
  eventHref: (event: CalendarEvent) => string | null;
  trackLabel: (track: string) => string;
}

/** Local `YYYY-MM-DD` key — the calendar renders in the browser's timezone. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local midnight for a `YYYY-MM-DD` key (never UTC — that shifts the day). */
export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dateKey(new Date(event.start));
    const list = map.get(key);
    if (list) list.push(event);
    else map.set(key, [event]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.start.localeCompare(b.start));
  }
  return map;
}

export function eventsOnDay(
  grouped: Map<string, CalendarEvent[]>,
  key: string,
): CalendarEvent[] {
  return grouped.get(key) ?? [];
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual session",
  parent_conference: "Parent conference",
  group: "Group session",
  home_visit: "Home visitation",
};

export function sessionTypeLabel(type: string): string {
  return SESSION_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

export function trackLabel(track: GuidanceCalendarTrack | string): string {
  switch (track) {
    case "intervention":
      return "Intervention";
    case "counseling":
      return "Counseling";
    case "adm":
      return "ADM case";
    case "adm_meeting":
      return "ADM parent meeting";
    default:
      return track;
  }
}

/** Where "Open case" goes — booking stays in the existing desks. */
export function eventHref(event: CalendarEvent | GuidanceCalendarEvent): string | null {
  if (event.track === "intervention" && event.lrn) {
    return `/guidance/interventions?q=${encodeURIComponent(event.lrn)}`;
  }
  if (event.referralId) {
    const desk = event.track === "counseling" ? "counseling" : "adm";
    return `/guidance/referrals/${desk}?highlight=${encodeURIComponent(event.referralId)}`;
  }
  return null;
}

export function isClosed(event: CalendarEvent | GuidanceCalendarEvent): boolean {
  return event.status === "cancelled" || event.status === "completed";
}
