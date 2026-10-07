"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Bell,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Flag,
  Hourglass,
  SearchIcon,
  Send,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatElapsedShort, useNowTick } from "@/lib/clock";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { deriveActionStatus } from "@/services/nurse/labels";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import {
  formatActionTime,
  latestActionOf,
} from "../../referrals/components/nurse-referrals-format";
import {
  type NurseAlertItem,
  type NurseRiskLevel,
} from "./nurse-alerts-data";
import styles from "./nurse-alerts.module.css";

const PAGE_SIZE = 15;

type RiskFilter = "" | NurseRiskLevel | "none";

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "", label: "All risks" },
  { value: "High", label: "High" },
  { value: "Moderate", label: "Moderate" },
  { value: "Low", label: "Low" },
  { value: "none", label: "No level" },
];

/* Wall-clock ms of an alert's latest action. Null when unknown — those
   rows sink to the bottom of the sequence. */
function actionTimeOf(alert: NurseAlertItem): number | null {
  const { time } = latestActionOf(alert.row, alert);
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/* ms from the given action time to now. Null when unparseable — the cell
   then shows "—". Shared with the nurse ADM referrals queue. */
export function msSince(time: string, now: number): number | null {
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

/* Color-coded status badges — amber = needs action, blue = in motion,
   green = completed/forwarded, red = escalated or rejected, gray = closed.
   Unknown keys fall back to the raw-status variant. */
export function statusVariant(
  status: string
): "amber" | "blue" | "green" | "red" | "secondary" | "outline" {
  switch (status) {
    case "pending":
      return "amber";
    case "in_progress":
      return "blue";
    case "follow_up":
      return "blue";
    case "info_requested":
      return "outline";
    case "escalated":
      return "red";
    case "resolved":
      return "green";
    case "dismissed":
      return "red";
    default:
      return "outline";
  }
}

/* Badge variant per action-derived status key — the same vocabulary the
   overview charts use, so every surface agrees. Unknown keys fall back
   to the raw-status variant. Shared with the nurse ADM referrals queue. */
export const ACTION_STATUS_VARIANT: Record<
  string,
  "amber" | "blue" | "green" | "red" | "secondary" | "outline"
> = {
  endorsed: "green",
  done: "green",
  done_session: "green",
  booked: "blue",
  followup: "blue",
  rejected: "red",
  needs_review: "amber",
  escalated: "red",
};

export function RiskBadge({
  level,
  loading = false,
}: {
  level: NurseRiskLevel | undefined;
  loading?: boolean;
}) {
  if (loading && !level)
    return (
      <span className={styles.noRisk} role="status" aria-label="Loading risk level">
        …
      </span>
    );
  if (!level) return <span className={styles.noRisk}>—</span>;
  // Shared RAG convention (same as teacher/principal/guidance desks):
  // High red, Moderate amber, Low green.
  const variant = level === "High" ? "red" : level === "Moderate" ? "amber" : "green";
  return <Badge variant={variant}>{level}</Badge>;
}

export type ActionIcon = React.ComponentType<{ className?: string }>;

/* One icon per latest-action kind, matched by keyword on the action label.
   Shared with the nurse ADM referrals queue. */
export function actionIconFor(label: string): ActionIcon {
  const text = label.toLowerCase();
  if (text.includes("booked")) return CalendarPlus;
  if (text.includes("moved")) return CalendarClock;
  if (text.includes("done") || text.includes("resolv")) return CircleCheck;
  if (text.includes("cancel") || text.includes("reject")) return CircleX;
  if (text.includes("documentation") || text.includes("filed")) return FileText;
  if (text.includes("follow")) return Flag;
  if (text.includes("accept")) return Check;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("ready") ||
    text.includes("forward")
  )
    return Send;
  if (text.includes("review") || text.includes("needs")) return Eye;
  if (text.includes("waiting") || text.includes("information")) return Hourglass;
  return Bell;
}

/**
 * Every case referred to the nurse (ADM consultations + clinic matters) as
 * a data table: student, case status, live rule-based risk level, latest
 * action (name + elapsed since it ran), and the live countdown from when
 * the case was referred to right now. Read-only — handling happens on the
 * ADM Cases / Clinic Matters pages. Same card + table language as the
 * overview Needs-review table.
 */
export function NurseReferralsTable({
  alerts,
  riskByStudent,
  riskLoading = false,
  onChanged,
  query: controlledQuery,
  onQueryChange,
  page,
  totalPages,
  total: totalProp,
  unfilteredTotal,
  onPageChange,
  serverPaged = false,
}: {
  alerts: NurseAlertItem[];
  riskByStudent: Record<string, NurseRiskLevel>;
  riskLoading?: boolean;
  onChanged: () => void;
  /** Controlled server search (debounced by the page). Uncontrolled legacy
      fallback keeps the internal input when the page passes nothing. */
  query?: string;
  onQueryChange?: (v: string) => void;
  /** Server pager (page turns reuse previous data, never flash skeletons). */
  page?: number;
  totalPages?: number;
  /** Filtered pager count. */
  total?: number;
  /** UNFILTERED desk total — tiles never shrink on search. */
  unfilteredTotal?: number;
  onPageChange?: (p: number) => void;
  serverPaged?: boolean;
}) {
  const [internalQuery, setInternalQuery] = React.useState("");
  const [risk, setRisk] = React.useState<RiskFilter>("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const now = useNowTick();
  const query = controlledQuery ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;

  const filtered = React.useMemo(() => {
    // Server-searched when the page owns the query (?q=) — the table only
    // applies the client risk facet on the served page rows.
    const q = serverPaged ? "" : query.trim().toLowerCase();
    const rows = alerts.filter((a) => {
      if (risk !== "") {
        const level = a.studentId ? riskByStudent[a.studentId] : undefined;
        if (risk === "none") {
          if (level !== undefined) return false;
        } else if (level !== risk) {
          return false;
        }
      }
      if (
        q !== "" &&
        !`${a.row.student} ${a.row.lrn} ${a.row.section} ${a.row.reason} ${a.row.category}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    // Sequence by latest action time — most recently acted-on case first,
    // rows with no action time sink to the bottom.
    rows.sort((a, b) => {
      const at = actionTimeOf(a);
      const bt = actionTimeOf(b);
      if (at === null && bt === null) return 0;
      if (at === null) return 1;
      if (bt === null) return -1;
      return bt - at;
    });
    return rows;
  }, [alerts, query, risk, riskByStudent, serverPaged]);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setRisk("");
  }, [setQuery]);

  const columns = React.useMemo<ColumnDef<NurseAlertItem>[]>(
    () => [
      {
        id: "student",
        accessorFn: (alert) => alert.row.student,
        header: "Student",
        size: 200,
        minSize: 200,
        maxSize: 200,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.row.student}</p>
            <p className={styles.cellSub}>
              <span className={styles.lrn}>{row.original.row.lrn}</span>
            </p>
          </div>
        ),
      },
      {
        id: "type",
        accessorFn: (alert) => alert.row.type,
        header: "Type",
        size: 90,
        minSize: 90,
        maxSize: 90,
        cell: ({ row }) =>
          row.original.row.type === "ADM" ? (
            <Badge variant="secondary">ADM</Badge>
          ) : (
            <Badge variant="outline">Clinic</Badge>
          ),
      },
      {
        id: "status",
        accessorFn: (alert) =>
          deriveActionStatus(
            alert.row.type,
            alert.row.status,
            alert.row.sessions,
          ).label,
        header: "Case status",
        size: 170,
        minSize: 170,
        maxSize: 170,
        cell: ({ row }) => {
          const alert = row.original;
          const doneCount = alert.row.sessions.filter(
            (s) => s.status === "completed",
          ).length;
          const allDone =
            doneCount > 0 &&
            !alert.row.sessions.some((s) => s.status === "scheduled");
          // Action-based status — what the case actually needs now
          // (Endorsed, Booked session, Done, Needs review…) instead of the
          // raw database enum. Same vocabulary the overview charts use.
          const actionStatus = allDone
            ? { key: "done", label: "Done" }
            : deriveActionStatus(
                alert.row.type,
                alert.row.status,
                alert.row.sessions,
              );
          const statusVar =
            ACTION_STATUS_VARIANT[actionStatus.key] ??
            statusVariant(alert.row.status);
          return (
            <>
              <Badge variant={statusVar}>{actionStatus.label}</Badge>
              {doneCount > 0 && !allDone ? (
                <p className={styles.cellSub}>
                  {doneCount} session{doneCount === 1 ? "" : "s"} done
                </p>
              ) : null}
            </>
          );
        },
      },
      {
        id: "risk",
        accessorFn: (alert) =>
          alert.studentId ? (riskByStudent[alert.studentId] ?? "") : "",
        header: "Risk",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const alert = row.original;
          const level = alert.studentId
            ? riskByStudent[alert.studentId]
            : undefined;
          return <RiskBadge level={level} loading={riskLoading} />;
        },
      },
      {
        id: "latest",
        accessorFn: (alert) => latestActionOf(alert.row, alert).label,
        header: "Latest action",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => {
          const latest = latestActionOf(
            row.original.row,
            row.original,
          );
          const ActionIcon = actionIconFor(latest.label);
          return (
            <p className={styles.actionLabel}>
              <ActionIcon className={styles.actionIcon} aria-hidden />
              <span>{latest.label}</span>
            </p>
          );
        },
      },
      {
        id: "elapsed",
        accessorFn: (alert) => actionTimeOf(alert) ?? 0,
        header: "Time elapsed",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const latest = latestActionOf(
            row.original.row,
            row.original,
          );
          const actionMs = msSince(latest.time, now);
          return (
            <p className={styles.cellTime} aria-live="off">
              {actionMs === null
                ? "—"
                : `${formatElapsedShort(actionMs)} ago`}
            </p>
          );
        },
      },
      {
        id: "referred",
        accessorFn: (alert) => alert.row.date,
        header: "Date referred",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => (
          <p className={styles.cellMain}>
            {formatActionTime(row.original.row.date)}
          </p>
        ),
      },
      {
        id: "actions",
        header: () => <span className="flex justify-end">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const alert = row.original;
          // Deep-link to the page where this case lives — the page
          // auto-scrolls to and highlights it. ADM form-ready cases also
          // overlay the filled referral form (form=1); every other row
          // still lands highlighted on its own case.
          const homeBase =
            alert.row.type === "ADM"
              ? "/nurse/referrals/adm"
              : "/nurse/referrals/clinic";
          const seeMoreHref = `${homeBase}?highlight=${alert.row.id}`;
          const viewFormHref =
            alert.row.type === "ADM" && alert.row.referralReady
              ? `${seeMoreHref}&form=1`
              : seeMoreHref;
          return (
            <div className="flex justify-end">
              <NurseQueueRowActions
                row={alert.row}
                onChanged={onChanged}
                seeMoreHref={seeMoreHref}
                viewFormHref={viewFormHref}
                viewOnly
              />
            </div>
          );
        },
      },
    ],
    [now, onChanged, riskByStudent, riskLoading],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.key,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting },
  });

  // Filtered pager count (server total when server-paged) alongside the
  // UNFILTERED desk total so tiles never shrink on search.
  const total = serverPaged ? (totalProp ?? filtered.length) : filtered.length;
  const riskLabel =
    RISK_OPTIONS.find((o) => o.value === risk)?.label ?? "All risks";
  const hasActiveFilters = query.trim() !== "" || risk !== "";

  return (
    <div className={assign.card}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={styles.sectionTitle}>
            Referred cases — {total}
          </h2>
          <p className={styles.sectionDesc}>
            Every ADM and clinic matter on your desk — {total} case
            {total === 1 ? "" : "s"}
            {serverPaged &&
            unfilteredTotal !== undefined &&
            unfilteredTotal !== total
              ? ` (of ${unfilteredTotal} on your desk)`
              : ""}
            .
          </p>
        </div>
        {alerts.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <InputGroup className="max-w-40 shrink-0">
              <InputGroupInput
                placeholder="Search cases..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  table.setPageIndex(0);
                }}
                aria-label="Search referred cases"
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
                  aria-label={`Filter cases by risk level, currently showing: ${riskLabel}`}
                  className={`${styles.filterBtn} ${risk !== "" ? styles.filterActive : ""}`}
                >
                  {risk === "" ? "Risk" : riskLabel}
                  {risk !== "" && (
                    <span className={styles.filterDot} aria-hidden />
                  )}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {RISK_OPTIONS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={risk === item.value}
                    onCheckedChange={() => {
                      setRisk(item.value);
                      table.setPageIndex(0);
                    }}
                  >
                    {item.label}
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
                  clearFilters();
                  table.setPageIndex(0);
                }}
              >
                <X aria-hidden />
                Show all
              </Button>
            )}
          </div>
        )}
      </div>
      {alerts.length === 0 ? (
        <p className={`${styles.empty} relative`}>
          No referred cases — nothing needs your attention right now.
        </p>
      ) : filtered.length === 0 ? (
        <p className={`${styles.empty} relative`}>
          No cases match your search and filters.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-md border">
          <Table
            className="w-full table-fixed"
            aria-label="Cases referred to the nurse"
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-muted/50 [&>th]:border-t-0"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                      className="h-10 cursor-pointer truncate whitespace-nowrap select-none"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
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
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No cases match your search and filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="relative mt-auto flex items-center justify-end space-x-2 pt-2">
        <div className="text-muted-foreground flex-1 text-sm">
          {serverPaged && page !== undefined && totalPages !== undefined ? (
            <>
              Page {page} of {totalPages} — {total} case{total === 1 ? "" : "s"}
            </>
          ) : (
            <>
              {table.getFilteredRowModel().rows.length} case
              {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
            </>
          )}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              serverPaged && onPageChange && page !== undefined
                ? onPageChange(Math.max(1, page - 1))
                : table.previousPage()
            }
            disabled={
              serverPaged && page !== undefined
                ? page <= 1
                : !table.getCanPreviousPage()
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              serverPaged && onPageChange && page !== undefined
                ? onPageChange(page + 1)
                : table.nextPage()
            }
            disabled={
              serverPaged && page !== undefined && totalPages !== undefined
                ? page >= totalPages
                : !table.getCanNextPage()
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
