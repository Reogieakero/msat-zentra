"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Clock, MapPin, GraduationCap, CalendarDays, ListChecks, ClipboardList } from "lucide-react";
import {
  ACTIVITY_AGENDA,
  WEEK_DATES,
  WEEK_LABELS_FULL,
  formatBlockTime,
  type ScheduleBlock,
} from "./classes-data";
import styles from "./ClassDetailDialog.module.css";

interface ClassDetailDialogProps {
  block: ScheduleBlock | null;
  onClose: () => void;
}

export function ClassDetailDialog({ block, onClose }: ClassDetailDialogProps) {
  const dayLabel = block ? WEEK_LABELS_FULL[block.day - 1] : "";
  const dateLabel = block ? WEEK_DATES[block.day - 1] : "";
  const timeLabel = block ? formatBlockTime(block.startMin, block.endMin) : "";
  const agenda = block ? ACTIVITY_AGENDA[block.activity] ?? [] : [];

  return (
    <Dialog
      open={block !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={styles.dialog}>
        {block ? (
          <>
            <DialogHeader className={styles.header}>
              <span
                className={styles.dot}
                style={{ "--detail": block.color } as React.CSSProperties}
                aria-hidden
              />
              <div className={styles.titleWrap}>
                <DialogTitle className={styles.title}>{block.subject}</DialogTitle>
                <DialogDescription className={styles.subtitle}>
                  {dayLabel} · {dateLabel}
                </DialogDescription>
              </div>
            </DialogHeader>

            <p className={styles.topic}>{block.topic}</p>

            <dl className={styles.meta}>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <Clock className={styles.metaIcon} aria-hidden />
                  Time
                </dt>
                <dd className={styles.metaValue}>{timeLabel}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <ClipboardList className={styles.metaIcon} aria-hidden />
                  Activity
                </dt>
                <dd className={styles.metaValue}>{block.activity}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <GraduationCap className={styles.metaIcon} aria-hidden />
                  Section
                </dt>
                <dd className={styles.metaValue}>{block.section}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <MapPin className={styles.metaIcon} aria-hidden />
                  Room
                </dt>
                <dd className={styles.metaValue}>{block.room}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <CalendarDays className={styles.metaIcon} aria-hidden />
                  Day
                </dt>
                <dd className={styles.metaValue}>
                  {dayLabel} · {dateLabel}
                </dd>
              </div>
            </dl>

            {agenda.length > 0 ? (
              <div className={styles.agenda}>
                <p className={styles.agendaTitle}>
                  <ListChecks className={styles.metaIcon} aria-hidden />
                  Class flow
                </p>
                <ol className={styles.agendaList}>
                  {agenda.map((step) => (
                    <li key={step} className={styles.agendaItem}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
