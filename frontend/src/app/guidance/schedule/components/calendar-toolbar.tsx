"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import {
  ALL_CALENDAR_TRACKS,
  TRACK_LABELS,
  TRACK_TONES,
  type GuidanceCalendarTrack,
} from "@/services/guidance/calendar.service";
import styles from "./guidance-calendar.module.css";

export type CalendarView = "month" | "week";

export function CalendarToolbar({
  label,
  view,
  onViewChange,
  onPrev,
  onToday,
  onNext,
  query,
  onQueryChange,
}: {
  label: string;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.navGroup}>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={styles.navButton}
          onClick={onPrev}
          aria-label={view === "month" ? "Previous month" : "Previous week"}
        >
          <ChevronLeft size={16} />
        </Button>
        <span className={styles.monthLabel}>{label}</span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={styles.navButton}
          onClick={onNext}
          aria-label={view === "month" ? "Next month" : "Next week"}
        >
          <ChevronRight size={16} />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onToday}>
          Today
        </Button>
      </div>

      <div className={styles.segmented} role="tablist" aria-label="Calendar view">
        {(["month", "week"] as const).map((option) => {
          const active = view === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              className={styles.segmentButton}
              onClick={() => onViewChange(option)}
            >
              <Pill tone={active ? "blue" : "neutral"} label="Calendar view">
                {option === "month" ? "Month" : "Week"}
              </Pill>
            </button>
          );
        })}
      </div>

      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search learner, LRN or section…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search the schedule"
        />
      </div>
    </div>
  );
}

export function CalendarFilters({
  counts,
  enabledTracks,
  onToggleTrack,
  status,
  onToggleStatus,
}: {
  counts: Record<GuidanceCalendarTrack, number>;
  enabledTracks: GuidanceCalendarTrack[];
  onToggleTrack: (track: GuidanceCalendarTrack) => void;
  status: "all" | "scheduled";
  onToggleStatus: () => void;
}) {
  return (
    <div className={styles.filters} role="tablist" aria-label="Filter schedule by case type">
      {ALL_CALENDAR_TRACKS.map((track) => {
        const active = enabledTracks.includes(track);
        return (
          <button
            key={track}
            type="button"
            role="tab"
            aria-selected={active}
            className={styles.filterButton}
            onClick={() => onToggleTrack(track)}
          >
            <Pill
              tone={active ? TRACK_TONES[track] : "neutral"}
              label={`${active ? "Hide" : "Show"} ${TRACK_LABELS[track].toLowerCase()}`}
            >
              {TRACK_LABELS[track]}
              <span className={styles.pillCount}>{counts[track] ?? 0}</span>
            </Pill>
          </button>
        );
      })}
      <button
        type="button"
        role="tab"
        aria-selected={status === "all"}
        className={styles.filterButton}
        onClick={onToggleStatus}
      >
        <Pill
          tone={status === "all" ? "green" : "neutral"}
          label="Show or hide completed and cancelled sessions"
        >
          {status === "all" ? "Including closed" : "Scheduled only"}
        </Pill>
      </button>
    </div>
  );
}
