"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParentMeetingCard } from "../parent-meeting-card";
import type { CoordinatorCaseDetail } from "@/services/coordinator/coordinator.types";
import styles from "../case-page.module.css";
export function MeetingsPanel({
  orderedMeetings,
  latestMeetingId,
  now,
  meetingIdx,
  onMeetingIdx,
  onChanged,
  onAttendedConfirmed,
  onBook,
}: {
  orderedMeetings: CoordinatorCaseDetail["meetings"];
  latestMeetingId: string | null;
  now: number;
  meetingIdx: number | null;
  onMeetingIdx: (idx: number) => void;
  onChanged: () => void;
  onAttendedConfirmed: () => void;
  onBook: () => void;
}) {
  const total = orderedMeetings.length;
  const activeIdx =
    meetingIdx === null
      ? 0
      : Math.min(Math.max(0, meetingIdx), total - 1);
  return (
    <div className={styles.panel}>
      <div className={styles.cardTitleRow}>
        <h2 className={styles.cardTitle}>Parent meetings</h2>
        {total > 1 ? (
          <div className={styles.carouselNav}>
            <Button
              size="icon"
              variant="outline"
              className={styles.carouselBtn}
              disabled={activeIdx <= 0}
              onClick={() => onMeetingIdx(activeIdx - 1)}
              aria-label="Previous meeting schedule"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className={styles.carouselCount}>
              {activeIdx + 1} of {total}
            </span>
            <Button
              size="icon"
              variant="outline"
              className={styles.carouselBtn}
              disabled={activeIdx >= total - 1}
              onClick={() => onMeetingIdx(activeIdx + 1)}
              aria-label="Next meeting schedule"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
      {total === 0 ? (
        <div className={styles.emptyMeeting}>
          <p className={styles.muted}>
            No meeting booked yet — schedule one in school or as a home
            visitation.
          </p>
          <Button
            size="sm"
            className="h-6 px-3 text-xs"
            onClick={onBook}
            aria-label="Book a parent meeting"
          >
            Book schedule
          </Button>
        </div>
      ) : (
        <ul className={`${styles.evidenceList} ${styles.meetingsList}`}>
          {orderedMeetings.map((m, i) => (
            <ParentMeetingCard
              key={m.id}
              meeting={m}
              now={now}
              isLatest={m.id === latestMeetingId}
              active={i === activeIdx}
              onChanged={onChanged}
              onAttendedConfirmed={onAttendedConfirmed}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
