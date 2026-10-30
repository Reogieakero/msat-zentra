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
  HeartHandshake,
  Radar,
} from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { toast } from "@/components/ui/sonner";
import { PrincipalEmptyCard, PrincipalEmptyState } from "../../../components/PrincipalEmptyCard";
import { riskTone } from "@/lib/labels/status-tone";
import { Pagination } from "@/components/shared/pagination";
import type { RiskSnapshotStudent, RiskLevelKey } from "../types";
import { apiErrorMessage } from "@/lib/api/errors";
import { alertGuidance, fetchInterventionStudents } from "@/services/principal/riskInterventions.service";
import { formatElapsedShort, msSinceDate as msSinceAction } from "@/lib/clock";
import { FactorBadges, canAlert, planStatus } from "./intervention-helpers";
import { useInterventionFilters, type InterventionActionFilter } from "./use-intervention-filters";
import { AlertGuidanceDialog } from "./alert-guidance-dialog";
import styles from "./InterventionsListTable.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";

const ACTION_TABS: { key: InterventionActionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "none", label: "No plan yet" },
  { key: "ongoing", label: "Ongoing" },
];

const RISK_TABS: { key: "all" | RiskLevelKey; label: string }[] = [
  { key: "all", label: "All levels" },
  { key: "High", label: "High" },
  { key: "Moderate", label: "Moderate" },
];

export function InterventionsListTable() {
  const queryClient = useQueryClient();
  const [alertTarget, setAlertTarget] = React.useState<RiskSnapshotStudent | null>(null);
  const [note, setNote] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "detected", desc: true },
  ]);
  const [page, setPage] = React.useState(1);
  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const {
    query,
    setQuery,
    riskFilter,
    setRiskFilter,
    actionFilter,
    setActionFilter,
    hasActiveFilters,
  } = useInterventionFilters();
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["interventions-list", termId, schoolYearId, page, debouncedQuery, riskFilter, actionFilter],
    queryFn: ({ signal }) =>
      fetchInterventionStudents(
        {
          riskLevel: riskFilter === "all" ? undefined : riskFilter,
          q: debouncedQuery.trim() || undefined,
          plan: actionFilter === "all" ? undefined : actionFilter,
          // Newest engine detection first — the queue itself is ordered the
          // same way server-side so page 1 holds the freshest flags.
          sort: "detected",
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
        size: 280,
        minSize: 280,
        maxSize: 280,
        cell: ({ row }) => (
          <div className={styles.studentCell}>
            <StudentMascot
              name={row.original.studentName}
              seed={row.original.lrn}
              character={row.original.mascot ?? undefined}
              size={30}
            />
            <span className={styles.studentBody}>
              <span className={styles.studentName}>{row.original.studentName}</span>
              <span className={styles.studentMeta}>
                <Pill tone="neutral" label="LRN" className="tabular-nums">
                  {row.original.lrn}
                </Pill>
                <Pill tone="amber" label="Section">
                  {row.original.section}
                </Pill>
              </span>
            </span>
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
        cell: ({ row }) => (
          <Pill tone={riskTone(row.original.riskLevel)} label="Risk level">
            {row.original.riskLevel}
          </Pill>
        ),
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
        id: "detected",
        accessorFn: (row) => row.snapshotDate ?? "",
        header: "Latest detected",
        sortDescFirst: true,
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => {
          const s = row.original;
          const detectedMs = msSinceAction(s.snapshotDate, Date.now());
          const elapsed =
            detectedMs === null ? null : formatElapsedShort(detectedMs);
          return (
            <div className="min-w-0">
              <p className={styles.actionLabel}>
                <Radar className={styles.actionIcon} aria-hidden />
                <span className="truncate">Detected by engine</span>
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
              <p
                className={styles.cellSub}
                aria-live="off"
                title={
                  s.snapshotDate
                    ? new Date(s.snapshotDate).toLocaleString()
                    : undefined
                }
              >
                {elapsed === null
                  ? "Not scored yet"
                  : elapsed === "just now"
                    ? "Just now"
                    : `${elapsed} ago`}
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
          const hasBookedSession = (iv?.sessions.length ?? 0) > 0;
          if (!hasBookedSession) {
            return <span className={styles.noIntervention}>No plan yet</span>;
          }
          return (
            <Pill tone="amber" label="Plan status">
              Ongoing
            </Pill>
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
  }, [debouncedQuery, riskFilter, actionFilter]);
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
    <>
    <KanbanBoard
      title="Intervention cases"
      icon={
        <span className="text-amber-600 dark:text-amber-400" aria-hidden="true">
          <HeartHandshake size={14} />
        </span>
      }
      headerCenter={
        <div className={styles.headerFilters}>
          <div
            className={styles.actionTabs}
            role="tablist"
            aria-label="Filter by plan action"
          >
            {ACTION_TABS.map((tab) => {
              const active = actionFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActionFilter(tab.key)}
                  className={styles.actionTab}
                >
                  <Pill
                    tone={active ? "blue" : "neutral"}
                    className={styles.filterPill}
                  >
                    {tab.label}
                  </Pill>
                </button>
              );
            })}
          </div>
          <span className={styles.filterDivider} aria-hidden>
            |
          </span>
          <div
            className={styles.actionTabs}
            role="tablist"
            aria-label="Filter by risk level"
          >
            {RISK_TABS.map((tab) => {
              const active = riskFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRiskFilter(tab.key)}
                  className={styles.actionTab}
                >
                  <Pill
                    tone={active ? "blue" : "neutral"}
                    className={styles.filterPill}
                  >
                    {tab.label}
                  </Pill>
                </button>
              );
            })}
          </div>
        </div>
      }
      actions={
        <div className={styles.headerActions}>
          <Pill tone="green" label="Data source" className={styles.filterPill}>
            Adviser-shared
          </Pill>
          <InputGroup className="max-w-40 shrink-0 rounded-[16px]">
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
    >
        {isPending ? (
          <div className="relative overflow-x-auto rounded-md border">
            <Table className="w-full table-fixed" aria-label="Loading intervention cases">
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
                <TableBody
                  key={`${safePage}-${actionFilter}-${riskFilter}-${debouncedQuery}`}
                  className={styles.cascadeRows}
                >
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row, rowIndex) => (
                      <TableRow
                        key={row.id}
                        style={{
                          animationDelay: `${450 + Math.min(rowIndex, 11) * 140}ms`,
                        }}
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
          </>
        )}
    </KanbanBoard>
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
    </>
  );
}
