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
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  deriveActionStatus,
  type NurseQueueRow,
} from "./nurse-overview-data";
import { NurseQueueRowActions } from "./NurseQueueRowActions";
import { NurseAdmReviewDialog } from "./NurseAdmReviewDialog";
import { NurseForwardAdmButton } from "./NurseForwardAdmButton";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseAdmReferralFormSheet } from "../../referrals/components/NurseAdmReferralFormSheet";
import styles from "./nurse-overview.module.css";

/* Status badge follows what the nurse actually did with the referral —
   the same action vocabulary as the overview KPI cards and charts. */
function NurseActionBadge({ row }: { row: NurseQueueRow }) {
  const action = deriveActionStatus(row.type, row.status, row.sessions);
  switch (action.key) {
    case "endorsed":
    case "done":
    case "done_session":
      return <Badge variant="green">{action.label}</Badge>;
    case "rejected":
      return <Badge variant="red">{action.label}</Badge>;
    case "needs_review":
      return <Badge variant="amber">{action.label}</Badge>;
    case "escalated":
      return <Badge variant="red">{action.label}</Badge>;
    case "booked":
    case "followup":
      return <Badge variant="blue">{action.label}</Badge>;
    default:
      return <Badge variant="outline">{action.label}</Badge>;
  }
}

/* Elapsed wait from the referred time to now — days / hours / minutes,
   never seconds. */
function waitingElapsed(referredAt: string, nowMs: number): string {
  if (!referredAt) return "—";
  const t = new Date(referredAt).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.floor(Math.max(0, nowMs - t) / 60_000);
  if (mins < 1) return "Just now";
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (mins % 60 > 0) parts.push(`${mins % 60}m`);
  return parts.join(" ");
}

/* Minute-precision clock is enough (no seconds displayed) — re-renders
   twice a minute so the Waiting column stays fresh. */
function useNowMs(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

export function NurseNeedsReviewPanel({
  needsReview,
  title = "Needs your review",
  description = "Pending cases routed to the clinic, longest waiting first.",
  emptyText = "All caught up — nothing waiting for review.",
}: {
  needsReview: NurseQueueRow[];
  title?: string;
  description?: string;
  emptyText?: string;
}) {
  const [formSheet, setFormSheet] = React.useState<{
    row: NurseQueueRow;
    draft: AdmReviewDraft;
  } | null>(null);
  const queryClient = useQueryClient();
  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk-levels"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk-factors"] });
  }, [queryClient]);
  const nowMs = useNowMs();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columns = React.useMemo<ColumnDef<NurseQueueRow>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) => row.student,
        header: "Student",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.student}</p>
            <p className={styles.cellSub}>{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "grade",
        accessorFn: (row) => row.grade,
        header: "Grade",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.grade}</span>
        ),
      },
      {
        id: "type",
        accessorFn: (row) => row.type,
        header: "Type",
        cell: ({ row }) =>
          row.original.type === "ADM" ? (
            <Badge variant="blue">ADM case</Badge>
          ) : (
            <Badge variant="secondary">Clinic</Badge>
          ),
      },
      {
        id: "category",
        accessorFn: (row) => row.category,
        header: "Category",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.category}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) =>
          deriveActionStatus(
            row.type,
            row.status,
            row.sessions,
          ).label,
        header: "Case status",
        cell: ({ row }) => <NurseActionBadge row={row.original} />,
      },
      {
        id: "elapsed",
        accessorFn: (row) => {
          const t = new Date(row.referredAt).getTime();
          return Number.isFinite(t) ? t : 0;
        },
        header: "Time elapsed",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {waitingElapsed(row.original.referredAt, nowMs)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          // Same deep-links as the alerts table — the case page
          // auto-scrolls to and highlights the row; ADM form-ready cases
          // also overlay the filled form.
          const homeBase =
            item.type === "ADM"
              ? "/nurse/referrals/adm"
              : "/nurse/referrals/clinic";
          const seeMoreHref = `${homeBase}?highlight=${item.id}`;
          // Every ADM case overlays its GCForm-03 (pending or endorsed,
          // including legacy endorsements) — same as the guidance ADM
          // "See referral form" behavior.
          const viewFormHref =
            item.type === "ADM" ? `${seeMoreHref}&form=1` : seeMoreHref;
          return (
            <div className={styles.cellActions}>
              {item.type === "ADM" &&
                item.status === "pending" &&
                item.referralReady && (
                  <NurseForwardAdmButton
                    id={item.id}
                    student={item.student}
                    onChanged={refresh}
                  />
                )}
              {item.type === "ADM" && item.status === "pending" && (
                <NurseAdmReviewDialog
                  row={item}
                  onChanged={refresh}
                  onCreateReferral={(draft) =>
                    setFormSheet({ row: item, draft })
                  }
                />
              )}
              <NurseQueueRowActions
                row={item}
                onChanged={refresh}
                seeMoreHref={seeMoreHref}
                viewFormHref={viewFormHref}
                viewOnly
              />
            </div>
          );
        },
      },
    ],
    [nowMs, refresh],
  );

  const table = useReactTable({
    data: needsReview,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 8 } },
    state: { sorting, columnFilters },
  });

  if (needsReview.length === 0) {
    return (
      <>
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative">
            <h2 className={styles.sectionTitle}>{title}</h2>
            <p className={styles.sectionDesc}>{description}</p>
          </div>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <Inbox size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">You&apos;re all caught up</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {emptyText}
            </p>
          </div>
        </div>
        {formSheet && (
          <NurseAdmReferralFormSheet
            open
            onClose={() => setFormSheet(null)}
            row={formSheet.row}
            initialDraft={formSheet.draft}
            onChanged={refresh}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={styles.sectionTitle}>
              {title} — {needsReview.length}
            </h2>
            <p className={styles.sectionDesc}>{description}</p>
          </div>
          <InputGroup className="max-w-40 shrink-0">
            <InputGroupInput
              placeholder="Filter students..."
              value={
                (table.getColumn("student")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("student")?.setFilterValue(event.target.value)
              }
              aria-label="Filter students"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="relative overflow-x-auto rounded-md border">
          <Table className="w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-muted/50 [&>th]:border-t-0"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
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
                      <TableCell key={cell.id} className="whitespace-nowrap">
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
                    No cases match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="relative mt-auto flex items-center justify-end space-x-2 pt-2">
          <div className="text-muted-foreground flex-1 text-sm">
            {table.getFilteredRowModel().rows.length} case
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
      </div>

      {formSheet && (
        <NurseAdmReferralFormSheet
          open
          onClose={() => setFormSheet(null)}
          row={formSheet.row}
          initialDraft={formSheet.draft}
          onChanged={refresh}
        />
      )}
    </>
  );
}
