"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  ShieldCheck,
} from "lucide-react";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { riskTone } from "@/lib/labels/status-tone";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { BackendStudent, RiskFactor } from "@/services/principal/riskStudents.types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import styles from "./HighRiskStudentsTable.module.css";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";

const FACTOR_LABEL: Record<RiskFactor, string> = {
  Academic: "Academic",
  Attendance: "Attendance",
  Behavioral: "Behavioral",
};

// Amber = academic, green = attendance, blue = behavioral (teacher overview
// palette), matching the shared Pill tones.
const FACTOR_TONE: Record<RiskFactor, "amber" | "green" | "blue"> = {
  Academic: "amber",
  Attendance: "green",
  Behavioral: "blue",
};



export function HighRiskStudentsTable() {
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.highRisk.search",
    ""
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [page, setPage] = React.useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["risk-students", "high", termId, schoolYearId, page, debouncedQuery],
    queryFn: async ({ signal }) => {
      const params: Record<string, string | number> = {
        page,
        pageSize: PAGE_SIZE,
        riskLevel: "High",
      };
      if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
      const res = await apiClient.get<{
        students: BackendStudent[];
        total: number;
        page: number;
      }>("/api/risk/students", { params, signal });
      return res.data;
    },
    // Keep visited pages cached: back/forward navigation within the
    // stale window serves instantly with no skeleton or refetch.
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  const rows = React.useMemo(() => data?.students ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // If the result set shrinks under the current page (e.g. on page 3 of 45,
  // then search to 10), step back to the last valid page so the requested
  // page, the footer label, and the rows always agree.
  React.useEffect(() => {
    if (!isPending && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [isPending, totalPages, page]);

  const applySearch = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const columns = React.useMemo<ColumnDef<BackendStudent>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className={styles.studentCell}>
            <StudentMascot
              name={row.original.name}
              seed={row.original.lrn}
              character={row.original.mascot ?? undefined}
              size={30}
            />
            <div className={styles.studentMeta}>
              <span className={styles.studentName}>{row.original.name}</span>
              <Pill tone="neutral" label="LRN" className="w-fit">
                {row.original.lrn}
              </Pill>
            </div>
          </div>
        ),
      },
      {
        id: "section",
        accessorFn: (row) => row.section,
        header: "Section",
        size: 160,
        minSize: 160,
        maxSize: 160,
        cell: ({ row }) => (
          <Pill tone="amber" label="Section">
            {row.original.section}
          </Pill>
        ),
      },
      {
        id: "risk",
        accessorFn: (row) => row.riskLevel,
        header: "Risk",
        size: 130,
        minSize: 130,
        maxSize: 130,
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
                <Pill
                  key={f}
                  tone={FACTOR_TONE[f]}
                  label={`${FACTOR_LABEL[f]} factor`}
                >
                  {FACTOR_LABEL[f]}
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
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  const tableRows = table.getRowModel().rows;

  return (
    <KanbanBoard
      title="High Risk Students"
      icon={<ShieldCheck size={14} aria-hidden="true" />}
      description={
        <>
          Students flagged as high risk that need priority review —{" "}
          {total} student{total === 1 ? "" : "s"}.
        </>
      }
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
              aria-label="Search high-risk students"
            />
          </div>
        </>
      }
      footer={
        <Pagination
          currentPage={safePage}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      }
      className={styles.card}
    >
      <div className={`${styles.content} relative`}>
        {isError && !isPending && rows.length === 0 ? (
          <div className={styles.empty} role="alert">
            <p>Couldn&apos;t load this page of high-risk students.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !isPending && total === 0 && !debouncedQuery.trim() ? (
          <PrincipalEmptyState
            icon={ShieldCheck}
            title="No high-risk students"
            hint="No high-risk students in the active term. Flagged students will appear here once detected."
          />
        ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="w-full table-fixed">
            <TableBody>
              {isPending ? (
                <SkeletonRows />
              ) : tableRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className={styles.empty}>
                    {debouncedQuery.trim()
                      ? `No high-risk students match “${debouncedQuery}”.`
                      : "No high-risk students."}
                  </TableCell>
                </TableRow>
              ) : (
                tableRows.map((row, index) => (
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
                ))
              )}
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
              <span className={styles.skelName} />
              <span className={styles.skelLrn} />
            </div>
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "38%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.factors}>
              <span className={styles.skelChip} />
              <span className={styles.skelChip} />
              <span className={styles.skelChip} />
            </span>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
