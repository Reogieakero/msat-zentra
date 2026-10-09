"use client";
import * as React from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Loader2, MoreHorizontal, RotateCcw, Route, SearchIcon, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import { typeForDesk } from "./referral-types";
import type { ReferralRow } from "./use-my-referrals";
import refStyles from "./referrals.module.css";
export const STATUS_BADGE: Record<ReferralRow["status"], { variant: "amber" | "blue" | "green" | "red" | "outline"; label: string }> = {
  pending: { variant: "amber", label: "Pending" },
  in_progress: { variant: "blue", label: "In progress" },
  info_requested: { variant: "blue", label: "Info requested" },
  follow_up: { variant: "amber", label: "Follow up" },
  resolved: { variant: "green", label: "Resolved" },
  dismissed: { variant: "outline", label: "Dismissed" },
  escalated: { variant: "red", label: "Escalated" },
};
function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
function isCancellable(status: ReferralRow["status"]): boolean {
  return status !== "resolved" && status !== "dismissed";
}
export function ReferralsTable({
  referrals,
  total,
  unfilteredTotal,
  query,
  onQueryChange,
  safePage,
  totalPages,
  goToPage,
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
  safePage: number;
  totalPages: number;
  goToPage: (p: number) => void;
  highlightId: string | null;
  referralsQuery: { isPending: boolean; isError: boolean; isFetching: boolean; refetch: () => void };
  onTrack: (row: ReferralRow) => void;
  onRequestCancel: (row: ReferralRow) => void;
  reopenPending: boolean;
  reopenRowId: string | null;
  onReferAgain: (row: ReferralRow) => void;
  onNewReferral?: () => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const columns = React.useMemo<ColumnDef<ReferralRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.studentName} ${row.lrn} ${row.targetRole}`,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.studentName}</p>
            <p className={styles.cellSub}>{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: "Case status",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => {
          const meta = STATUS_BADGE[row.original.status];
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      },
      {
        id: "type",
        accessorFn: (row) => typeForDesk(row.targetRole).label,
        header: "Type",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const meta = typeForDesk(row.original.targetRole);
          return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
        },
      },
      {
        id: "targetRole",
        accessorFn: (row) => row.targetRole,
        header: "Referred to",
        size: 170,
        minSize: 170,
        maxSize: 170,
        cell: ({ row }) => (
          <Badge variant="outline">{humanize(row.original.targetRole)}</Badge>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-end">Actions</div>,
        size: 60,
        minSize: 60,
        maxSize: 60,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          const dismissed = r.status === "dismissed";
          const cancellable = isCancellable(r.status);
          return (
            <div className="text-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${r.studentName}`}>
                    <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-[14px]">
                  <DropdownMenuItem
                    onSelect={() => onTrack(r)}
                  >
                    <Route size={16} strokeWidth={1.8} aria-hidden />
                    Track
                  </DropdownMenuItem>
                  {dismissed ? (
                    <DropdownMenuItem
                      disabled={reopenPending}
                      onSelect={() => onReferAgain(r)}
                    >
                      {reopenRowId === r.id ? (
                        <Loader2 size={16} strokeWidth={1.8} aria-hidden className="animate-spin" />
                      ) : (
                        <RotateCcw size={16} strokeWidth={1.8} aria-hidden />
                      )}
                      {reopenRowId === r.id ? "Re-submitting…" : "Refer again"}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={!cancellable}
                      onSelect={() => onRequestCancel(r)}
                      className="text-destructive focus:text-destructive"
                    >
                    <X size={16} strokeWidth={1.8} aria-hidden />
                    {cancellable ? "Cancel" : "Cancel (closed)"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onTrack, onReferAgain, onRequestCancel, reopenPending, reopenRowId],
  );
  const table = useReactTable({
    data: referrals,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
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
  if (referrals.length === 0) {
    const isTrueEmpty = unfilteredTotal === 0;
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center">
        <div className={`${assign.card} w-full max-w-md`}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <Send size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">
              {isTrueEmpty ? "No referrals yet" : "No referrals match your search"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isTrueEmpty
                ? "Referrals you submit will appear here once created."
                : "Try a different search or filter."}
            </p>
            {isTrueEmpty && onNewReferral ? (
              <Button size="sm" className="mt-2" onClick={onNewReferral}>
                New referral
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={assign.card}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={styles.sectionTitle}>Referrals</h2>
          <p className={styles.sectionDesc}>
            Your submitted referrals — {total} referral
            {total === 1 ? "" : "s"}
            {unfilteredTotal !== total ? ` (of ${unfilteredTotal} total)` : ""}.
          </p>
        </div>
        <InputGroup className="max-w-40 shrink-0">
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
      <div className={`relative overflow-x-auto rounded-md border ${refStyles.noScrollbar}`}>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const highlighted =
                  highlightId !== null && highlightId === row.original.id;
                return (
                  <TableRow
                    key={row.id}
                    id={highlighted ? `teacher-referral-${row.original.id}` : undefined}
                    data-highlighted={highlighted || undefined}
                    className={highlighted ? "bg-amber-500/10" : undefined}
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
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No referrals match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="relative flex items-center justify-end space-x-2">
          <div className="text-muted-foreground flex-1 text-sm">
            Page {safePage} of {totalPages} — {total} referral
            {total === 1 ? "" : "s"}
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
