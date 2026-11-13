"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import { NursePageHeader } from "../components/NursePageHeader";
import { useTerm } from "@/lib/term/TermContext";
import { guidanceLiveQueryOptions } from "@/lib/api/live";
import {
  ALL_NURSE_CALENDAR_TRACKS,
  NURSE_TRACK_LABELS,
  NURSE_TRACK_TONES,
  fetchNurseCalendar,
  nurseEventHref,
  nurseTrackLabel,
  type NurseCalendarTrack,
} from "@/services/nurse/calendar.service";
import {
  CalendarFilters,
  CalendarToolbar,
  type CalendarView,
} from "@/app/guidance/schedule/components/calendar-toolbar";
import { CalendarMonth } from "@/app/guidance/schedule/components/calendar-month";
import { CalendarWeek } from "@/app/guidance/schedule/components/calendar-week";
import { CalendarDayRail } from "@/app/guidance/schedule/components/calendar-day-rail";
import { GuidanceScheduleSkeleton } from "@/app/guidance/schedule/components/calendar-skeleton";
import {
  dateKey,
  groupByDay,
  parseDateKey,
  type CalendarEvent,
} from "@/app/guidance/schedule/components/calendar-utils";
import styles from "@/app/guidance/schedule/components/guidance-calendar.module.css";

const WEEK_OPTS = { weekStartsOn: 1 as const };

/** The nurse desk has one track family fewer than the guidance calendar. */
const NURSE_FILTER_PILLS = [4.4, 5.4, 4.9, 6.2];

function localDayStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
}

function localDayEnd(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString();
}

/**
 * Clinic desk calendar: every booked session on the nurse's referrals (clinic
 * matters and the ADM consultations the nurse reviews) plus the ADM parent
 * meetings the nurse is invited to or that belong to a case on the desk.
 * Read-only — "Open case" deep-links into the existing nurse desks, so booking
 * keeps its slot rules, notifications and sounds.
 *
 * The board is live: `guidanceLiveQueryOptions` refetches every 15s (and while
 * the tab is hidden), and `nurseChannel.ts` invalidates the `nurse-calendar`
 * key the moment a referral/session/meeting row changes.
 */
export default function NurseSchedulePage() {
  return (
    <React.Suspense>
      <NurseSchedulePageInner />
    </React.Suspense>
  );
}

