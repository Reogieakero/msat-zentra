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
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import { GuidancePageHeader } from "../components/GuidancePageHeader";
import { useTerm } from "@/lib/term/TermContext";
import { guidanceLiveQueryOptions } from "@/lib/api/live";
import {
  ALL_CALENDAR_TRACKS,
  fetchGuidanceCalendar,
  type GuidanceCalendarEvent,
  type GuidanceCalendarTrack,
} from "@/services/guidance/calendar.service";
import {
  CalendarFilters,
  CalendarToolbar,
  type CalendarView,
} from "./components/calendar-toolbar";
import { CalendarMonth } from "./components/calendar-month";
import { CalendarWeek } from "./components/calendar-week";
import { CalendarDayRail } from "./components/calendar-day-rail";
import { dateKey, groupByDay, parseDateKey } from "./components/calendar-utils";
import styles from "./components/guidance-calendar.module.css";

const WEEK_OPTS = { weekStartsOn: 1 as const };

function localDayStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
}

function localDayEnd(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString();
}

/**
 * Guidance desk calendar: every booked counseling session (intervention,
 * counseling, ADM case) plus ADM parent meetings, laid out in the same kanban
 * card language as the other desks. Read-only — "Open case" deep-links into the
 * existing desks, so booking keeps its slot rules, notifications and sounds.
 *
 * The board is live: `guidanceLiveQueryOptions` refetches every 15s (and while
 * the tab is hidden), and the guidance realtime channel invalidates the
 * `guidance-calendar` key the moment a referral/session/intervention/ADM row
 * changes. The sidebar dot comes from `/api/guidance/nav-counts`, which diffs
 * session + meeting versions against what the counselor last saw.
 */
export default function GuidanceSchedulePage() {
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
    React.useState<GuidanceCalendarTrack[]>(ALL_CALENDAR_TRACKS);
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
    queryKey: ["guidance-calendar", termKey, view, fromISO, toISO, status],
    queryFn: ({ signal }) =>
      fetchGuidanceCalendar({ from: fromISO, to: toISO, status }, { signal }),
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

  function toggleTrack(track: GuidanceCalendarTrack) {
    setEnabledTracks((current) =>
      current.includes(track) ? current.filter((t) => t !== track) : [...current, track],
    );
  }

  function selectEvent(event: GuidanceCalendarEvent) {
    setSelectedEventId(event.id);
    pushState({ date: new Date(event.start) });
  }

  const label =
    view === "week"
      ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`
      : format(cursor, "MMMM yyyy");

  const counts = calendarQuery.data?.counts ?? {
    intervention: 0,
    counseling: 0,
    adm: 0,
    adm_meeting: 0,
  };

  return (
    <section className={styles.page} aria-label="Schedule">
      <GuidancePageHeader
        title="Schedule"
        description="Booked interventions, counseling sessions, ADM case sessions and parent meetings."
      />

      {calendarQuery.isLoading || !termReady ? (
        <div className={styles.skeletonBoard}>
          <div className={styles.skelGrid} aria-hidden="true">
            {Array.from({ length: 42 }, (_, i) => (
              <Skeleton key={i} className={styles.skelCell} />
            ))}
          </div>
        </div>
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
                  onToggleTrack={toggleTrack}
                  status={status}
                  onToggleStatus={() => setStatus((s) => (s === "all" ? "scheduled" : "all"))}
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
