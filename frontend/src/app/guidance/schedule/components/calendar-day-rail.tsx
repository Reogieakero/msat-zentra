"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, CalendarClock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { InsightCallout } from "@/components/ui/insight-callout";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  TRACK_TONES,
} from "@/services/guidance/calendar.service";
import styles from "./guidance-calendar.module.css";
import {
  eventHref as defaultEventHref,
  formatTime,
  isClosed,
  sessionTypeLabel,
  trackLabel as defaultTrackLabel,
  type CalendarEvent,
} from "./calendar-utils";

export function CalendarDayRail({
  day,
  events,
  selectedEventId,
  onSelectEvent,
  tones = TRACK_TONES,
  trackLabel = defaultTrackLabel,
  eventHref = defaultEventHref,
}: {
  day: Date;
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: CalendarEvent) => void;
  /** Track pill tones — defaults to the guidance palette. */
  tones?: Record<string, import("@/components/ui/pill").PillTone>;
  trackLabel?: (track: string) => string;
  eventHref?: (event: CalendarEvent) => string | null;
}) {
  return (
    <aside className={styles.rail} aria-label="Day agenda">
      <div className={styles.railHead}>
        <p className={styles.railEyebrow}>Day agenda</p>
        <h2 className={styles.railTitle}>{format(day, "EEEE, MMMM d")}</h2>
        <p className={styles.railCount}>
          {events.length === 0
            ? "Nothing booked"
            : `${events.length} booked ${events.length === 1 ? "item" : "items"}`}
        </p>
      </div>

      {events.length === 0 ? (
        <InsightCallout role="status">
          No sessions or meetings on this day. Book one from the case desk.
        </InsightCallout>
      ) : (
        <ul className={styles.railList}>
          {events.map((event) => {
            const href = eventHref(event);
            const closed = isClosed(event);
            return (
              <li key={event.id}>
                <div
                  className={styles.railCard}
                  data-track={event.track}
                  data-selected={event.id === selectedEventId ? "true" : undefined}
                  onClick={() => onSelectEvent(event)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectEvent(event);
                    }
                  }}
                >
                  <div className={styles.railCardTop}>
                    <div className={styles.railPerson}>
                      <StudentMascot
                        name={event.learner}
                        seed={event.lrn}
                        size={34}
                      />
                      <div className={styles.railPersonText}>
                        <p className={styles.railLearner}>{event.learner}</p>
                        <div className={styles.railPills}>
                          {event.lrn ? (
                            <Pill label="LRN" className="tabular-nums">
                              {event.lrn}
                            </Pill>
                          ) : null}
                          {event.section ? (
                            <Pill tone="amber" label="Section">
                              {event.section}
                            </Pill>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className={styles.railWhen}>
                      <Pill tone={tones[event.track] ?? "neutral"} label="Case type">
                        {trackLabel(event.track)}
                      </Pill>
                      <Pill tone="neutral" label="Scheduled at" className="tabular-nums">
                        <CalendarClock size={10} aria-hidden="true" />
                        {formatTime(event.start)}
                      </Pill>
                    </div>
                  </div>

                  <div className={styles.railPills}>
                    <Pill label="Session type">{sessionTypeLabel(event.sessionType)}</Pill>
                    {event.venue ? (
                      <Pill label="Venue">
                        <MapPin size={10} aria-hidden="true" />
                        {event.venue}
                      </Pill>
                    ) : null}
                    {closed ? (
                      <Pill
                        tone={event.status === "cancelled" ? "red" : "green"}
                        label="Session status"
                      >
                        {event.status === "cancelled" ? "Cancelled" : "Completed"}
                      </Pill>
                    ) : null}
                    {event.invited ? (
                      <Pill tone="green" label="Invitation">
                        Invited
                      </Pill>
                    ) : null}
                  </div>

                  {href ? (
                    <Button
                      asChild
                      variant="outline"
                      size="xs"
                      className={styles.railAction}
                      style={{ height: 24 }}
                    >
                      <Link href={href} onClick={(e) => e.stopPropagation()}>
                        Open case
                        <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
