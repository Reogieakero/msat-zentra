"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  SearchIcon,
  ShieldCheck,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { StatusBadge } from "@/app/teacher/overview/components/teacher-overview-advisory";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PrincipalEmptyCard, PrincipalEmptyState } from "../../../components/PrincipalEmptyCard";
import type { RiskSnapshotStudent, RiskLevelKey } from "../types";
import { apiErrorMessage } from "@/lib/api/errors";
import { alertGuidance, fetchInterventionStudents } from "@/services/principal/riskInterventions.service";
import { formatElapsedShort, msSinceDate as msSinceAction } from "@/lib/clock";
import { ActionGlyph, FactorBadges, canAlert, latestAction, planStatus } from "./intervention-helpers";
import { useInterventionFilters } from "./use-intervention-filters";
import { AlertGuidanceDialog } from "./alert-guidance-dialog";
import styles from "./InterventionsListTable.module.css";
const PAGE_SIZE = 15;
export function InterventionsListTable() {
  const queryClient = useQueryClient();
  const [alertTarget, setAlertTarget] = React.useState<RiskSnapshotStudent | null>(null);
  const [note, setNote] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [page, setPage] = React.useState(1);
  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const {
    query,
    setQuery,
    riskFilter,
    setRiskFilter,
    hasActiveFilters,
  } = useInterventionFilters();
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["interventions-list", termId, schoolYearId, page, debouncedQuery, riskFilter],
    queryFn: ({ signal }) =>
      fetchInterventionStudents(
        {
          riskLevel: riskFilter === "all" ? undefined : riskFilter,
          q: debouncedQuery.trim() || undefined,
        },
        page,
        PAGE_SIZE,
        signal,
      ),
    // Visited pages stay cached: back/forward navigation within the stale
    // window serves instantly with skeleton only on genuine first loads.
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
  const students = React.useMemo(() => data?.students ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // If filters shrink the result set under the current page, step back to
  // the last valid page so footer label, requested page, and rows agree.
  React.useEffect(() => {
    if (!isPending && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [isPending, totalPages, page]);
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
                {canAlert(s) && s.intervention ? (
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
    data: students,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
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
  const isEmpty = !isPending && total === 0 && !debouncedQuery.trim() && !hasActiveFilters;
  React.useEffect(() => {
    setPage(1);
  }, [debouncedQuery, riskFilter]);
  if (isEmpty) {
    return (
      <PrincipalEmptyCard
        icon={ShieldCheck}
        title="No at-risk students yet"
        hint="Students flagged by the system will appear here once detected."
        label="Intervention cases"
        centered
      />
    );
  }
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
        ) : isError && students.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10" role="alert">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load intervention cases.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : students.length === 0 ? (
          <PrincipalEmptyState
            icon={ShieldCheck}
            title={
              debouncedQuery.trim() || hasActiveFilters
                ? "No matches"
                : "No at-risk students yet"
            }
            hint={
              debouncedQuery.trim()
                ? `No interventions match "${debouncedQuery}".`
                : hasActiveFilters
                  ? "No interventions match the selected filters."
                  : "Students flagged by the system will appear here once detected."
            }
          />
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
            <div className="relative flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-[0.8125rem] tabular-nums" aria-live="polite">
                {total > 0 ? `${start}–${end} of ${total} · Page ${safePage} of ${totalPages}` : "0 of 0"}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1 || isFetching}
                  >
                    <ChevronLeft aria-hidden />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={safePage >= totalPages || isFetching}
                  >
                    Next
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <AlertGuidanceDialog
        target={alertTarget}
        note={note}
        onNoteChange={setNote}
        pending={alertMutation.isPending}
        onClose={closeAlert}
        onSubmit={() => {
          if (!alertTarget) return;
          alertMutation.mutate({ id: alertTarget.studentId, note });
        }}
      />
    </section>
  );
}
