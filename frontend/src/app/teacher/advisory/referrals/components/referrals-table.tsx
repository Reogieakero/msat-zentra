"use client";
import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Loader2, MessageSquareText, RotateCcw, SearchIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { InsightCallout } from "@/components/ui/insight-callout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import listStyles from "../../list/components/advisory-list.module.css";
import { formatSurnameFirst } from "@/lib/names";
import { typeForDesk } from "./referral-types";
import { isWithdrawnDismissal, type ReferralRow } from "./use-my-referrals";
import { StudentMascot } from "./StudentMascot";
import { ReferralEmptyKanban, ReferralStarterKanban } from "./ReferralEmptyKanban";
import { ReferralStarterSidebar } from "./ReferralStarterSidebar";

type StatusMeta = { variant: "amber" | "blue" | "green" | "red" | "outline"; label: string };

/* Status tones are carried by the shared Pill, same palette the desk boards
   use; the tooltip (label) names the field. */
const STATUS_TONE: Record<StatusMeta["variant"], "amber" | "blue" | "green" | "red" | "neutral"> = {
  amber: "amber",
  blue: "blue",
  green: "green",
  red: "red",
  outline: "neutral",
};

// Escalated is not a teacher-side state: desks own escalation, so it stays
// out of the maps below. The helpers fall back to a red pill so a stray
// escalated row still renders instead of crashing the lookup.
const KNOWN_BADGE: Record<Exclude<ReferralRow["status"], "escalated">, StatusMeta> = {
  pending: { variant: "amber", label: "Pending" },
  in_progress: { variant: "blue", label: "In progress" },
  info_requested: { variant: "blue", label: "Info requested" },
  follow_up: { variant: "amber", label: "Follow up" },
  resolved: { variant: "green", label: "Resolved" },
  dismissed: { variant: "red", label: "Cancelled" },
};

export function statusBadge(status: ReferralRow["status"], dismissedByRole?: string | null): StatusMeta {
  if (status === "dismissed" && !isWithdrawnDismissal(dismissedByRole)) {
    return { variant: "red", label: "Rejected" };
  }
  return (
    KNOWN_BADGE[status as Exclude<ReferralRow["status"], "escalated">] ?? {
      variant: "red",
      label: humanize(status),
    }
  );
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isCancellable(status: ReferralRow["status"]): boolean {
  return status !== "resolved" && status !== "dismissed";
}

const REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
};

/** ADM stages where the case still sits with the consultation reviewer. */
const EARLY_ADM_STAGES = new Set(["anecdotal", "consultation"]);

/** Desk holding the case right now — same rule the referral cards used. */
function deskHolding(r: ReferralRow): string {
  const withReviewer =
    r.targetRole === "adm_coordinator" &&
    !!r.consultReviewer &&
    EARLY_ADM_STAGES.has(r.admStage ?? "consultation");
  return withReviewer && r.consultReviewer
    ? (REVIEWER_LABELS[r.consultReviewer] ?? humanize(r.consultReviewer))
    : humanize(r.targetRole);
}

function formatReferredDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ReferralsTable({
  referrals,
  unfilteredTotal,
  query,
  onQueryChange,
  highlightId,
  referralsQuery,
  onTrack,
  onRequestCancel,
  reopenPending,
  reopenRowId,
  onReferAgain,
  onNewReferral,
}: {
  referrals: ReferralRow[];
  total: number;
  unfilteredTotal: number;
  query: string;
  onQueryChange: (v: string) => void;
  highlightId: string | null;
  referralsQuery: { isPending: boolean; isError: boolean; isFetching: boolean; refetch: () => void };
  onTrack: (row: ReferralRow) => void;
  onRequestCancel: (row: ReferralRow) => void;
  reopenPending: boolean;
  reopenRowId: string | null;
  onReferAgain: (row: ReferralRow) => void;
  onNewReferral?: () => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "referred", desc: true },
  ]);
  const [reasonFor, setReasonFor] = React.useState<ReferralRow | null>(null);

  // Background refetches (e.g. after sending) keep the current list on
  // screen and patch it in place — skeletons only run on the very first
  // load, so the page never visibly refreshes.
  const isPageLoading =
    referralsQuery.isFetching && !referralsQuery.isPending && referrals.length === 0;

  const columns = React.useMemo<ColumnDef<ReferralRow>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) => `${formatSurnameFirst(row.studentName)} ${row.lrn}`,
        header: "Student",
        size: 230,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <StudentMascot
              name={row.original.studentName}
              seed={row.original.lrn}
              character={row.original.mascot ?? undefined}
              size={28}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className="block truncate text-[13px] font-semibold text-primary"
                title={row.original.studentName}
              >
                {formatSurnameFirst(row.original.studentName)}
              </span>
              <Pill className="tabular-nums self-start" label="LRN">
                {row.original.lrn}
              </Pill>
            </div>
          </div>
        ),
      },
      {
        id: "type",
        accessorFn: (row) => typeForDesk(row.targetRole).label,
        header: "Type",
        size: 120,
        cell: ({ row }) => {
          const type = typeForDesk(row.original.targetRole);
          return (
            <Pill tone={type.key === "adm" ? "amber" : "blue"} label="Referral type">
              {type.label}
            </Pill>
          );
        },
      },
      {
        id: "desk",
        accessorFn: (row) => deskHolding(row),
        header: "Desk",
        size: 160,
        cell: ({ row }) => (
          <Pill className="max-w-full overflow-hidden" label="Desk handling the case">
            <span className="truncate">{deskHolding(row.original)}</span>
          </Pill>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => statusBadge(row.status, row.dismissedByRole).label,
        header: "Status",
        size: 130,
        cell: ({ row }) => {
          const meta = statusBadge(row.original.status, row.original.dismissedByRole);
          return (
            <Pill tone={STATUS_TONE[meta.variant]} label="Referral status">
              {meta.label}
            </Pill>
          );
        },
      },
      {
        id: "referred",
        accessorFn: (row) => new Date(row.referredAt).getTime() || 0,
        header: "Referred",
        size: 130,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[12px] text-muted-foreground">
            {formatReferredDate(row.original.referredAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 240,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          const cancelled = r.status === "dismissed";
          const cancellable = isCancellable(r.status);
          return (
            <div
              className="flex items-center justify-end gap-1.5"
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                type="button"
                size="xs"
                variant="default"
                className="h-6 px-2 text-[11px]"
                onClick={() => onTrack(r)}
              >
                Track case
              </Button>
              {cancelled ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={reopenPending}
                  onClick={() => onReferAgain(r)}
                >
                  {reopenRowId === r.id ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw size={12} aria-hidden />
                  )}
                  {reopenRowId === r.id ? "Re-submitting…" : "Refer again"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-[11px] text-red-600 hover:text-red-600 dark:text-red-400"
                  disabled={!cancellable}
                  onClick={() => onRequestCancel(r)}
                >
                  <X size={12} aria-hidden />
                  {cancellable ? "Cancel" : "Cancel (closed)"}
                </Button>
              )}
              <span
                aria-hidden
                className="mx-0.5 h-4 w-px shrink-0 bg-border"
              />
              <button
                type="button"
                onClick={() => setReasonFor(r)}
                aria-label={`Show the reason ${r.studentName} was referred`}
                title="Reason for referral"
                className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted hover:text-foreground"
              >
                <MessageSquareText size={13} aria-hidden />
              </button>
            </div>
          );
        },
      },
    ],
    [onTrack, onRequestCancel, onReferAgain, reopenPending, reopenRowId],
  );

  const table = useReactTable({
    data: referrals,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  if (referralsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading referrals">
        <ZentraFilterBarSkeleton selects={1} />
        <ZentraTableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  if (referralsQuery.isError) {
    return (
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-col items-center gap-2 py-6 text-center">
          <p role="alert" className="font-medium">
            Could not load your referrals.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => referralsQuery.refetch()}
            disabled={referralsQuery.isFetching}
          >
            {referralsQuery.isFetching ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span aria-live="polite">Retrying</span>
              </>
            ) : (
              "Try again"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Only the truly empty desk gets the starter board; a search with no hits
  // keeps the data table on screen and shows its own "no match" row.
  if (referrals.length === 0 && unfilteredTotal === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-10rem)] w-full items-center justify-center">
        <div className="w-full">
          <ReferralEmptyKanban onNewReferral={onNewReferral} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy={isPageLoading || undefined}>
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={styles.sectionTitle}>Referrals</h2>
              <p className={styles.sectionDesc}>Your submitted referrals.</p>
            </div>
            <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
              <InputGroup className="max-w-40 shrink-0 rounded-[16px]">
                <InputGroupInput
                  placeholder="Filter referrals..."
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  aria-label="Filter referrals"
                />
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>

          {isPageLoading ? (
            <div className="relative" aria-hidden>
              <div className={`${listStyles.tableWrap} p-2`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="flex items-center gap-3 border-b border-border/60 px-2 py-3 last:border-b-0">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="ml-auto h-5 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className={listStyles.tableWrap}>
                <Table className="w-full table-fixed">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            style={{ width: header.getSize() }}
                            onClick={header.column.getToggleSortingHandler()}
                            className={`h-10 truncate whitespace-nowrap select-none ${
                              header.column.getCanSort() ? "cursor-pointer" : ""
                            }`}
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
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => {
                        const r = row.original;
                        const highlighted = highlightId !== null && highlightId === r.id;
                        return (
                          <TableRow
                            key={row.id}
                            id={`teacher-referral-${r.id}`}
                            data-highlighted={highlighted || undefined}
                            onClick={() => onTrack(r)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onTrack(r);
                              }
                            }}
                            tabIndex={0}
                            aria-label={`Referral for ${r.studentName}, ${statusBadge(r.status, r.dismissedByRole).label}`}
                            className={`${listStyles.row} ${highlighted ? listStyles.selected : ""}`}
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
                        );
                      })
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={columns.length} className="h-40 whitespace-normal">
                          <div className="flex w-full justify-center">
                            <InsightCallout role="status" className="w-full max-w-xl text-left">
                              <strong>No referrals match your search.</strong> Try a different
                              name, LRN, desk, or status — or clear the filter to see every
                              referral.
                            </InsightCallout>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                currentPage={table.getState().pagination.pageIndex + 1}
                totalItems={table.getPrePaginationRowModel().rows.length}
                onPageChange={(p) => table.setPageIndex(p - 1)}
              />
            </>
          )}
        </div>
        {!isPageLoading ? <ReferralStarterSidebar onNewReferral={onNewReferral} /> : null}
      </div>
      <div className="border-t border-border pt-4 lg:hidden" aria-label="Referral starter actions">
        <ReferralStarterKanban singleRow onNewReferral={onNewReferral} />
      </div>

      <KanbanOverlay
        open={reasonFor !== null}
        onClose={() => setReasonFor(null)}
        title="Reason for referral"
        ariaLabel={
          reasonFor ? `Reason for referral for ${reasonFor.studentName}` : "Reason for referral"
        }
        icon={
          <span className="text-amber-500" aria-hidden>
            <MessageSquareText size={16} />
          </span>
        }
        width="md"
        footer={
          reasonFor ? (
            <p className="m-0 px-1 pb-1 text-[11px] text-muted-foreground">
              Filed {formatReferredDate(reasonFor.referredAt)}
            </p>
          ) : undefined
        }
      >
        {reasonFor ? (
          <div className="flex min-w-0 flex-col gap-3 px-1 pb-1">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-white p-2.5 shadow-sm dark:bg-card">
              <StudentMascot
                name={reasonFor.studentName}
                seed={reasonFor.lrn}
                character={reasonFor.mascot ?? undefined}
                size={32}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className="truncate text-[13px] font-semibold text-foreground"
                  title={reasonFor.studentName}
                >
                  {formatSurnameFirst(reasonFor.studentName)}
                </span>
                <Pill className="tabular-nums self-start" label="LRN">
                  {reasonFor.lrn}
                </Pill>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <Pill tone={typeForDesk(reasonFor.targetRole).key === "adm" ? "amber" : "blue"} label="Referral type">
                {typeForDesk(reasonFor.targetRole).label}
              </Pill>
              <Pill tone={STATUS_TONE[statusBadge(reasonFor.status, reasonFor.dismissedByRole).variant]} label="Referral status">
                {statusBadge(reasonFor.status, reasonFor.dismissedByRole).label}
              </Pill>
              <Pill label="Desk handling the case">{deskHolding(reasonFor)}</Pill>
            </div>
            <p className="m-0 break-words text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
              {reasonFor.reason?.trim() || "No reason was recorded for this referral."}
            </p>
          </div>
        ) : null}
      </KanbanOverlay>
    </div>
  );
}
