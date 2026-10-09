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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  X,
} from "lucide-react";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { BackendStudent, RiskFactor } from "@/services/principal/riskStudents.types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./HighRiskStudentsTable.module.css";

const FACTOR_LABEL: Record<RiskFactor, string> = {
  Academic: "Academic",
  Attendance: "Attendance",
  Behavioral: "Behavioral",
};

const FACTOR_ACTIVE_CLASS: Record<RiskFactor, string> = {
  Academic: "factorAcademic",
  Attendance: "factorAttendance",
  Behavioral: "factorBehavioral",
} as const;

// Same palette as the teacher overview At-Risk Factors card
// (teacher-overview-risk.tsx RISK_COLORS): Academic amber, Attendance green,
// Behavioral blue.
const FACTOR_DOT: Record<RiskFactor, string> = {
  Academic: "#f59e0b",
  Attendance: "#22c55e",
  Behavioral: "#3b82f6",
};

const PAGE_SIZE = 15;

export function HighRiskStudentsTable() {
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.highRisk.search",
    ""
  );
  const [factorFilter, setFactorFilter] = usePersistentState<"all" | RiskFactor>(
    "zentra.risk.highRisk.factor",
    "all"
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [page, setPage] = React.useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["risk-students", "high", termId, schoolYearId, page, debouncedQuery, factorFilter],
    queryFn: async ({ signal }) => {
      const params: Record<string, string | number> = {
        page,
        pageSize: PAGE_SIZE,
        riskLevel: "High",
      };
      if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
      if (factorFilter !== "all") params.factor = factorFilter;
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

  // If filters shrink the result set under the current page (e.g. on page 3
  // of 45, then filter to 10), step back to the last valid page so the
  // requested page, the footer label, and the rows always agree.
  React.useEffect(() => {
    if (!isPending && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [isPending, totalPages, page]);

  const hasActiveFilters = factorFilter !== "all";

  const applySearch = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const applyFactor = (value: "all" | RiskFactor) => {
    setFactorFilter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setFactorFilter("all");
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
            <span className={styles.studentName}>{row.original.name}</span>
            <span className={styles.studentLrn}>{row.original.lrn}</span>
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
          <span className={styles.section}>{row.original.section}</span>
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
          <Badge variant="red">{row.original.riskLevel}</Badge>
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
            {(Object.keys(row.original.factors) as RiskFactor[]).map((f) => (
              <span
                key={f}
                className={`${styles.factorChip} ${
                  row.original.factors[f]
                    ? styles[FACTOR_ACTIVE_CLASS[f]]
                    : styles.factorOff
                }`}
              >
                {row.original.factors[f] ? (
                  <span
                    className={styles.factorDot}
                    style={{ background: FACTOR_DOT[f] }}
                    aria-hidden
                  />
                ) : null}
                {FACTOR_LABEL[f]}
              </span>
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
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  const isEmpty = !isPending && total === 0 && !debouncedQuery.trim() && !hasActiveFilters;
  if (isEmpty) {
    return (
      <div className={`${assign.card} ${styles.card}`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <PrincipalEmptyState
          icon={ShieldCheck}
          title="No high-risk students"
          hint="No high-risk students in the active term. Flagged students will appear here once detected."
        />
      </div>
    );
  }
  return (
    <div className={`${assign.card} ${styles.card}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h3 className="text-sm font-semibold">High Risk Students</h3>
          <p className="text-sm text-muted-foreground">
            Students flagged as high risk that need priority review —{" "}
            {total} student{total === 1 ? "" : "s"}.
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search name or LRN…"
              value={query}
              onChange={(e) => applySearch(e.target.value)}
              aria-label="Search high-risk students"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${
                  factorFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                Factor
                {factorFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={factorFilter === "all"}
                onCheckedChange={() => applyFactor("all")}
              >
                All factors
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(Object.keys(FACTOR_LABEL) as RiskFactor[]).map((f) => (
                <DropdownMenuCheckboxItem
                  key={f}
                  checked={factorFilter === f}
                  onCheckedChange={() => applyFactor(f)}
                >
                  {FACTOR_LABEL[f]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.clearBtn}
              onClick={clearFilters}
            >
              <X aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className={`${styles.content} relative`}>
        {isError && !isPending && rows.length === 0 ? (
          <div className={styles.empty} role="alert">
            <p>Couldn&apos;t load this page of high-risk students.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !isPending && total === 0 && !debouncedQuery.trim() && !hasActiveFilters ? (
          <PrincipalEmptyState
            icon={ShieldCheck}
            title="No high-risk students"
            hint="No high-risk students in the active term. Flagged students will appear here once detected."
          />
        ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="w-full table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                      className="h-10 cursor-pointer truncate whitespace-nowrap select-none"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isPending ? (
                <SkeletonRows />
              ) : tableRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className={styles.empty}>
                    {debouncedQuery.trim()
                      ? `No high-risk students match “${debouncedQuery}”.`
                      : hasActiveFilters
                        ? "No high-risk students match the selected filters."
                        : "No high-risk students."}
                  </TableCell>
                </TableRow>
              ) : (
                tableRows.map((row) => (
                  <TableRow key={row.id}>
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

      {total > PAGE_SIZE && (
        <div className={`${styles.footer} relative`}>
          <span className={styles.footerInfo} aria-live="polite">
            {total > 0 ? `${start}–${end} of ${total} · Page ${safePage} of ${totalPages}` : "0 of 0"}
          </span>
          <div className={styles.footerActions}>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1 || total === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages || total === 0 || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
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
