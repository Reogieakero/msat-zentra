"use client";

import * as React from "react";
import { BookOpen, CalendarClock, ShieldAlert, type LucideIcon } from "lucide-react";
import { RowList, type RowListItem, type RowTone } from "@/components/ui/row-list";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { formatApproveDate } from "@/components/shared/adviser-access/adviser-access-types";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import type { AdvisoryStatusRow } from "@/services/teacher/overview.types";

const RISK_TONE: Record<AdvisoryStatusRow["riskLevel"], RowTone> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};

const FACTOR_TONE: Record<string, RowTone> = {
  academic: "amber",
  attendance: "green",
  behavioral: "blue",
};

const FACTOR_LABEL: Record<string, string> = {
  academic: "Academic",
  attendance: "Attendance",
  behavioral: "Behavioral",
};

const FACTOR_ICON: Record<string, LucideIcon> = {
  academic: BookOpen,
  attendance: CalendarClock,
  behavioral: ShieldAlert,
};

function toRowListItem(s: AdvisoryStatusRow): RowListItem {
  return {
    key: s.studentId,
    status: { label: s.riskLevel, tone: RISK_TONE[s.riskLevel] },
    title: s.name,
    idLabel: s.lrn,
    meta: (s.flags ?? [])
      .filter((f) => f in FACTOR_TONE)
      .map((f) => ({ label: FACTOR_LABEL[f] ?? f, tone: FACTOR_TONE[f], icon: FACTOR_ICON[f] })),
    detectedLabel: formatApproveDate(s.snapshotDate) ?? undefined,
    detectedTitle: s.snapshotDate
      ? `Detected ${new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
      : undefined,
    avatarMascot: { name: s.name, seed: s.lrn, character: s.mascot },
  };
}

interface TeacherOverviewRiskTableProps {
  students: AdvisoryStatusRow[];
  totalCount?: number;
}

export function TeacherOverviewRiskTable({ students }: TeacherOverviewRiskTableProps) {
  const atRisk = React.useMemo(
    () => students.filter((s) => s.flag !== "none" || (s.flags?.length ?? 0) > 0),
    [students],
  );

  const [page, setPage] = React.useState(1);

  const items = React.useMemo(() => atRisk.map(toRowListItem), [atRisk]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <KanbanBoard
      title="At-Risk Advisees"
      icon={<ShieldAlert size={14} aria-hidden className="text-red-500" />}
      count={atRisk.length}
      ariaLabel="At-risk advisees"
      boardLabel={`At-risk advisees, ${atRisk.length} students`}
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
          {atRisk.length === 0 ? "No at-risk advisees yet." : "No students match."}
        </KanbanBoardEmpty>
      ) : (
        <RowList
          bleed
          gutter="0.625rem"
          items={pageItems}
          emptyText="No at-risk advisees."
          ariaLabel="At-risk advisees"
        />
      )}
    </KanbanBoard>
  );
}
