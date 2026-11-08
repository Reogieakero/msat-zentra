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
  Search,
  ShieldCheck,
  Bell,
  HeartHandshake,
  Radar,
} from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { toast } from "@/components/ui/sonner";
import { PrincipalEmptyCard } from "../../../components/PrincipalEmptyCard";
import { riskTone } from "@/lib/labels/status-tone";
import { Pagination } from "@/components/shared/pagination";
import type { RiskSnapshotStudent, RiskLevelKey } from "../types";
import { apiErrorMessage } from "@/lib/api/errors";
import { alertGuidance, fetchInterventionCohort } from "@/services/principal/riskInterventions.service";
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
  } = useInterventionFilters();
  const { data, isPending, isError, refetch } = useQuery({
    // One unfiltered cohort per term: search + tabs filter in memory so typing
    // is instant and never stacks a second stale result set.
    queryKey: ["interventions-list", termId, schoolYearId],
    queryFn: ({ signal }) => fetchInterventionCohort(signal),
    // Visited desks stay cached: back/forward navigation within the stale
    // window serves instantly with skeleton only on genuine first loads.
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
  const allStudents = React.useMemo(() => data?.students ?? [], [data]);

  const filteredStudents = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allStudents.filter((student) => {
      if (riskFilter !== "all" && student.riskLevel !== riskFilter) return false;
      if (actionFilter === "ongoing" && planStatus(student) !== "ongoing")
        return false;
      if (actionFilter === "none" && planStatus(student) !== "none") return false;
      if (
        needle &&
        !`${student.studentName} ${student.lrn} ${student.section}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [allStudents, query, riskFilter, actionFilter]);

  const total = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const students = React.useMemo(
    () =>
      filteredStudents.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
      ),
    [filteredStudents, safePage],
  );

  // A new search/filter always starts at page 1.
  React.useEffect(() => {
    setPage(1);
  }, [query, riskFilter, actionFilter]);
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
  const isEmpty = !isPending && allStudents.length === 0;
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
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              type="search"
              placeholder="Search LRN or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search students"
              className={`${styles.searchInput} rounded-[16px]`}
              style={{ height: "2rem" }}
            />
          </div>
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
          <div className={styles.tableWrap}>
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
        ) : filteredStudents.length === 0 ? (
          <div className={styles.noMatch}>
            <InsightCallout role="status" className={styles.noMatchCallout}>
              {query.trim() ? (
                <>
                  <strong>No interventions match “{query.trim()}”.</strong> Try a
                  different name or LRN — or clear the search to see every
                  intervention case.
                </>
              ) : (
                <>
                  <strong>No interventions match the selected filters.</strong>{" "}
                  Try a different risk level or plan state.
                </>
              )}
            </InsightCallout>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <Table className="w-full table-fixed" aria-label="Intervention cases">
                <TableBody
                  key={`${safePage}-${actionFilter}-${riskFilter}-${query}`}
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
