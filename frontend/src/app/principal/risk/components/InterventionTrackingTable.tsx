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
import { Search, ChevronLeft, ChevronRight, ChevronDown, X, BellRing, Check } from "lucide-react";
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
import type { RiskLevelKey } from "../riskBoard";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { AuroraBanner } from "../../overview/components/AuroraBanner";
import styles from "./InterventionTrackingTable.module.css";

type OutcomeStatus = "ongoing" | "resolved" | "unresolved";
type ApprovalStatus = "pending" | "approved" | "rejected" | "modified";

interface InterventionLink {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignedStaffName: string | null;
  approvalStatus: ApprovalStatus;
  outcomeStatus: OutcomeStatus;
  createdAt: string | null;
  sessions: { status: string }[];
}

interface InterventionStudent {
  studentId: string;
  lrn: string;
  studentName: string;
  section: string;
  riskLevel: RiskLevelKey;
  intervention: InterventionLink | null;
}

const SECTION_LABEL: Record<OutcomeStatus, string> = {
  ongoing: "Ongoing",
  resolved: "Resolved",
  unresolved: "Unresolved",
};

const OUTCOME_VARIANT: Record<OutcomeStatus, "warning" | "outline" | "destructive"> = {
  ongoing: "warning",
  resolved: "outline",
  unresolved: "destructive",
};

/* Pipeline status — same language as the guidance desk: an opened case
   with zero sessions booked reads "No action yet" (the outcome row is
   still `ongoing`, so these rows keep matching the Ongoing filter). */
function pipelineStatus(link: InterventionLink | null): {
  label: string;
  variant: "warning" | "outline" | "destructive";
} {
  if (!link) return { label: "—", variant: "outline" };
  if (link.outcomeStatus !== "ongoing") {
    return {
      label: SECTION_LABEL[link.outcomeStatus],
      variant: OUTCOME_VARIANT[link.outcomeStatus],
    };
  }
  if (link.sessions.length === 0) {
    return { label: "No action yet", variant: "outline" };
  }
  return { label: SECTION_LABEL.ongoing, variant: OUTCOME_VARIANT.ongoing };
}

// Explicit variants (theme tokens are monochrome ink) — same as the
// guidance interventions desk.
const RISK_VARIANT: Record<string, "red" | "amber" | "green"> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};

const PAGE_SIZE = 8;

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

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

  // Cohort-wide total (pageSize 1 — only `total` is read) so the banner
  // below can count at-risk students with no follow-up yet. The table
  // itself stays scoped to students that have an intervention.
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

  const columns = React.useMemo<ColumnDef<InterventionStudent>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.studentName,
        header: "Student",
        size: 200,
        minSize: 200,
        maxSize: 200,
        cell: ({ row }) => (
          <div className={styles.studentCell}>
            <span className={styles.studentName}>{row.original.studentName}</span>
            <span className={styles.studentLrn}>{row.original.lrn}</span>
          </div>
        ),
      },
      {
        id: "section",
        accessorFn: (row) => row.section,
        header: "Section",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => (
          <span className={styles.section}>{row.original.section}</span>
        ),
      },
      {
        id: "risk",
        accessorFn: (row) => row.riskLevel,
        header: "Risk",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => (
          <Badge variant={RISK_VARIANT[row.original.riskLevel] ?? "outline"}>
            {row.original.riskLevel}
          </Badge>
        ),
      },
      {
        id: "assignee",
        accessorFn: (row) => row.intervention?.assignedStaffName ?? "",
        header: "Assigned to",
        size: 150,
        minSize: 150,
        maxSize: 150,
        cell: ({ row }) => (
          <span className={styles.assignee}>
            {row.original.intervention?.assignedStaffName ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.intervention?.outcomeStatus ?? "",
        header: "Status",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => {
          const status = pipelineStatus(row.original.intervention);
          return <Badge variant={status.variant}>{status.label}</Badge>;
        },
      },
      {
        id: "action",
        accessorFn: (row) => row.intervention?.recommendedAction ?? "",
        header: "Recommended action",
        size: 220,
        minSize: 220,
        maxSize: 220,
        enableSorting: false,
        cell: ({ row }) => (
          <span className={styles.action}>
            {row.original.intervention?.recommendedAction ?? "—"}
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
                <SkeletonRows />
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
            <span className={styles.skelCell} style={{ width: "60%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "46%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "70%" }} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
