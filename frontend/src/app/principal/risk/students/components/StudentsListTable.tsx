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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { PrincipalEmptyState } from "../../../components/PrincipalEmptyCard";
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
import { FACTOR_LABELS, type BackendStudent, type RiskFactor, type RiskLevelKey } from "@/services/principal/riskStudents.types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./StudentsListTable.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";

const RISK_VARIANT: Record<RiskLevelKey, "red" | "amber" | "green"> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};

const RISK_RANK: Record<RiskLevelKey, number> = { High: 3, Moderate: 2, Low: 1 };

// Same palette as the teacher overview At-Risk Factors card:
// Academic amber, Attendance green, Behavioral blue.
const FACTOR_ACTIVE_CLASS: Record<RiskFactor, string> = {
  Academic: "factorAcademic",
  Attendance: "factorAttendance",
  Behavioral: "factorBehavioral",
} as const;

const FACTOR_DOT: Record<RiskFactor, string> = {
  Academic: "#f59e0b",
  Attendance: "#22c55e",
  Behavioral: "#3b82f6",
};

export function StudentsListTable({
  selectedSection,
  onSectionChange,
}: {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}) {
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.students.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.risk.students.risk",
    "all"
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [page, setPage] = React.useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  // Remember the last-visited page per heatmap selection: drilling back
  // into a previously visited section restores its cached page (which is
  // also still in the query cache, so it renders instantly with no
  // skeleton); brand-new selections start at page 1.
  const pageMemory = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    setPage(pageMemory.current[selectedSection] ?? 1);
  }, [selectedSection]);
  React.useEffect(() => {
    pageMemory.current[selectedSection] = page;
  }, [selectedSection, page]);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["risk-students-list", termId, schoolYearId, page, debouncedQuery, riskFilter, selectedSection],
    queryFn: async ({ signal }) => {
      const params: Record<string, string | number> = {
        page,
        pageSize: PAGE_SIZE,
      };
      if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
      if (selectedSection !== "all") params.section = selectedSection;
      if (riskFilter !== "all") params.riskLevel = riskFilter;
      const res = await apiClient.get<{ students: BackendStudent[]; total: number }>(
        "/api/risk/students",
        { params, signal }
      );
      return res.data;
    },
    // Visited pages stay cached: back/forward navigation within the
    // stale window serves instantly with no skeleton or refetch.
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
  // Refetch for a new section (not first load): replace rows with skeleton.
  const isSectionLoading = isFetching && !isPending;

  const students = React.useMemo(() => data?.students ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  // If filters shrink the result set under the current page, step back to
  // the last valid page so footer label, requested page, and rows agree.
  React.useEffect(() => {
    if (!isPending && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [isPending, totalPages, page]);

  const hasActiveFilters =
    debouncedQuery.trim() !== "" || selectedSection !== "all" || riskFilter !== "all";

  const applySearch = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const applyRisk = (value: "all" | RiskLevelKey) => {
    setRiskFilter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setQuery("");
    onSectionChange("all");
    setRiskFilter("all");
    setPage(1);
  };

  const columns = React.useMemo<ColumnDef<BackendStudent>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 240,
        minSize: 240,
        maxSize: 240,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.name}</p>
            <p className={styles.cellSub}>
              {row.original.lrn} · {row.original.section}
            </p>
          </div>
        ),
      },
      {
        id: "risk",
        accessorFn: (row) => RISK_RANK[row.riskLevel],
        header: "Risk",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => (
          <Badge variant={RISK_VARIANT[row.original.riskLevel]}>
            {row.original.riskLevel}
          </Badge>
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
                {FACTOR_LABELS[f]}
              </span>
            ))}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: students,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  const rows = table.getRowModel().rows;

  const isEmpty = !isPending && total === 0 && !hasActiveFilters;
  if (isEmpty) {
    return (
      <section aria-label="At-risk students">
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <PrincipalEmptyState
            icon={ShieldCheck}
            title="No at-risk students"
            hint="No at-risk students — nothing needs attention right now."
          />
        </div>
      </section>
    );
  }
  const showSkeleton = isPending || isSectionLoading;
  return (
    <section aria-label="At-risk students" aria-busy={showSkeleton || undefined}>
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className={`${styles.header} relative`}>
          <div className={styles.headerText}>
            <h2 className={styles.sectionTitle}>At-Risk Students</h2>
            <p className={styles.sectionDesc} aria-live="polite">
              {selectedSection === "all"
                ? showSkeleton
                  ? "All at-risk learners across every section — …"
                  : `All at-risk learners across every section — ${total} student${total === 1 ? "" : "s"}.`
                : showSkeleton
                  ? `At-risk learners in ${selectedSection} — …`
                  : `At-risk learners in ${selectedSection} — ${total} student${total === 1 ? "" : "s"}.`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                style={{ height: "2rem" }}
                placeholder="Search name or LRN…"
                value={query}
                onChange={(e) => applySearch(e.target.value)}
                aria-label="Search at-risk students"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ height: "2rem" }}
                  aria-label={`Filter students by risk level, currently showing: ${riskFilter === "all" ? "All levels" : riskFilter}`}
                  className={`${styles.filterBtn} ${
                    riskFilter !== "all" ? styles.filterActive : ""
                  }`}
                >
                  {riskFilter === "all" ? "Risk" : riskFilter}
                  {riskFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                <DropdownMenuCheckboxItem
                  checked={riskFilter === "all"}
                  onCheckedChange={() => applyRisk("all")}
                >
                  All levels
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {(["High", "Moderate", "Low"] as RiskLevelKey[]).map((lvl) => (
                  <DropdownMenuCheckboxItem
                    key={lvl}
                    checked={riskFilter === lvl}
                    onCheckedChange={() => applyRisk(lvl)}
                  >
                    {lvl}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={clearFilters}>
                <X aria-hidden />
                Show all
              </Button>
            )}
          </div>
        </div>

        <div className={`${styles.tableBody} relative`}>
          {showSkeleton ? (
            <div className={styles.tableWrap} aria-label="Loading students for selected section" aria-busy="true">
              <Table aria-label="At-risk students">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Factors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SkeletonRows />
                </TableBody>
              </Table>
            </div>
          ) : isError && rows.length === 0 ? (
            <div className={styles.empty} role="alert">
              <p className={styles.empty}>Couldn&apos;t load at-risk students.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <PrincipalEmptyState
              icon={ShieldCheck}
              title={
                debouncedQuery.trim()
                  ? "No matching students"
                  : hasActiveFilters
                    ? "No matching students"
                    : "No at-risk students"
              }
              hint={
                debouncedQuery.trim()
                  ? `No students match “${debouncedQuery}”.`
                  : hasActiveFilters
                    ? "No students match the selected filters."
                    : "No at-risk students — nothing needs attention right now."
              }
            />
          ) : (
            <div className={styles.tableWrap}>
              <Table aria-label="At-risk students" className="w-full table-fixed">
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
                  {rows.map((row) => (
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!showSkeleton && total > PAGE_SIZE && (
            <div className={styles.pager}>
              <p className={styles.range} aria-live="polite">
                {total > 0 ? `${start}–${end} of ${total} · Page ${safePage} of ${totalPages}` : "0 of 0"}
              </p>
              <div className={styles.pagerButtons}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1 || total === 0 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft aria-hidden />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
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
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <span className={styles.skelName} />
            <span className={styles.skelLrn} />
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
