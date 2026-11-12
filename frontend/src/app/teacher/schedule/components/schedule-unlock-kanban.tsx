"use client";

import { createPortal } from "react-dom";
import { CalendarDays, Pencil, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import { Pill } from "@/components/ui/pill";
import { WEEK_LABELS_FULL, WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import styles from "./subject-kanban.module.css";
import type { ScheduleSection } from "../page";

interface Props {
  section: ScheduleSection;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Approved-schedule edit gate drawn as a Kanban board overlay (same shape as
 * the catalog confirm boards) instead of a plain card modal. Confirming only
 * starts a local edit session — the approved slots are not rewritten until the
 * user actually saves a change, so an abandoned edit leaves the principal's
 * sign-off untouched.
 */
export function ScheduleUnlockConfirm({ section, onCancel, onConfirm }: Props) {
  const slots = [...section.timetableEntries].sort(
    (a, b) => a.day - b.day || a.period - b.period,
  );
  const count = slots.length;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 dark:bg-black/70"
      role="alertdialog"
      aria-modal="true"
      aria-label={`Edit the approved schedule for ${section.name}`}
      onClick={onCancel}
    >
      <div className="w-full max-w-lg min-w-0" onClick={(e) => e.stopPropagation()}>
        <KanbanBoard
          title="Edit this approved schedule again?"
          icon={
            <span className="text-amber-500" aria-hidden>
              <CalendarDays size={14} />
            </span>
          }
          count={`${count} slot${count === 1 ? "" : "s"}`}
          description={
            <>
              Nothing changes yet. These slots stay approved while you edit — they only go back
              to draft when you save a change. Cancel and the principal&apos;s approval is
              untouched.
            </>
          }
          className="bg-card font-sans text-card-foreground shadow-2xl"
          footer={
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button
                onClick={onCancel}
                variant="outline"
                className="h-6 gap-1 px-2 font-sans text-[11px]"
              >
                <Undo2 size={12} aria-hidden />
                Keep approved
              </Button>
              <Button onClick={onConfirm} className="h-6 gap-1 px-2 font-sans text-[11px]">
                <Pencil size={12} aria-hidden />
                Start editing
              </Button>
            </div>
          }
        >
          <ScrollList className="max-h-[40dvh] gap-1.5 px-1" ariaLabel="Approved slots">
            {slots.map((entry) => (
              <div
                key={`${entry.day}:${entry.period}`}
                className={`${styles.card} min-w-0`}
                aria-label={`${entry.subject.name} — ${WEEK_LABELS_SHORT[entry.day - 1] ?? `Day ${entry.day}`}`}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`${styles.name} min-w-0 font-sans`}
                    title={entry.subject.name}
                  >
                    {entry.subject.name}
                  </span>
                  <span className="truncate font-sans text-[11px] text-muted-foreground">
                    {entry.teacherName?.name ?? "No teacher"}
                  </span>
                </span>
                <span className={styles.meta}>
                  <Pill
                    tone="neutral"
                    label={`Slot — ${WEEK_LABELS_FULL[entry.day - 1] ?? `Day ${entry.day}`}, Period ${entry.period + 1}`}
                  >
                    {WEEK_LABELS_SHORT[entry.day - 1] ?? `Day ${entry.day}`} · Period {entry.period + 1}
                  </Pill>
                  <Pill
                    tone="green"
                    label="Approved by the principal — stays approved until you save a change"
                  >
                    Approved
                  </Pill>
                </span>
              </div>
            ))}
            {slots.length === 0 ? (
              <p className="flex min-h-24 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">
                No approved slots yet.
              </p>
            ) : null}
          </ScrollList>
        </KanbanBoard>
      </div>
    </div>,
    document.body,
  );
}
