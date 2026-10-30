"use client";

import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Textarea } from "@/components/ui/textarea";
import {
  SECTION_CARD_STATUS_META,
  sectionCardStatus,
} from "@/components/schedule/SectionScheduleCard";
import { scheduleTone } from "@/lib/labels/status-tone";
import type { Submission } from "./use-principal-schedule-section";
import styles from "./review-dialog.module.css";

/**
 * Kanban-styled review overlay on the section desk. Same card language as the
 * list-page overlay: mascot + section/grade/teacher rows, status pill, action
 * footer. The owning hook closes it (and reports through the dock) once the
 * decision settles.
 */
export function ReviewDialog({
  open,
  onClose,
  submission,
  note,
  onNoteChange,
  formError,
  onReview,
  rejecting,
  approving,
  reviewPending,
}: {
  open: boolean;
  onClose: () => void;
  submission: Submission | null;
  note: string;
  onNoteChange: (v: string) => void;
  formError: string | null;
  onReview: (decision: "approve" | "reject") => void;
  rejecting: boolean;
  approving: boolean;
  reviewPending: boolean;
}) {
  const status = submission ? sectionCardStatus(submission.timetableEntries) : "empty";
  const meta = SECTION_CARD_STATUS_META[status];
  const submitted = submission
    ? submission.timetableEntries.filter((entry) => entry.status === "SUBMITTED").length
    : 0;
  const teacher = submission?.adviser?.fullName ?? null;

  return (
    <KanbanOverlay
      open={open}
      onClose={onClose}
      width="md"
      icon={
        <span className="text-primary" aria-hidden>
          <CalendarDays size={14} />
        </span>
      }
      title={`Review schedule for ${submission?.name ?? "section"}`}
      description="Approve the timetable or send it back to the master teacher with a revision note."
      dismissable={!reviewPending}
      busy={reviewPending}
      headerActions={<Pill tone={scheduleTone(status)}>{meta.label}</Pill>}
      footer={
        status === "approved" ? undefined : (
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onReview("reject")}
              disabled={reviewPending || submitted === 0}
              aria-busy={rejecting || undefined}
            >
              {rejecting ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : null}
              <span aria-live="polite">Reject</span>
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onReview("approve")}
              disabled={reviewPending || submitted === 0}
              aria-busy={approving || undefined}
            >
              {approving ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : null}
              <span aria-live="polite">Approve</span>
            </Button>
          </div>
        )
      }
    >
      {submission ? (
        <div className={styles.body}>
          <div className={styles.head}>
            <span className={styles.mascot}>
              <StudentMascot
                name={submission.name}
                seed={`${submission.name}:${submission.gradeLevel}`}
                size={48}
              />
            </span>
            <div className={styles.meta}>
              <p className={styles.row}>
                <span className={styles.label}>Section</span>
                <Pill tone="blue" label="Section">
                  {submission.name}
                </Pill>
              </p>
              <p className={styles.row}>
                <span className={styles.label}>Grade level</span>
                <Pill tone="neutral" label="Grade level">
                  Grade {submission.gradeLevel.replace("G", "")}
                </Pill>
              </p>
              <p className={styles.row}>
                <span className={styles.label}>Teacher</span>
                {teacher ? (
                  <Pill tone="amber" label="Teacher" className="max-w-[16rem] overflow-hidden">
                    {teacher}
                  </Pill>
                ) : (
                  <Pill tone="neutral" label="Teacher">
                    No adviser
                  </Pill>
                )}
              </p>
              <p className={styles.row}>
                <span className={styles.label}>Awaiting review</span>
                <span className={styles.value}>
                  {submitted} of {submission.timetableEntries.length} slots
                </span>
              </p>
            </div>
          </div>

          {submitted === 0 ? (
            <p className={styles.hint}>
              Nothing is submitted for this section yet — there is nothing to approve.
            </p>
          ) : (
            <>
              <Textarea
                autoFocus
                rows={4}
                placeholder="Revision note (required to send back)…"
                value={note}
                onChange={(event) => {
                  onNoteChange(event.target.value);
                }}
                aria-label={`Revision note for ${submission.name}`}
              />
              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
