"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { Search, ChevronLeft, ChevronRight, ChevronDown, X, BellRing, Check } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../grade-mode-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import type { RiskLevelKey } from "@/services/principal/risk.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { AuroraBanner } from "../../overview/components/AuroraBanner";
import styles from "./InterventionTrackingTable.module.css";
import { SECTION_LABEL, PAGE_SIZE, gradeNum, type InterventionStudent, type OutcomeStatus } from "./intervention-tracking-helpers";
import { buildInterventionTrackingColumns } from "./intervention-tracking-columns";
import { InterventionTrackingSkeleton } from "./intervention-tracking-skeleton";

export function InterventionTrackingTable() {
  const { gradeMode } = useGradeMode();
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.interventions.search",
    ""
  );
  const [statusFilter, setStatusFilter] = usePersistentState<"all" | OutcomeStatus>(
    "zentra.risk.interventions.status",
    "all"
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.risk.interventions.risk",
    "all"
  );
  const [sectionFilter, setSectionFilter] = usePersistentState<string>(
    "zentra.risk.interventions.section",
    "all"
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const { data, isPending } = useQuery({
    queryKey: ["risk-interventions", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: InterventionStudent[];
        total: number;
      }>("/api/risk/interventions", {
        params: { pageSize: 1000, hasIntervention: true, gradeMode },
      });
      return res.data;
    },
  });

  const { data: cohortData } = useQuery({
    queryKey: ["risk-interventions-cohort", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: InterventionStudent[];
        total: number;
      }>("/api/risk/interventions", {
        params: { pageSize: 1, gradeMode },
      });
      return res.data;
    },
    staleTime: 60_000,
  });

  const withoutFollowUp = Math.max(
    0,
    (cohortData?.total ?? 0) - (data?.total ?? 0),
  );

  const intervened = React.useMemo(
    () => (data?.students ?? []).filter((s) => s.intervention),
    [data]
  );

  const sections = React.useMemo(
    () =>
      Array.from(new Set(intervened.map((s) => s.section)))
        .filter((s) => s !== "—")
        .sort((a, b) => gradeNum(a) - gradeNum(b) || a.localeCompare(b)),
    [intervened]
  );

  const gradeGroups = React.useMemo(() => {
    const map = new Map<number, string[]>();
    for (const s of sections) {
      const g = gradeNum(s);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [sections]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return intervened.filter((s) => {
      const matchesQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q);
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      const matchesStatus =
        statusFilter === "all" || s.intervention?.outcomeStatus === statusFilter;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesQuery && matchesSection && matchesStatus && matchesRisk;
    });
  }, [intervened, query, sectionFilter, statusFilter, riskFilter]);

  const hasActiveFilters =
    sectionFilter !== "all" || statusFilter !== "all" || riskFilter !== "all";

  const applySearch = (value: string) => {
    setQuery(value);
    setPageIndex(0);
  };

  const applySection = (value: string) => {
    setSectionFilter(value);
    setPageIndex(0);
  };

  const applyStatus = (value: "all" | OutcomeStatus) => {
    setStatusFilter(value);
    setPageIndex(0);
  };

  const applyRisk = (value: "all" | RiskLevelKey) => {
    setRiskFilter(value);
    setPageIndex(0);
  };

  const clearFilters = () => {
    setSectionFilter("all");
    setStatusFilter("all");
    setRiskFilter("all");
    setPageIndex(0);
  };

  const columns = React.useMemo(() => buildInterventionTrackingColumns(), []);

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater;
      setPageIndex(next.pageIndex);
    },
  });

  const pageCount = table.getPageCount();
  const safePageIndex = Math.min(pageIndex, Math.max(0, pageCount - 1));
  const rows = table.getRowModel().rows;
  const start = filtered.length === 0 ? 0 : safePageIndex * PAGE_SIZE + 1;
  const end = Math.min((safePageIndex + 1) * PAGE_SIZE, filtered.length);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!isPending && cohortData ? (
        <AuroraBanner
          static
          icon={withoutFollowUp > 0 ? BellRing : Check}
          pill="Follow-up needed"
          count={withoutFollowUp}
          title={
            withoutFollowUp > 0
              ? "Awaiting first follow-up"
              : "Every at-risk student has a follow-up"
          }
          sub={
            withoutFollowUp > 0
              ? "At-risk students with no intervention yet — also listed on the guidance queue."
              : "Nothing awaiting a first follow-up."
          }
          accent={withoutFollowUp > 0 ? "#d97706" : "#22c55e"}
          label={`Students awaiting first follow-up: ${withoutFollowUp}`}
        />
      ) : null}
      <div className={`${assign.card} ${styles.card}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h3 className="text-sm font-semibold">Intervention Tracking</h3>
          <p className="text-sm text-muted-foreground">
            At-risk students with active or past interventions, and their outcome
            status — {filtered.length} student{filtered.length === 1 ? "" : "s"}.
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
              aria-label="Search interventions"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${
                  sectionFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                Section
                {sectionFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={sectionFilter === "all"}
                onCheckedChange={() => applySection("all")}
              >
                All sections
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {gradeGroups.length === 0 ? (
                <DropdownMenuItem disabled>No sections</DropdownMenuItem>
              ) : (
                gradeGroups.map(([grade, secs]) => (
                  <React.Fragment key={grade}>
                    <DropdownMenuLabel>Grade {grade}</DropdownMenuLabel>
                    {secs.map((s) => (
                      <DropdownMenuCheckboxItem
                        key={s}
                        checked={sectionFilter === s}
                        onCheckedChange={() => applySection(s)}
                      >
                        {s}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </React.Fragment>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${
                  statusFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                Status
                {statusFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "all"}
                onCheckedChange={() => applyStatus("all")}
              >
                All statuses
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(Object.keys(SECTION_LABEL) as OutcomeStatus[]).map((st) => (
                <DropdownMenuCheckboxItem
                  key={st}
                  checked={statusFilter === st}
                  onCheckedChange={() => applyStatus(st)}
                >
                  {SECTION_LABEL[st]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${
                  riskFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                Risk
                {riskFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={riskFilter === "all"}
                onCheckedChange={() => applyRisk("all")}
              >
                All risk levels
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(["High", "Moderate"] as RiskLevelKey[]).map((r) => (
                <DropdownMenuCheckboxItem
                  key={r}
                  checked={riskFilter === r}
                  onCheckedChange={() => applyRisk(r)}
                >
                  {r}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={clearFilters}>
              <X aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className={`${styles.content} relative`}>
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
                <InterventionTrackingSkeleton />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className={styles.empty}>
                    {query.trim()
                      ? `No interventions match “${query}”.`
                      : hasActiveFilters
                        ? "No interventions match the selected filters."
                        : "No students with interventions."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
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
      </div>

      <div className={`${styles.footer} relative`}>
        <span className={styles.footerInfo}>
          {filtered.length > 0 ? `${start}–${end} of ${filtered.length}` : "0 of 0"}
        </span>
        <div className={styles.footerActions}>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage() || filtered.length === 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage() || filtered.length === 0}
            onClick={() => setPageIndex((p) => p + 1)}
          >
            Next
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
    </div>
  );
}
