"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  SearchIcon,
  ShieldCheck,
  Bell,
  CalendarPlus,
  Check,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Flag,
  Hourglass,
  Send,
  ChevronDown,
  X,
} from "lucide-react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useTerm } from "@/lib/term/TermContext";
import { useGradeMode } from "../../../grade-mode-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { CardModal } from "@/components/ui/CardModal";
import formStyles from "@/app/principal/academics/assign/components/form.module.css";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { StatusBadge } from "@/app/teacher/overview/components/teacher-overview-advisory";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { RiskSnapshotStudent, RiskLevelKey } from "../types";
import { alertGuidance, apiErrorMessage, fetchInterventionStudents } from "../api";
import styles from "./InterventionsListTable.module.css";

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

const PAGE_SIZE = 15;

// Factor badges: academic amber, attendance green, behavioral blue — same
// mapping as the teacher overview At-Risk Advisees table.
const FACTOR_BADGE: Record<string, { variant: "amber" | "green" | "blue"; label: string }> = {
  academic: { variant: "amber", label: "Academic" },
  attendance: { variant: "green", label: "Attendance" },
  behavioral: { variant: "blue", label: "Behavioral" },
};

function FactorBadges({ student }: { student: RiskSnapshotStudent }) {
  const active = (Object.keys(FACTOR_BADGE) as (keyof typeof FACTOR_BADGE)[]).filter(
    (f) => student.factors[f as keyof RiskSnapshotStudent["factors"]]
  );
  if (active.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {active.map((f) => (
        <Badge key={f} variant={FACTOR_BADGE[f].variant}>
          {FACTOR_BADGE[f].label}
        </Badge>
      ))}
    </span>
  );
}

/* Latest intervention activity — mirrors the guidance desk: newest session
   first (completed → "Session done", cancelled → "Session cancelled",
   otherwise booked), else the moment the intervention was opened. Session
   timing uses execution stamps, never the future appointment. */
