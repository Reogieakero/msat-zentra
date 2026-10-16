"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, CalendarClock, SearchIcon, Users, type LucideIcon } from "lucide-react";
import { RowList, type RowListItem, type RowTone } from "@/components/ui/row-list";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import type { StudentListRow } from "@/services/teacher/studentList.types";

function attendanceTone(pct: number | null): RowTone {
  if (pct === null) return "amber";
  if (pct >= 90) return "green";
  if (pct >= 80) return "amber";
  return "red";
}

function gradeTone(grade: number | null): RowTone {
  if (grade === null) return "amber";
  if (grade >= 90) return "green";
  if (grade >= 75) return "blue";
  return "red";
}

const META_ICON: Record<string, LucideIcon> = {
  attendance: CalendarClock,
  academic: BookOpen,
};

function toRowListItem(row: StudentListRow): RowListItem {
  const pct = row.attendancePercentage;
  const grade = row.academicGrade;
  const hasMeetups = row.attendanceTotal > 0;
  const attendanceLabel = hasMeetups
    ? `${row.attendancePresent}/${row.attendanceTotal} present`
    : "No meetups yet";
  return {
    key: row.studentId,
    status: {
      label: pct === null ? "No record" : `${pct}%`,
      tone: attendanceTone(pct),
    },
    title: row.name,
    idLabel: row.lrn,
    meta: [
      {
        label: attendanceLabel,
        tone: hasMeetups ? ("muted" as RowTone) : ("amber" as RowTone),
        icon: META_ICON.attendance,
        title: hasMeetups
          ? `${row.attendancePresent} of ${row.attendanceTotal} meetups present`
          : "No attendance meetups yet",
        // Present count renders amber; denominator stays muted so the
        // two parts never share one color.
        labelNode: hasMeetups ? (
          <span className="inline-flex items-baseline gap-0.5">
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {row.attendancePresent}
            </span>
            <span className="text-muted-foreground">/{row.attendanceTotal} present</span>
          </span>
        ) : undefined,
      },
      {
        label: grade === null ? "No grade" : `${grade}`,
        tone: gradeTone(grade),
        icon: META_ICON.academic,
        title: grade === null ? "Academic grade not yet encoded" : `Academic grade ${grade}`,
      },
      {
        label:
          row.computedAverage !== null
            ? `Avg ${Math.round(row.computedAverage * 10) / 10}`
            : "Not encoded",
        tone: row.computedAverage !== null ? ("muted" as RowTone) : ("amber" as RowTone),
        title:
          row.computedAverage !== null
            ? `Computed average ${row.computedAverage}`
            : "Computed average not yet encoded",
      },
    ],
    avatarMascot: { name: row.name, seed: row.lrn, character: row.mascot },
  };
}

export function StudentTable({
  headerTitle,
  rows,
  rosterPending,
  rosterError,
  emptySectionName,
}: {
  headerTitle: React.ReactNode;
  rows: StudentListRow[];
  rosterPending: boolean;
  rosterError: boolean;
  emptySectionName: string;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.lrn.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const items = React.useMemo(() => filtered.map(toRowListItem), [filtered]);

  const reduceMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
    >
    <KanbanBoard
      title={headerTitle}
      icon={<Users size={14} aria-hidden className="text-blue-500" />}
      actions={
        <InputGroup className="w-36 rounded-[16px] sm:w-44">
          <InputGroupInput
            placeholder="Filter students..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            aria-label="Filter students"
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
      }
      ariaLabel="Student list"
      boardLabel="Student list"
    >
      {rosterPending ? (
        <KanbanBoardEmpty>Loading students…</KanbanBoardEmpty>
      ) : rosterError ? (
        <p role="alert" className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-destructive">
          Could not load students for this class.
        </p>
      ) : rows.length === 0 ? (
        <KanbanBoardEmpty>
          {emptySectionName
            ? `No students in ${emptySectionName} yet.`
            : "No students in this section yet."}
        </KanbanBoardEmpty>
      ) : items.length === 0 ? (
        <KanbanBoardEmpty>No students match your search.</KanbanBoardEmpty>
      ) : (
        <RowList
          bleed
          gutter="0.625rem"
          items={items}
          emptyText="No students match your search."
          ariaLabel="Student list"
        />
      )}
    </KanbanBoard>
    </motion.div>
  );
}
