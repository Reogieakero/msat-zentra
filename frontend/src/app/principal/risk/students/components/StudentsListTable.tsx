"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Search,
  ShieldCheck,
} from "lucide-react";
import { PrincipalEmptyState } from "../../../components/PrincipalEmptyCard";
import { useTerm } from "@/lib/term/TermContext";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { riskTone } from "@/lib/labels/status-tone";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { FACTOR_LABELS, type BackendStudent, type RiskFactor, type RiskLevelKey } from "@/services/principal/riskStudents.types";
import { fetchAllRiskStudents } from "@/services/principal/riskStudents.service";
import styles from "./StudentsListTable.module.css";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";

const RISK_RANK: Record<RiskLevelKey, number> = { High: 3, Moderate: 2, Low: 1 };

// Shared Pill tones: Academic amber, Attendance green, Behavioral blue.
const FACTOR_TONE: Record<RiskFactor, "amber" | "green" | "blue"> = {
  Academic: "amber",
  Attendance: "green",
  Behavioral: "blue",
};

export function StudentsListTable({
  selectedSection,
}: {
  selectedSection: string;
}) {
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.students.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.risk.students.risk",
    "all"
  );
  const [page, setPage] = React.useState(1);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  // Whole at-risk roster (High + Moderate) loaded once per term. Search,
  // section/risk filters and paging then run in memory — typing never fires
  // a request and no stale page of rows is left behind.
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["risk-students-all", termId, schoolYearId],
    queryFn: fetchAllRiskStudents,
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  // A new heatmap selection is a new result set — start at page 1.
  React.useEffect(() => {
    setPage(1);
  }, [selectedSection]);

  const roster = React.useMemo(() => data ?? [], [data]);

  const sectionStudents = React.useMemo(
    () =>
      selectedSection === "all"
        ? roster
        : roster.filter((student) => student.section === selectedSection),
    [roster, selectedSection],
  );

  const needle = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    let list =
      riskFilter === "all"
        ? sectionStudents
        : sectionStudents.filter((student) => student.riskLevel === riskFilter);
    if (needle) {
      list = list.filter(
        (student) =>
          student.name.toLowerCase().includes(needle) ||
          student.lrn.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [sectionStudents, riskFilter, needle]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // Client-side slice of the filtered roster — no fetch, no stale rows.
  const rows = React.useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  // If filters shrink the result set under the current page, step back to
  // the last valid page so footer label, requested page, and rows agree.
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const hasActiveFilters =
    needle !== "" || selectedSection !== "all" || riskFilter !== "all";

  const applySearch = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const applyRisk = (value: "all" | RiskLevelKey) => {
    setRiskFilter(value);
    setPage(1);
  };

  const columns = React.useMemo<ColumnDef<BackendStudent>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 280,
        minSize: 280,
        maxSize: 280,
        cell: ({ row }) => (
          <div className={styles.studentCell}>
            <StudentMascot
              name={row.original.name}
              seed={row.original.lrn}
              character={row.original.mascot ?? undefined}
              size={30}
            />
            <span className={styles.studentMeta}>
              <span className={styles.studentName}>{row.original.name}</span>
              <Pill tone="neutral" label="LRN" className={styles.lrnPill}>
                {row.original.lrn}
              </Pill>
            </span>
          </div>
        ),
      },
      {
        id: "section",
        accessorFn: (row) => row.section,
        header: "Section",
        size: 150,
        minSize: 150,
        maxSize: 150,
        cell: ({ row }) => (
          <Pill tone="amber" label={row.original.gradeLevel}>
            {row.original.section}
          </Pill>
        ),
      },
      {
        id: "risk",
        accessorFn: (row) => RISK_RANK[row.riskLevel],
        header: "Risk",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => (
          <Pill tone={riskTone(row.original.riskLevel)} label="Risk level">
            {row.original.riskLevel}
          </Pill>
        ),
      },
      {
        id: "factors",
        accessorFn: (row) =>
          (Object.keys(row.factors) as RiskFactor[])
            .filter((f) => row.factors[f])
            .join(","),
        header: "Factors",
        size: 220,
        minSize: 220,
        maxSize: 220,
        enableSorting: false,
        cell: ({ row }) => (
          <span className={styles.factors}>
            {(Object.keys(row.original.factors) as RiskFactor[])
              .filter((f) => row.original.factors[f])
              .map((f) => (
                <Pill key={f} tone={FACTOR_TONE[f]} label={`${FACTOR_LABELS[f]} factor`}>
                  {FACTOR_LABELS[f]}
                </Pill>
              ))}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.studentId,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  const showSkeleton = isPending;
  return (
    <KanbanBoard
      title="At-Risk Students"
      icon={<ShieldCheck size={14} aria-hidden="true" />}
      actions={
        <>
          <Pill tone="green" label="Data source">
            Adviser-shared
          </Pill>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={`${styles.search} rounded-[16px]`}
              placeholder="Search name or LRN…"
              value={query}
              onChange={(e) => applySearch(e.target.value)}
              aria-label="Search at-risk students"
            />
          </div>
        </>
      }
      headerCenter={
        <div className={styles.filterRow} role="group" aria-label="Filter by risk level">
          {([
            { value: "all" as const, label: "All levels" },
            { value: "High" as const, label: "High risk" },
            { value: "Moderate" as const, label: "Moderate risk" },
          ]).map((option) => {
            const active = riskFilter === option.value;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => applyRisk(option.value)}
                aria-pressed={active}
                className={styles.filterButton}
              >
                <Pill tone={active ? "blue" : "neutral"} className={styles.filterPill}>
                  {option.label}
                </Pill>
              </button>
            );
          })}
        </div>
      }
      footer={
        <Pagination
          currentPage={safePage}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      }
      ariaLabel="At-risk students"
    >
        <div className={`${styles.tableBody} relative`} aria-busy={showSkeleton || undefined}>
          {showSkeleton ? (
            <div className={styles.tableWrap} aria-label="Loading students for selected section" aria-busy="true">
              <Table aria-label="At-risk students">
                <TableBody>
                  <SkeletonRows />
                </TableBody>
              </Table>
            </div>
          ) : isError && tableRows.length === 0 ? (
            <div className={styles.empty} role="alert">
              <p className={styles.empty}>Couldn&apos;t load at-risk students.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            needle ? (
              <div className={styles.noMatch}>
                <InsightCallout role="status" className={styles.noMatchCallout}>
                  <strong>No students match “{query.trim()}”.</strong> Try a
                  different name or LRN — or clear the search to see every
                  at-risk student.
                </InsightCallout>
              </div>
            ) : hasActiveFilters ? (
              <div className={styles.noMatch}>
                <InsightCallout role="status" className={styles.noMatchCallout}>
                  <strong>No students match the selected filters.</strong> Try a
                  different section or risk level, or reset to “All levels”.
                </InsightCallout>
              </div>
            ) : (
              <PrincipalEmptyState
                icon={ShieldCheck}
                title="No at-risk students"
                hint="No at-risk students — nothing needs attention right now."
              />
            )
          ) : (
            <div className={styles.tableWrap}>
              <Table aria-label="At-risk students" className="w-full table-fixed">
                <TableBody>
                  {tableRows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={styles.rowIn}
                      style={{ animationDelay: `${60 + Math.min(index, 11) * 45}ms` }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className="truncate"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

        </div>
    </KanbanBoard>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className={styles.studentCell}>
              <span className={styles.skelAvatar} />
              <span className={styles.studentMeta}>
                <span className={styles.skelName} />
                <span className={styles.skelLrn} />
              </span>
            </div>
          </TableCell>
          <TableCell>
            <span className={styles.skelChip} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "60%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.factors}>
              <span className={styles.skelChip} />
              <span className={styles.skelChip} />
            </span>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
