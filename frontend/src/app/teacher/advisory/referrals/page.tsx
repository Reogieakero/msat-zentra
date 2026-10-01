"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import { MoreHorizontal, RotateCcw, Route, SearchIcon, Send, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import { ReferStudentCard } from "./components/ReferStudentCard";
import {
  ReferralCancelDialog,
  type ReferralActionTarget,
} from "./components/ReferralActionDialogs";
import {
  ReferralTrackDialog,
  type TrackableReferral,
} from "./components/ReferralTrackDialog";
import { useReopenReferral } from "./components/use-reopen-referral";
import { typeForDesk } from "./components/referral-types";
import refStyles from "./components/referrals.module.css";

interface ReferralRow {
  id: string;
  studentName: string;
  lrn: string;
  targetRole: string;
  status:
    | "pending"
    | "in_progress"
    | "resolved"
    | "dismissed"
    | "escalated"
    | "info_requested"
    | "follow_up";
  referredAt: string;
  reason: string;
  timeline: { label: string; detail?: string | null; date: string }[];
  track: "adm" | "general";
  consultReviewer?: string | null;
  admStage?: string | null;
  observationDate?: string | null;
  meetingAttended?: boolean | null;
  lastMeetingAt?: string | null;
  hasHomeVisit?: boolean;
  admApproved?: boolean;
  admApprovedAt?: string | null;
  modulesSubmitted?: number;
  modulesTotal?: number;
  lastModuleAt?: string | null;
  devicesReturned?: number;
  certificationAt?: string | null;
  resolvedAt?: string | null;
}