function NurseSchedulePageInner() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view: CalendarView = searchParams.get("view") === "week" ? "week" : "month";
  const cursor = React.useMemo(
    () => parseDateKey(searchParams.get("date") ?? "") ?? new Date(),
    [searchParams],
  );
  const selectedKey = dateKey(cursor);

  const [enabledTracks, setEnabledTracks] =
    React.useState<NurseCalendarTrack[]>(ALL_NURSE_CALENDAR_TRACKS);
  const [status, setStatus] = React.useState<"all" | "scheduled">("scheduled");
  const [query, setQuery] = React.useState("");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);

  const range = React.useMemo(() => {
    if (view === "week") {
      return {
        start: startOfWeek(cursor, WEEK_OPTS),
        end: endOfWeek(cursor, WEEK_OPTS),
      };
    }
    return {
      start: startOfWeek(startOfMonth(cursor), WEEK_OPTS),
      end: endOfWeek(endOfMonth(cursor), WEEK_OPTS),
    };
  }, [cursor, view]);

  const fromISO = localDayStart(range.start);
  const toISO = localDayEnd(range.end);

  const calendarQuery = useQuery({
    ...guidanceLiveQueryOptions,
    queryKey: ["nurse-calendar", termKey, view, fromISO, toISO, status],
    queryFn: ({ signal }) =>
      fetchNurseCalendar({ from: fromISO, to: toISO, status }, { signal }),
    enabled: termReady,
  });

  const events = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (calendarQuery.data?.events ?? []).filter((event) => {
      if (!enabledTracks.includes(event.track)) return false;
      if (!needle) return true;
      return `${event.learner} ${event.lrn} ${event.section}`.toLowerCase().includes(needle);
    });
  }, [calendarQuery.data, enabledTracks, query]);

  const grouped = React.useMemo(() => groupByDay(events), [events]);
  const dayEvents = grouped.get(selectedKey) ?? [];
  const hasAnyInRange = (calendarQuery.data?.events.length ?? 0) > 0;

  function pushState(next: { view?: CalendarView; date?: Date }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextView = next.view ?? view;
    const nextDate = next.date ?? cursor;
    if (nextView === "month") params.delete("view");
    else params.set("view", nextView);
    params.set("date", dateKey(nextDate));
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function step(direction: 1 | -1) {
    const next = view === "week" ? addWeeks(cursor, direction) : addMonths(cursor, direction);
    pushState({ date: next });
  }

  function toggleTrack(track: NurseCalendarTrack) {
    setEnabledTracks((current) =>
      current.includes(track) ? current.filter((t) => t !== track) : [...current, track],
    );
  }

  function selectEvent(event: CalendarEvent) {
    setSelectedEventId(event.id);
    pushState({ date: new Date(event.start) });
  }

  const label =
    view === "week"
      ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`
      : format(cursor, "MMMM yyyy");

  const counts = calendarQuery.data?.counts ?? {
    clinic: 0,
    adm: 0,
    adm_meeting: 0,
  };

  return (
    <section className={styles.page} aria-label="Schedule">
      <NursePageHeader
        title="Schedule"
        description="Booked clinic sessions, ADM case consultations and parent meetings on the clinic desk."
      />

      {calendarQuery.isLoading || !termReady ? (
        <GuidanceScheduleSkeleton view={view} cursor={cursor} filterPills={NURSE_FILTER_PILLS} />
      ) : calendarQuery.isError ? (
        <div className={styles.errorCard}>
          <p className={styles.errorTitle}>Couldn&apos;t load the calendar.</p>
          <p className={styles.errorHint}>
            {calendarQuery.error instanceof Error
              ? calendarQuery.error.message
              : "Check your connection and try again."}
          </p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => calendarQuery.refetch()}
            aria-label="Retry"
          >
            <RefreshCw size={16} className={calendarQuery.isFetching ? styles.spin : undefined} />
          </button>
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.mainCol}>
            <KanbanBoard
              title={
                <span className={styles.boardTitle}>
                  <CalendarDays size={14} aria-hidden="true" />
                  Booked schedule
                </span>
              }
              description="Every booked session and parent meeting on your desk. Pick a day to see its agenda."
              headerToolbar={
                <CalendarToolbar
                  label={label}
                  view={view}
                  onViewChange={(next) => pushState({ view: next })}
                  onPrev={() => step(-1)}
                  onNext={() => step(1)}
                  onToday={() => pushState({ date: new Date() })}
                  query={query}
                  onQueryChange={setQuery}
                />
              }
              toolbar={
                <CalendarFilters
                  counts={counts}
                  enabledTracks={enabledTracks}
                  onToggleTrack={(track) => toggleTrack(track as NurseCalendarTrack)}
                  status={status}
                  onToggleStatus={() => setStatus((s) => (s === "all" ? "scheduled" : "all"))}
                  tracks={ALL_NURSE_CALENDAR_TRACKS}
                  labels={NURSE_TRACK_LABELS}
                  tones={NURSE_TRACK_TONES}
                />
              }
            >
              {events.length === 0 ? (
                <div className={styles.boardEmpty}>
                  <PageEmptyCallout>
                    {hasAnyInRange
                      ? "No sessions match your filters or search."
                      : `Nothing is booked in this ${view === "week" ? "week" : "month"} yet. Book a session from the case desk and it will appear here.`}
                  </PageEmptyCallout>
                </div>
              ) : null}

              {view === "month" ? (
                <CalendarMonth
                  cursor={cursor}
                  selectedKey={selectedKey}
                  grouped={grouped}
                  onSelectDay={(key) => pushState({ date: parseDateKey(key) ?? cursor })}
                  onSelectEvent={selectEvent}
                />
              ) : (
                <CalendarWeek
                  cursor={cursor}
                  selectedKey={selectedKey}
                  grouped={grouped}
                  onSelectDay={(key) => pushState({ date: parseDateKey(key) ?? cursor })}
                  onSelectEvent={selectEvent}
                />
              )}
            </KanbanBoard>
          </div>

          <CalendarDayRail
            day={cursor}
            events={dayEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={selectEvent}
            tones={NURSE_TRACK_TONES}
            trackLabel={nurseTrackLabel}
            eventHref={nurseEventHref}
          />
        </div>
      )}

      {calendarQuery.isFetching && !calendarQuery.isLoading ? (
        <span className={styles.srOnly} role="status">
          <Loader2 size={12} /> Refreshing schedule
        </span>
      ) : null}
    </section>
  );
}
