"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Inbox } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  SECTION_CARD_STATUS_META,
  sectionCardStatus,
  type StatusEntry,
} from "@/components/schedule/SectionScheduleCard";
import { scheduleTone } from "@/lib/labels/status-tone";
import styles from "./section-schedule-table.module.css";

export interface ScheduleEntry extends StatusEntry {
  day?: number;
  period?: number;
  subject?: { id: string; name: string; code: string };
  teacherName?: { id: string; name: string } | null;
  submittedAt?: string | null;
  submitter?: { fullName: string } | null;
}

export interface ScheduleSection {
  id: string;
  name: string;
  gradeLevel: string;
  adviser: { fullName: string } | null;
  timetableEntries: ScheduleEntry[];
}

/** Every grade the desks cover — even when no sections exist yet. */
const ALL_GRADES = [7, 8, 9, 10, 11, 12] as const;

function gradeNumber(grade: string): number {
  return Number(grade.replace("G", "")) || 0;
}

function teacherCount(entries: ScheduleEntry[]): number {
  return new Set(entries.map((entry) => entry.teacherName?.id ?? "unassigned")).size;
}

/**
 * Section timetable table — the shared KanbanBoard shell wrapped around a data
 * table, centered on the page. Used by the principal approval desk and the
 * teacher master-schedule desk so both read the same way: grade-level filter
 * chips are shared pills, status chips use the status-tone palette, and grades
 * stay listed even before they have sections. The table has no header row —
 * every cell is a labelled pill so the columns explain themselves.
 */
export function SectionScheduleTable({
  sections,
  onReview,
  hrefFor,
  linkTarget,
  title = "Schedule approval",
  description = "Timetables sent by the master teacher appear here for review.",
  emptyHint,
  grades = ALL_GRADES,
  actionLabel = "Open",
}: {
  sections: ScheduleSection[];
  onReview?: (section: ScheduleSection) => void;
  /** Resolves where a row's action points. */
  hrefFor?: (section: ScheduleSection) => string;
  /** Set to "_blank" to open the action in a new tab. */
  linkTarget?: "_blank";
  title?: string;
  description?: string;
  /** Overrides the per-grade "No sections yet" row copy. */
  emptyHint?: string;
  /** Grade numbers to list — defaults to every grade 7–12. */
  grades?: readonly number[];
  /** Label for the row action button. */
  actionLabel?: string;
}) {
  const [grade, setGrade] = React.useState<number | null>(null);

  const ordered = React.useMemo(
    () =>
      [...sections].sort(
        (a, b) =>
          gradeNumber(a.gradeLevel) - gradeNumber(b.gradeLevel) || a.name.localeCompare(b.name),
      ),
    [sections],
  );

  const visibleGrades = grade == null ? [...grades] : [grade];

  // Rows cascade in on mount and whenever the grade filter changes — the
  // tbody is keyed by the filter so it remounts and replays the stagger.
  // 1s per row starting at 0.45s, 140ms apart, capped at 11 steps — the deepest
  // row finishes at ~3s.
  let rowIndex = 0;
  const rowDelay = () => ({
    animationDelay: `${450 + Math.min(rowIndex++, 11) * 140}ms`,
  });

  const filter = (value: number | null, label: string) => {
    const active = grade === value;
    return (
      <button
        key={label}
        type="button"
        onClick={() => setGrade(value)}
        aria-pressed={active}
        className={styles.filterButton}
      >
        <Pill tone={active ? "blue" : "neutral"}>{label}</Pill>
      </button>
    );
  };

  return (
    <div className={styles.boardWrap}>
      <KanbanBoard
        title={title}
        icon={
          <span className="text-primary" aria-hidden>
            <CalendarDays size={14} />
          </span>
        }
        description={description}
        ariaLabel="Schedule table"
        actions={
          <div className={styles.filterRow} role="group" aria-label="Filter by grade level">
            {filter(null, "All grades")}
            {grades.map((g) => filter(g, `Grade ${g}`))}
          </div>
        }
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody key={grade ?? "all"}>
              {visibleGrades.map((g) => {
                const rows = ordered.filter((s) => gradeNumber(s.gradeLevel) === g);
                if (rows.length === 0) {
                  return (
                    <tr key={`grade-${g}`} style={rowDelay()}>
                      <td>
                        <span className={styles.sectionCell}>
                          <span className={styles.sectionName}>
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Inbox size={13} aria-hidden />
                              {emptyHint ?? "No sections yet"}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Pill tone="neutral" label="Grade">
                          Grade {g}
                        </Pill>
                      </td>
                      <td className={styles.mutedCell}>—</td>
                      <td className={styles.mutedCell}>—</td>
                      <td>
                        <Pill tone="neutral" label="Status">
                          Empty
                        </Pill>
                      </td>
                      <td className={styles.actionCol} />
                    </tr>
                  );
                }
                return rows.map((section) => {
                  const status = sectionCardStatus(section.timetableEntries);
                  const meta = SECTION_CARD_STATUS_META[status];
                  const href = hrefFor ? hrefFor(section) : "#";
                  return (
                    <tr key={section.id} style={rowDelay()}>
                      <td>
                        <span className={styles.sectionCell}>
                          <StudentMascot
                            name={section.name}
                            seed={`${section.name}:${section.gradeLevel}`}
                            size={28}
                          />
                          <span className={styles.sectionName} title={section.name}>
                            {section.name}
                          </span>
                        </span>
                      </td>
                      <td>
                        <Pill tone="neutral" label="Grade">
                          Grade {section.gradeLevel.replace("G", "")}
                        </Pill>
                      </td>
                      <td className={styles.mutedCell}>
                        {section.adviser?.fullName ? (
                          <Pill
                            tone="amber"
                            label="Adviser"
                            className="max-w-[16rem] overflow-hidden"
                          >
                            {section.adviser.fullName}
                          </Pill>
                        ) : (
                          <Pill tone="neutral" label="Adviser">
                            <span className={styles.teacherNone}>No adviser</span>
                          </Pill>
                        )}
                      </td>
                      <td className={styles.mutedCell}>{teacherCount(section.timetableEntries)}</td>
                      <td>
                        <Pill tone={scheduleTone(status)} label="Status">
                          {meta.label}
                        </Pill>
                      </td>
                      <td className={styles.actionCol}>
                        <span className="inline-flex items-center gap-1">
                          {/* Review only exists once the master teacher has
                              sent the timetable — drafts never reach that desk. */}
                          {onReview && status === "submitted" ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="xs"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => onReview(section)}
                              aria-label={`Review schedule for ${section.name}`}
                            >
                              Review
                              <ArrowRight size={12} aria-hidden />
                            </Button>
                          ) : null}
                          <Button
                            asChild
                            variant="default"
                            size="xs"
                            className="h-6 px-1.5 text-[11px]"
                          >
                            <Link
                              href={href}
                              target={linkTarget}
                              rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined}
                              aria-label={`Open timetable for ${section.name}`}
                            >
                              {actionLabel}
                              <ArrowUpRight size={12} aria-hidden />
                            </Link>
                          </Button>
                        </span>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </KanbanBoard>
    </div>
  );
}
