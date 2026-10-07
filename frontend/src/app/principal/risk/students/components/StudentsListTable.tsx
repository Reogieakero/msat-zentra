"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  ChevronDown,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../../grade-mode-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { FACTOR_LABELS, type BackendStudent, type RiskFactor, type RiskLevelKey } from "@/services/principal/riskStudents.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./StudentsListTable.module.css";

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

const PAGE_SIZE = 20;

// Explicit variants (theme tokens are monochrome ink) — same as the
// guidance interventions desk.
const RISK_VARIANT: Record<RiskLevelKey, "red" | "amber" | "green"> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};

const RISK_RANK: Record<RiskLevelKey, number> = { High: 3, Moderate: 2, Low: 1 };

export function StudentsListTable({
  selectedSection,
  onSectionChange,
}: {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}) {
  const { gradeMode } = useGradeMode();
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.students.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.risk.students.risk",
    "all"
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const { data, isPending } = useQuery({
    queryKey: ["risk-students-list", termId, gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<{ students: BackendStudent[]; total: number }>(
        "/api/risk/students",
        { params: { pageSize: 50, gradeMode } }
      );
      return res.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const students = React.useMemo(() => data?.students ?? [], [data]);

  const sections = React.useMemo(() => {
    const seen = new Set<string>();
    for (const s of students) {
      if (s.section && s.section !== "—" && !seen.has(s.section)) seen.add(s.section);
    }
    return Array.from(seen).sort(
      (a, b) => gradeNum(a) - gradeNum(b) || a.localeCompare(b)
    );
  }, [students]);

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
    return students.filter((s) => {
      const matchesQuery =
        !q || s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q);
      const matchesSection = selectedSection === "all" || s.section === selectedSection;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesQuery && matchesSection && matchesRisk;
    });
  }, [students, query, selectedSection, riskFilter]);

  const hasActiveFilters =
    query.trim() !== "" || selectedSection !== "all" || riskFilter !== "all";

  const applySearch = (value: string) => {
    setQuery(value);
    setPageIndex(0);
  };

  const applySection = (value: string) => {
    onSectionChange(value);
    setPageIndex(0);
  };

  const applyRisk = (value: "all" | RiskLevelKey) => {
    setRiskFilter(value);
    setPageIndex(0);
  };

  const clearFilters = () => {
    setQuery("");
    onSectionChange("all");
    setRiskFilter("all");
    setPageIndex(0);
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
                  row.original.factors[f] ? styles.factorOn : styles.factorOff
                }`}
              >
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
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(safePageIndex + 1, totalPages);
  const start = total === 0 ? 0 : safePageIndex * PAGE_SIZE + 1;
  const end = Math.min((safePageIndex + 1) * PAGE_SIZE, total);

  return (
    <section aria-label="At-risk students">
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className={`${styles.header} relative`}>
          <div className={styles.headerText}>
            <h2 className={styles.sectionTitle}>At-Risk Students</h2>
            <p className={styles.sectionDesc}>
              {selectedSection === "all"
                ? `All at-risk learners across every section — ${total} student${total === 1 ? "" : "s"}.`
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
                  aria-label={`Filter students by section, currently showing: ${selectedSection === "all" ? "All sections" : selectedSection}`}
                  className={`${styles.filterBtn} ${
                    selectedSection !== "all" ? styles.filterActive : ""
                  }`}
                >
                  {selectedSection === "all" ? "Section" : selectedSection}
                  {selectedSection !== "all" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                <DropdownMenuCheckboxItem
                  checked={selectedSection === "all"}
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
                          checked={selectedSection === s}
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
          {isPending ? (
            <div className={styles.tableWrap}>
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
          ) : filtered.length === 0 ? (
            <p className={styles.empty}>
              {query.trim()
                ? `No students match “${query}”.`
                : hasActiveFilters
                  ? "No students match the selected filters."
                  : "No at-risk students — nothing needs attention right now."}
            </p>
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

          <div className={styles.pager}>
            <p className={styles.range}>
              Showing {start}–{end} of {total}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                size="xs"
                variant="outline"
                disabled={!table.getCanPreviousPage() || total === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className={styles.pageLabel} aria-live="polite">
                Page {safePage} of {totalPages}
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={!table.getCanNextPage() || total === 0}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
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