function latestAction(s: RiskSnapshotStudent): { label: string; time: string } {
  const iv = s.intervention;
  const sessions = iv?.sessions ?? [];
  if (sessions.length > 0) {
    const actionTimeOf = (a: { completedAt: string | null; createdAt: string; scheduledAt: string }) =>
      a.completedAt || a.createdAt || a.scheduledAt;
    const sorted = [...sessions].sort((a, b) => {
      const at = new Date(actionTimeOf(a)).getTime();
      const bt = new Date(actionTimeOf(b)).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const newest = sorted[0];
    if (newest.status === "completed") {
      return {
        label: "Session done",
        time: newest.completedAt || newest.createdAt || newest.scheduledAt,
      };
    }
    if (newest.status === "cancelled") {
      return {
        label: "Session cancelled",
        time: newest.createdAt || newest.scheduledAt,
      };
    }
    return {
      label: "Session booked",
      time: newest.createdAt || newest.scheduledAt,
    };
  }
  if (!iv) return { label: "No follow-up yet", time: "" };
  const date = (iv.createdAt ?? "").slice(0, 10);
  if (iv.outcomeStatus === "resolved") return { label: "Marked resolved", time: date };
  if (iv.outcomeStatus === "unresolved") return { label: "Marked unresolved", time: date };
  return { label: "Intervention opened", time: date };
}

function msSinceAction(time: string, now: number): number | null {
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

function formatElapsedShort(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function planStatus(s: RiskSnapshotStudent): string {
  return s.intervention ? s.intervention.outcomeStatus : "none";
}

/* One icon per latest-action kind — same keyword mapping as the guidance
   desk (unresolved is checked before resolved since it contains "resolv").
   Static per-branch JSX (module scope) so no component is created during
   render. */
function ActionGlyph({ label, className }: { label: string; className?: string }) {
  const text = label.toLowerCase();
  const props = { className, "aria-hidden": true } as const;
  if (text.includes("booked")) return <CalendarPlus {...props} />;
  if (text.includes("unresolv") || text.includes("not resolv")) return <CircleX {...props} />;
  if (text.includes("done") || text.includes("resolv")) return <CircleCheck {...props} />;
  if (text.includes("cancel") || text.includes("reject")) return <CircleX {...props} />;
  if (text.includes("documentation") || text.includes("filed") || text.includes("note"))
    return <FileText {...props} />;
  if (text.includes("follow")) return <Flag {...props} />;
  if (text.includes("accept") || text.includes("approv")) return <Check {...props} />;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("assign") ||
    text.includes("intervention")
  )
    return <Send {...props} />;
  if (text.includes("review") || text.includes("needs")) return <Eye {...props} />;
  if (text.includes("waiting") || text.includes("information")) return <Hourglass {...props} />;
  return <Bell {...props} />;
}

// Principal is read-only here: alerting is only offered while guidance has
// taken no action (no plan yet) — mirrors the server gate.
function canAlert(s: RiskSnapshotStudent): boolean {
  return !s.intervention || s.intervention.outcomeStatus === "unresolved";
}

/* Intervention cases as a data table in the At-Risk Advisees pattern:
   glow-card shell, title + flagged count, filter on the right, fixed-width
   sortable columns, bordered table, pager footer. Rows are read-only —
   there is no detail sheet on this desk; per-row Alert guidance survives
   through the ⋯ menu. */
export function InterventionsListTable() {
  const queryClient = useQueryClient();
  const { gradeMode } = useGradeMode();
  const [query, setQuery] = usePersistentState<string>(
    "zentra.interventions.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.interventions.risk",
    "all"
  );
  const [sectionFilter, setSectionFilter] = usePersistentState<string>(
    "zentra.interventions.section",
    "all"
  );
  const [alertTarget, setAlertTarget] = React.useState<RiskSnapshotStudent | null>(null);
  const [note, setNote] = React.useState("");

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const { data, isPending } = useQuery({
    // Term-scoped: switching term refetches; stale 60s avoids remount storms.
    queryKey: ["interventions-list", termId, gradeMode],
    queryFn: () => fetchInterventionStudents({ gradeMode }, 1, 50),
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
        !q || s.studentName.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q);
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesQuery && matchesSection && matchesRisk;
    });
  }, [students, query, sectionFilter, riskFilter]);

  const hasActiveFilters = sectionFilter !== "all" || riskFilter !== "all";

  const columns = React.useMemo<ColumnDef<RiskSnapshotStudent>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.studentName,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.studentName}</p>
            <p className={styles.cellSub}>
              {row.original.lrn} · {row.original.section}
            </p>
          </div>
        ),
      },
      {
        id: "riskLevel",
        accessorFn: (row) => row.riskLevel,
        header: "Status",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => <StatusBadge level={row.original.riskLevel} />,
      },
      {
        id: "factor",
        accessorFn: (row) =>
          [
            row.factors.academic ? "academic" : "",
            row.factors.attendance ? "attendance" : "",
            row.factors.behavioral ? "behavioral" : "",
          ]
            .filter(Boolean)
            .join(","),
        header: "Factor",
        size: 200,
        minSize: 200,
        maxSize: 200,
        cell: ({ row }) => <FactorBadges student={row.original} />,
      },
      {
        id: "latest",
        accessorFn: (row) => latestAction(row).time,
        header: "Latest action",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => {
          const s = row.original;
          const action = latestAction(s);
          const actionMs = msSinceAction(action.time, Date.now());
          return (
            <div className="min-w-0">
              <p className={styles.actionLabel}>
                <ActionGlyph label={action.label} className={styles.actionIcon} />
                <span className="truncate">{action.label}</span>
                {canAlert(s) ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={styles.alertBtn}
                    aria-label={`Alert guidance about ${s.studentName}`}
                    onClick={() => {
                      setAlertTarget(s);
                      setNote("");
                    }}
                  >
                    <Bell aria-hidden />
                  </Button>
                ) : null}
              </p>
              <p className={styles.cellSub} aria-live="off">
                {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
              </p>
            </div>
          );
        },
      },
      {
        id: "plan",
        accessorFn: (row) => planStatus(row),
        header: "Plan",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => {
          const iv = row.original.intervention;
          if (!iv) return <span className={styles.noIntervention}>No plan</span>;
          return (
            <Badge
              variant={
                iv.outcomeStatus === "resolved"
                  ? "secondary"
                  : iv.outcomeStatus === "unresolved"
                    ? "destructive"
                    : "default"
              }
            >
              {iv.outcomeStatus === "ongoing"
                ? "Ongoing"
                : iv.outcomeStatus === "resolved"
                  ? "Resolved"
                  : "Unresolved"}
            </Badge>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting, columnFilters },
  });

  const alertMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      alertGuidance(id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["interventions-list"] });
      toast.success({
        title: "Guidance alerted",
        description: alertTarget
          ? `Guidance counselors were notified about ${alertTarget.studentName}.`
          : "Guidance counselors were notified.",
      });
      setAlertTarget(null);
      setNote("");
    },
    onError: (err) => {
      toast.error({
        title: "Could not alert guidance",
        description: apiErrorMessage(
          err,
          "The alert did not go through. Check your connection and try again."
        ),
      });
    },
  });

  const closeAlert = () => {
    if (alertMutation.isPending) return;
    setAlertTarget(null);
    setNote("");
  };

  return (
    <section aria-label="Intervention cases" className="flex min-w-0 flex-col gap-3">
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={styles.sectionTitle}>Intervention cases</h2>
            <p className={styles.sectionDesc}>
              Flagged by the system. Category only, never the private
              write-up.
            </p>
          </div>
          <div className={styles.headerActions}>
            <InputGroup className="max-w-40 shrink-0">
              <InputGroupInput
                placeholder="Filter students..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter students"
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
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
                  onCheckedChange={() => setSectionFilter("all")}
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
                          onCheckedChange={() => setSectionFilter(s)}
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
                  onCheckedChange={() => setRiskFilter("all")}
                >
                  All levels
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {(["High", "Moderate", "Low"] as RiskLevelKey[]).map((lvl) => (
                  <DropdownMenuCheckboxItem
                    key={lvl}
                    checked={riskFilter === lvl}
                    onCheckedChange={() => setRiskFilter(lvl)}
                  >
                    {lvl}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.clearBtn}
                onClick={() => {
                  setSectionFilter("all");
                  setRiskFilter("all");
                }}
              >
                <X aria-hidden />
                Clear
              </Button>
            )}
          </div>
        </div>

        {isPending ? (
          <div className="relative overflow-x-auto rounded-md border">
            <Table className="w-full table-fixed" aria-label="Loading intervention cases">
              <TableHeader>
                <TableRow className="bg-muted/50 [&>th]:border-t-0">
                  {["Student", "Status", "Factor", "Latest action", "Plan"].map((h) => (
                    <TableHead key={h} className="h-10 whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className={styles.skelName} />
                      <Skeleton className={styles.skelLrn} />
                    </TableCell>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className={styles.skelCell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <ShieldCheck size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">
              {query.trim() || hasActiveFilters
                ? "No matches"
                : "No at-risk students yet"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {query.trim()
                ? `No interventions match "${query}".`
                : hasActiveFilters
                  ? "No interventions match the selected filters."
                  : "Students flagged by the system will appear here once detected."}
            </p>
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto rounded-md border">
              <Table className="w-full table-fixed" aria-label="Intervention cases">
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
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
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
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No students match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="relative flex items-center justify-end space-x-2">
              <div className="text-muted-foreground flex-1 text-sm">
                {table.getFilteredRowModel().rows.length} student
                {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <CardModal
        open={alertTarget !== null}
        onClose={closeAlert}
        size="sm"
        title="Alert guidance"
        description={
          alertTarget
            ? `${alertTarget.studentName} (${alertTarget.lrn}) has no intervention action yet. This notifies every active guidance counselor.`
            : "Notify every active guidance counselor."
        }
        dismissable={!alertMutation.isPending}
        watchKey={alertTarget?.studentId}
      >
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for guidance…"
          rows={3}
          maxLength={500}
          aria-label="Optional note for guidance"
        />
        <div className={formStyles.dialogFooter}>
          <Button variant="outline" onClick={closeAlert} disabled={alertMutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={alertMutation.isPending || !alertTarget}
            aria-busy={alertMutation.isPending || undefined}
            onClick={() => {
              if (!alertTarget) return;
              alertMutation.mutate({ id: alertTarget.studentId, note });
            }}
          >
            {alertMutation.isPending ? "Alerting…" : "Alert guidance"}
          </Button>
        </div>
      </CardModal>
    </section>
  );
}
