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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../grade-mode-context";
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
import type { BackendStudent, RiskFactor } from "../students/api";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./HighRiskStudentsTable.module.css";

const FACTOR_LABEL: Record<RiskFactor, string> = {
  Academic: "Academic",
  Attendance: "Attendance",
  Behavioral: "Behavioral",
};

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

const PAGE_SIZE = 8;

export function HighRiskStudentsTable() {
  const { gradeMode } = useGradeMode();
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.highRisk.search",
    ""
  );
  const [sectionFilter, setSectionFilter] = usePersistentState<string>(
    "zentra.risk.highRisk.section",
    "all"
  );
  const [factorFilter, setFactorFilter] = usePersistentState<"all" | RiskFactor>(
    "zentra.risk.highRisk.factor",
    "all"
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const { data, isPending } = useQuery({
    queryKey: ["risk-students", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: BackendStudent[];
        total: number;
      }>("/api/risk/students", {
        params: { pageSize: 1000, gradeMode },
      });
      return res.data;
    },
  });

  const highRisk = React.useMemo(
    () => (data?.students ?? []).filter((s) => s.riskLevel === "High"),
    [data]
  );

  const sections = React.useMemo(
    () =>
      Array.from(new Set(highRisk.map((s) => s.section)))
        .filter((s) => s !== "—")
        .sort((a, b) => gradeNum(a) - gradeNum(b) || a.localeCompare(b)),
    [highRisk]
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
    return highRisk.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q);
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      const matchesFactor = factorFilter === "all" || s.factors[factorFilter];
      return matchesQuery && matchesSection && matchesFactor;
    });
  }, [highRisk, query, sectionFilter, factorFilter]);

  const hasActiveFilters = sectionFilter !== "all" || factorFilter !== "all";

  const applySearch = (value: string) => {
    setQuery(value);
    setPageIndex(0);
  };

  const applySection = (value: string) => {
    setSectionFilter(value);
    setPageIndex(0);
  };

  const applyFactor = (value: "all" | RiskFactor) => {
    setFactorFilter(value);
    setPageIndex(0);
  };

  const clearFilters = () => {
    setSectionFilter("all");
    setFactorFilter("all");
    setPageIndex(0);
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
                  row.original.factors[f] ? styles.factorOn : styles.factorOff
                }`}
              >
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
    <div className={`${assign.card} ${styles.card}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h3 className="text-sm font-semibold">High Risk Students</h3>
          <p className="text-sm text-muted-foreground">
            Students flagged as high risk that need priority review —{" "}
            {filtered.length} student{filtered.length === 1 ? "" : "s"}.
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
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className={styles.empty}>
                    {query.trim()
                      ? `No high-risk students match “${query}”.`
                      : hasActiveFilters
                        ? "No high-risk students match the selected filters."
                        : "No high-risk students."}
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
