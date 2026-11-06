"use client";

import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  formatManilaDateLong,
  formatManilaTime,
  venueLabel,
} from "@/services/coordinator/labels";
import board from "./BookSessionDialog.board.module.css";
import styles from "./BookedMeetingInfoPanel.module.css";

export interface BookedMeetingInfo {
  studentName: string;
  lrn?: string;
  grade?: string;
  datetime: string;
  venue: string;
  attended?: boolean;
  logbookRef?: string | null;
  /** Named invitees, when known. */
  invitees?: { id?: string; fullName?: string }[];
  /** Fallback count when only ids are known. */
  inviteeCount?: number;
}

/**
 * Details of a booked parent meeting as side-flyout content — the student
 * strip plus blue schedule pills, in the board language the desk already
 * uses. Rendered inside a KanbanBoard panel (case card submenu or overview
 * rail flyout), never as a centred modal.
 */
export function BookedMeetingInfoContent({ info }: { info: BookedMeetingInfo }) {
  const named = (info.invitees ?? []).filter((s) => s.fullName);
  const inviteeCount = named.length > 0 ? named.length : (info.inviteeCount ?? 0);

  return (
    <div className={styles.body}>
      <div className={board.caseStrip}>
        <StudentMascot
          name={info.studentName}
          seed={info.lrn ?? info.studentName}
          size={36}
        />
        <div className={board.caseText}>
          <span className={board.caseName}>{info.studentName}</span>
          <div className={board.casePills}>
            {info.lrn ? <Pill label="LRN">{info.lrn}</Pill> : null}
            {info.grade ? <Pill label="Section" tone="amber">{info.grade}</Pill> : null}
          </div>
        </div>
      </div>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>Date</dt>
          <dd className={styles.rowValue}>
            <span className={styles.pill}>
              {formatManilaDateLong(info.datetime)}
            </span>
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>Time</dt>
          <dd className={styles.rowValue}>
            <span className={styles.pill}>{formatManilaTime(info.datetime)}</span>
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>Venue</dt>
          <dd className={styles.rowValue}>
            <span className={styles.pill}>{venueLabel(info.venue)}</span>
          </dd>
        </div>
        {info.logbookRef ? (
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Logbook</dt>
            <dd className={styles.rowValue}>
              <span className={styles.pill}>{info.logbookRef}</span>
            </dd>
          </div>
        ) : null}
        <div className={styles.row}>
          <dt className={styles.rowLabel}>Invitees</dt>
          <dd className={styles.rowValue}>
            {named.length === 0 ? (
              <span className={styles.hint}>
                {inviteeCount > 0
                  ? `${inviteeCount} staff invited`
                  : "No staff invited"}
              </span>
            ) : (
              <span className={styles.invitees}>
                {named.map((s, i) => (
                  <span
                    key={s.id ?? `${s.fullName ?? "invitee"}-${i}`}
                    className={styles.pill}
                  >
                    {s.fullName}
                  </span>
                ))}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** KanbanBoard-wrapped meeting info — used in the case card menu submenu. */
export function BookedMeetingInfoPanel({
  info,
  onReschedule,
  reschedulePending = false,
  className,
}: {
  info: BookedMeetingInfo;
  onReschedule?: () => void;
  reschedulePending?: boolean;
  className?: string;
}) {
  return (
    <KanbanBoard
      title={info.attended ? "Attended meeting" : "Booked meeting"}
      icon={
        <span className="text-amber-500" aria-hidden>
          <CalendarClock size={14} />
        </span>
      }
      description="Scheduled parent meeting details."
      className={`border-0 ${className ?? ""}`}
      footer={
        onReschedule ? (
          <div className="flex justify-end gap-1.5 px-1 pb-1">
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onReschedule}
              disabled={reschedulePending}
            >
              {reschedulePending ? "Rescheduling…" : "Reschedule"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <BookedMeetingInfoContent info={info} />
    </KanbanBoard>
  );
}
