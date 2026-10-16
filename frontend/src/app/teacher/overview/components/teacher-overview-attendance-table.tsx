"use client";

import * as React from "react";
import { CalendarClock, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { RowList, type RowListItem, type RowTone } from "@/components/ui/row-list";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { useTerm } from "@/lib/term/TermContext";

interface MatrixSubject {
  id: string;
  name: string;
  code: string;
}

interface MatrixStudent {
  studentId: string;
  name: string;
  lrn: string;
  /** Persisted sprite mascot (StudentMascot pool); null falls back to the derived one. */
  mascot: string | null;
  rates: Record<string, number | null>;
}

interface AverageRow {
  studentId: string;
  name: string;
  lrn: string;
  mascot: string | null;
  average: number;
  risk: "Low" | "Moderate" | "High";
}

function overallAverage(rates: Record<string, number | null>): number {
  const rated = Object.values(rates).filter((r): r is number => r !== null);
  if (rated.length === 0) return 0;
  return rated.reduce((sum, r) => sum + r, 0) / rated.length;
}

const ATTENDANCE_AT_RISK_CUTOFF = 0.8;

function riskOf(average: number): "Low" | "Moderate" | "High" {
  if (average >= 0.9) return "Low";
  if (average >= ATTENDANCE_AT_RISK_CUTOFF) return "Moderate";
  return "High";
}

const RISK_TONE: Record<AverageRow["risk"], RowTone> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};

const AVERAGE_ICON: LucideIcon = CalendarClock;

function toRowListItem(s: AverageRow): RowListItem {
  return {
    key: s.studentId,
    status: { label: s.risk, tone: RISK_TONE[s.risk] },
    title: s.name,
    idLabel: s.lrn,
    meta: [
      {
        label: `${Math.round(s.average * 100)}%`,
        tone: RISK_TONE[s.risk],
        icon: AVERAGE_ICON,
        title: "Average present across all subjects this term",
      },
    ],
    avatarMascot: { name: s.name, seed: s.lrn, character: s.mascot },
  };
}

export function TeacherOverviewAttendanceTable({ sectionId }: { sectionId: string }) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const matrixQuery = useQuery({
    queryKey: ["attendance-section-matrix", sectionId, termKey],
    queryFn: async () => {
      const params = new URLSearchParams({ sectionId });
      const { data } = await apiClient.get<{
        sectionId: string;
        sectionName: string;
        termId: string;
        subjects: MatrixSubject[];
        students: MatrixStudent[];
      }>(`/api/attendance/section-subject-matrix?${params.toString()}`);
      return data;
    },
    retry: false,
  });

  const data = React.useMemo<AverageRow[]>(
    () =>
      (matrixQuery.data?.students ?? []).map((s) => {
        const average = overallAverage(s.rates);
        return {
          studentId: s.studentId,
          name: s.name,
          lrn: s.lrn,
          mascot: s.mascot,
          average,
          risk: riskOf(average),
        };
      }),
    [matrixQuery.data],
  );

  const [page, setPage] = React.useState(1);

  const items = React.useMemo(() => data.map(toRowListItem), [data]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const title = "Advisory Attendance";

  if (matrixQuery.isPending) {
    return (
      <section aria-label="Advisory attendance" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading attendance">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (matrixQuery.isError) {
    return (
      <section aria-label="Advisory attendance" className="flex min-w-0 flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">
          Could not load advisory attendance.
        </p>
      </section>
    );
  }

  return (
    <KanbanBoard
      title={title}
      icon={<CalendarClock size={14} aria-hidden className="text-amber-500" />}
      count={data.length}
      ariaLabel="Advisory attendance"
      boardLabel={`${title}, ${data.length} students`}
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
          {data.length === 0 ? "No students in this section yet." : "No students match."}
        </KanbanBoardEmpty>
      ) : (
        <RowList
          bleed
          gutter="0.625rem"
          items={pageItems}
          emptyText="No students in this section yet."
          ariaLabel="Advisory attendance"
        />
      )}
    </KanbanBoard>
  );
}
