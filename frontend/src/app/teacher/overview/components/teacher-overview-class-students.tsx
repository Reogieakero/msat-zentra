"use client";

import * as React from "react";
import { BookOpen, CalendarClock, Users, type LucideIcon } from "lucide-react";
import { RowList, type RowListItem, type RowTone } from "@/components/ui/row-list";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { formatApproveDate } from "@/components/shared/adviser-access/adviser-access-types";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import type { ClassStudentRow } from "@/services/teacher/overview.types";

const RISK_TONE: Record<ClassStudentRow["riskLevel"], RowTone> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};

const FACTOR_TONE: Record<string, RowTone> = {
  academic: "amber",
  attendance: "green",
};

const FACTOR_LABEL: Record<string, string> = {
  academic: "Academic",
  attendance: "Attendance",
};

const FACTOR_ICON: Record<string, LucideIcon> = {
  academic: BookOpen,
  attendance: CalendarClock,
};

function toRowListItem(s: ClassStudentRow): RowListItem {
  return {
    key: `${s.sectionId}:${s.studentId}`,
    status: { label: s.riskLevel, tone: RISK_TONE[s.riskLevel] },
    title: s.name,
    idLabel: s.lrn,
    meta: [
      ...(s.flags ?? [])
        .filter((f) => f in FACTOR_TONE)
        .map((f) => ({ label: FACTOR_LABEL[f] ?? f, tone: FACTOR_TONE[f], icon: FACTOR_ICON[f] })),
      { label: s.section, tone: "muted" as RowTone, title: s.subjects.join(" · ") || s.section },
    ],
    detectedLabel: formatApproveDate(s.snapshotDate) ?? undefined,
    detectedTitle: s.snapshotDate
      ? `Detected ${new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
      : undefined,
    avatarMascot: { name: s.name, seed: s.lrn, character: s.mascot },
  };
}

interface TeacherOverviewClassStudentsProps {
  students: ClassStudentRow[];
  totalCount?: number;
}

export function TeacherOverviewClassStudents({ students }: TeacherOverviewClassStudentsProps) {
  const atRisk = React.useMemo(
    () => students.filter((s) => s.riskLevel !== "Low"),
    [students],
  );

  const [page, setPage] = React.useState(1);

  const items = React.useMemo(() => atRisk.map(toRowListItem), [atRisk]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <KanbanBoard
      title="My Class Students"
      icon={<Users size={14} aria-hidden className="text-blue-500" />}
      count={atRisk.length}
      ariaLabel="My class students"
      boardLabel={`My class students, ${atRisk.length} students`}
      footer={
        <Pagination
          currentPage={safePage}
          totalItems={items.length}
          onPageChange={(p) => setPage(p)}
        />
      }
    >
      {pageItems.length === 0 ? (
        <KanbanBoardEmpty>
          {atRisk.length === 0 ? "No at-risk students." : "No students match."}
        </KanbanBoardEmpty>
      ) : (
        <RowList
          bleed
          gutter="0.625rem"
          items={pageItems}
          emptyText="No at-risk students."
          ariaLabel="At-risk class students"
        />
      )}
    </KanbanBoard>
  );
}
