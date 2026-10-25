"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Inbox } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { SECTION_CARD_STATUS_META, sectionCardStatus } from "@/components/schedule/SectionScheduleCard";
import { scheduleTone } from "@/lib/labels/status-tone";
import styles from "./schedule.module.css";

export interface ScheduleEntry {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  reviewNote?: string | null;
  subject: { id: string; name: string; code: string };
  teacherName: { id: string; name: string } | null;
  submittedAt: string | null;
  submitter: { fullName: string } | null;
}

export interface ScheduleSection {
  id: string;
  name: string;
  gradeLevel: string;
  adviser: { fullName: string } | null;
  timetableEntries: ScheduleEntry[];
}

/** Every grade the desk covers — even when no sections exist yet. */
const ALL_GRADES = [7, 8, 9, 10, 11, 12] as const;

function gradeNumber(grade: string): number {
  return Number(grade.replace("G", "")) || 0;
}

function teacherCount(entries: ScheduleEntry[]): number {
  return new Set(entries.map((entry) => entry.teacherName?.id ?? "unassigned")).size;
}

/**
 * Schedule approval table — the shared KanbanBoard shell wrapped around a
 * data table, centered on the page. Grade-level filter chips are shared pills;
 * status chips use the same pill with the status-tone palette. Grades 11–12
 * stay listed even before they have sections or a master timetable.
 */
export function ScheduleTable({
  sections,
  onReview,
}: {
  sections: ScheduleSection[];
  onReview?: (section: ScheduleSection) => void;
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

  const visibleGrades = grade == null ? [...ALL_GRADES] : [grade];

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
        title="Schedule approval"
        icon={
          <span className="text-primary" aria-hidden>
            <CalendarDays size={14} />
          </span>
        }
        count={sections.length}
        description="Timetables sent by the master teacher appear here for review."
        ariaLabel="Schedule approval table"
        actions={
          <div className={styles.filterRow} role="group" aria-label="Filter by grade level">
            {filter(null, "All grades")}
            {ALL_GRADES.map((g) => filter(g, `Grade ${g}`))}
          </div>
        }
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Section</th>
                <th scope="col">Grade</th>
                <th scope="col">Adviser</th>
                <th scope="col">Teachers</th>
                <th scope="col">Status</th>
                <th scope="col" className={styles.actionCol}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleGrades.map((g) => {
                const rows = ordered.filter((s) => gradeNumber(s.gradeLevel) === g);
                if (rows.length === 0) {
                  return (
                    <tr key={`grade-${g}`}>
                      <td>
                        <span className={styles.sectionCell}>
                          <span className={styles.sectionName}>
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Inbox size={13} aria-hidden />
                              No sections yet
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={styles.mutedCell}>Grade {g}</td>
                      <td className={styles.mutedCell}>—</td>
                      <td className={styles.mutedCell}>—</td>
                      <td>
                        <Pill tone="neutral">Empty</Pill>
                      </td>
                      <td className={styles.actionCol} />
                    </tr>
                  );
                }
                return rows.map((section) => {
                  const status = sectionCardStatus(section.timetableEntries);
                  const meta = SECTION_CARD_STATUS_META[status];
                  const href = `/principal/academics/schedule/${section.id}`;
                  return (
                    <tr key={section.id}>
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
                      <td className={styles.mutedCell}>Grade {section.gradeLevel.replace("G", "")}</td>
                      <td className={styles.mutedCell} title={section.adviser?.fullName}>
                        {section.adviser?.fullName ? (
                          <Pill tone="amber" className="max-w-[16rem] overflow-hidden">
                            {section.adviser.fullName}
                          </Pill>
                        ) : (
                          <Pill tone="neutral">
                            <span className={styles.teacherNone}>No adviser</span>
                          </Pill>
                        )}
                      </td>
                      <td className={styles.mutedCell}>{teacherCount(section.timetableEntries)}</td>
                      <td>
                        <Pill tone={scheduleTone(status)}>{meta.label}</Pill>
                      </td>
                      <td className={styles.actionCol}>
                        <span className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="h-6 px-1.5 text-[11px]"
                            onClick={() => onReview?.(section)}
                            aria-label={`Review schedule for ${section.name}`}
                          >
                            Review
                            <ArrowRight size={12} aria-hidden />
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="xs"
                            className="h-6 px-1.5 text-[11px]"
                          >
                            <Link href={href} aria-label={`Open timetable for ${section.name}`}>
                              Open
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