const STATUS_BADGE: Record<ReferralRow["status"], { variant: "amber" | "blue" | "green" | "red" | "outline"; label: string }> = {
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

/* Teacher referrals as a data table — same layout as the overview At-Risk
   Advisees table: section card, title + count header with the filter on the
   right, fixed table, count + pager footer. Main panel holds the list;
   the right rail holds the quick-refer card. */
/* Resolved / dismissed referrals can no longer be withdrawn (mirrors the
   backend cancel guards). */
function isCancellable(status: ReferralRow["status"]): boolean {
  return status !== "resolved" && status !== "dismissed";
}

export default function TeacherAdvisoryReferralsPage() {
  const queryClient = useQueryClient();
  const referralsQuery = useQuery<ReferralRow[]>({
    queryKey: ["myReferrals"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/referrals/mine");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const [trackTarget, setTrackTarget] = React.useState<TrackableReferral | null>(null);
  const { reopen: reopenReferral, isPending: reopenPending } = useReopenReferral();
  const [cancelTarget, setCancelTarget] = React.useState<ReferralActionTarget | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelPending, setCancelPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const requestCancel = React.useCallback((row: ReferralRow) => {
    setCancelTarget({ id: row.id, studentName: row.studentName });
    setCancelReason("");
    setActionError(null);
  }, []);

  async function confirmCancel(): Promise<void> {
    if (!cancelTarget || cancelReason.trim() === "" || cancelPending) return;
    setCancelPending(true);
    setActionError(null);
    try {
      const { data } = await apiClient.post<{ id: string }>(`/api/referrals/${cancelTarget.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      // Suppress the channel echo toast for our own cancel (the success
      // toast below already fired) — the bell row still lands for badge.
      if (data?.id) markSelfNotified(data.id);
      await queryClient.invalidateQueries({ queryKey: ["myReferrals"] });
      await queryClient.invalidateQueries({ queryKey: ["referableAnecdotal"] });
      setCancelTarget(null);
      setCancelReason("");
      sileo.success({ title: "Referral cancelled", description: "The case was withdrawn." });
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Could not cancel this referral.";
      setActionError(message);
      sileo.error({ title: "Could not cancel referral", description: message });
    } finally {
      setCancelPending(false);
    }
  }

  const referrals = React.useMemo(
    () => referralsQuery.data ?? [],
    [referralsQuery.data],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

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
        header: "Status",
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
                    onSelect={() => {
                      const meta = STATUS_BADGE[r.status];
                      const type = typeForDesk(r.targetRole);
                      setTrackTarget({
                        id: r.id,
                        studentName: r.studentName,
                        lrn: r.lrn,
                        targetRole: r.targetRole,
                        track: r.targetRole === "adm_coordinator" ? "adm" : "general",
                        typeLabel: type.label,
                        typeVariant: type.badgeVariant,
                        status: r.status,
                        statusLabel: meta.label,
                        statusVariant: meta.variant,
                        referredAt: r.referredAt,
                        reason: r.reason,
                        timeline: r.timeline ?? [],
                        consultReviewer: r.consultReviewer ?? null,
                        admStage: r.admStage ?? null,
                        observationDate: r.observationDate ?? null,
                        meetingAttended: r.meetingAttended ?? null,
                        lastMeetingAt: r.lastMeetingAt ?? null,
                        hasHomeVisit: r.hasHomeVisit ?? false,
                        admApproved: r.admApproved ?? false,
                        admApprovedAt: r.admApprovedAt ?? null,
                        modulesSubmitted: r.modulesSubmitted ?? 0,
                        modulesTotal: r.modulesTotal ?? 0,
                        lastModuleAt: r.lastModuleAt ?? null,
                        devicesReturned: r.devicesReturned ?? 0,
                        certificationAt: r.certificationAt ?? null,
                        resolvedAt: r.resolvedAt ?? null,
                      });
                    }}
                  >
                    <Route size={16} strokeWidth={1.8} aria-hidden />
                    Track
                  </DropdownMenuItem>
                  {dismissed ? (
                    <DropdownMenuItem
                      disabled={reopenPending}
                      onSelect={() => void reopenReferral(r)}
                    >
                      <RotateCcw size={16} strokeWidth={1.8} aria-hidden />
                      {reopenPending ? "Re-submitting…" : "Refer again"}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={!cancellable}
                      onSelect={() => requestCancel(r)}
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
    [requestCancel],
  );

  const table = useReactTable({
    data: referrals,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 15 } },
    state: { sorting, columnFilters },
  });

  /* Main panel: referrals table (overview layout). Right rail: quick-refer
     card. The rail stays mounted across loading / error / empty states. */
  const body = referralsQuery.isPending ? (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading referrals">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 rounded-md bg-muted" />
      ))}
    </div>
  ) : referralsQuery.isError ? (
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
          onClick={() => void referralsQuery.refetch()}
          disabled={referralsQuery.isFetching}
        >
          {referralsQuery.isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    </div>
  ) : referrals.length === 0 ? (
    <div className={assign.card}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h2 className={styles.sectionTitle}>Referrals</h2>
        <p className={styles.sectionDesc}>
          Your submitted referrals — 0 referrals.
        </p>
      </div>
      <div className="relative flex flex-col items-center gap-2 py-6 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
          aria-hidden="true"
        >
          <Send size={24} className="text-muted-foreground" />
        </span>
        <p className="font-medium">No referrals yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Referrals you submit will appear here once created.
        </p>
      </div>
    </div>
  ) : (
    <div className={assign.card}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={styles.sectionTitle}>Referrals</h2>
          <p className={styles.sectionDesc}>
            Your submitted referrals — {referrals.length} referral
            {referrals.length === 1 ? "" : "s"}.
          </p>
        </div>
        <InputGroup className="max-w-40 shrink-0">
          <InputGroupInput
            placeholder="Filter referrals..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
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
                  No referrals match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="relative flex items-center justify-end space-x-2">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredRowModel().rows.length} referral
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
  );

  return (
    <section className={refStyles.page}>
      <div className={refStyles.layout}>
        <div className={refStyles.body}>{body}</div>
        <aside className={refStyles.sideList} aria-label="Refer a student">
          <ReferStudentCard />
        </aside>
      </div>

      <ReferralTrackDialog referral={trackTarget} onClose={() => setTrackTarget(null)} />

      <ReferralCancelDialog
        target={cancelTarget}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        pending={cancelPending}
        error={actionError}
        onClose={() => {
          if (!cancelPending) {
            setCancelTarget(null);
            setActionError(null);
          }
        }}
        onConfirm={confirmCancel}
      />
    </section>
  );
}
