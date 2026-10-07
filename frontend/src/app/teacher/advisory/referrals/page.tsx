"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Loader2, MoreHorizontal, RotateCcw, Route, SearchIcon, Send, X } from "lucide-react";
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
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
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

interface MyReferralsPage {
  referrals: ReferralRow[];
  total: number;
  unfilteredTotal: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

const TEACHER_REFERRALS_PAGE_SIZE = 15;

function TeacherAdvisoryReferralsView({ highlightId }: { highlightId: string | null }) {
  const invalidateTeacher = useTeacherInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [takeover, setTakeover] = React.useState(false);
  // Debounced 300ms so server queries fire after the user pauses typing.
  const debounced = useDebouncedValue(query.trim(), 300);
  // Bell deep-links (?highlight=<id>) serve the case's own page; the first
  // pager/filter touch takes over with plain params. Derived, no effects.
  const landing = !takeover && highlightId !== null;
  const referralsQuery = useQuery<MyReferralsPage>({
    queryKey: ["myReferrals", takeover || !landing ? page : 1, debounced, termKey, landing ? (highlightId ?? "") : ""],
    queryFn: async ({ signal }) => {
      const search = new URLSearchParams();
      if (debounced) search.set("q", debounced);
      search.set("page", String(takeover || !landing ? page : 1));
      search.set("pageSize", String(TEACHER_REFERRALS_PAGE_SIZE));
      if (landing && highlightId) search.set("highlight", highlightId);
      const { data } = await apiClient.get<
        MyReferralsPage | ReferralRow[] | { referrals: ReferralRow[] }
      >(`/api/referrals/mine${search.toString() ? `?${search.toString()}` : ""}`, {
        signal,
      });
      // Defensive: the endpoint has served bare arrays and {referrals}
      // shapes — never let a shape change crash the table.
      if (Array.isArray(data)) {
        return {
          referrals: data,
          total: data.length,
          unfilteredTotal: data.length,
          page,
          totalPages: 1,
          pageSize: TEACHER_REFERRALS_PAGE_SIZE,
        };
      }
      const referrals = Array.isArray(
        (data as { referrals?: unknown }).referrals
      )
        ? (data as { referrals: ReferralRow[] }).referrals
        : [];
      const fallback = data as Partial<MyReferralsPage>;
      const total = fallback.total ?? referrals.length;
      const unfilteredTotal = fallback.unfilteredTotal ?? referrals.length;
      const totalPages =
        fallback.totalPages ?? Math.max(1, Math.ceil(total / TEACHER_REFERRALS_PAGE_SIZE));
      return {
        referrals,
        total,
        unfilteredTotal,
        page: fallback.page ?? page,
        totalPages,
        pageSize: fallback.pageSize ?? TEACHER_REFERRALS_PAGE_SIZE,
      };
    },
    // Page turns reuse the previous page so they never flash skeletons.
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
  // Derived, never setState-in-effect.
  const totalPages = Math.max(1, referralsQuery.data?.totalPages ?? 1);
  const safePage = Math.min(referralsQuery.data?.page ?? page, totalPages);
  const goToPage = (next: number) => {
    setTakeover(true);
    setPage(next);
  };

  // Scroll the highlighted case into view once its page renders. The
  // backend serves the highlight's own page, so the row is mounted here.
  React.useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`teacher-referral-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, referralsQuery.data]);

  const [trackTarget, setTrackTarget] = React.useState<TrackableReferral | null>(null);
   const { reopen: reopenReferral, isPending: reopenPending } = useReopenReferral();
   const [cancelTarget, setCancelTarget] = React.useState<ReferralActionTarget | null>(null);
   const [cancelReason, setCancelReason] = React.useState("");
   const [cancelPending, setCancelPending] = React.useState(false);
   const [actionError, setActionError] = React.useState<string | null>(null);
   const [newReferralOpen, setNewReferralOpen] = React.useState(false);
   // Bumped every time a dismissed ADM case is filed again from the table —
   // the rail shows the "Re-submit from scratch" reminder for 4s.
   const [admResubmitSignal, setAdmResubmitSignal] = React.useState(0);

   const handleAdmReferAgain = React.useCallback(() => {
     setNewReferralOpen(true);
     setAdmResubmitSignal((s) => s + 1);
   }, []);

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
      invalidateTeacher.referrals();
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

  // Stable reference so the table memo doesn't recompute every render.
  const referrals = React.useMemo(
    () =>
      Array.isArray(referralsQuery.data?.referrals)
        ? referralsQuery.data.referrals
        : [],
    [referralsQuery.data],
  );
  const total = referralsQuery.data?.total ?? referrals.length;
  const unfilteredTotal = referralsQuery.data?.unfilteredTotal ?? referrals.length;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  // Per-row reopen spinner: only the acting row locks + spins.
  const [reopenRowId, setReopenRowId] = React.useState<string | null>(null);

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
                      onSelect={() => {
                        if (r.track === "adm") {
                          handleAdmReferAgain();
                        } else {
                          setReopenRowId(r.id);
                          void reopenReferral(r).finally(() => {
                            setReopenRowId((prev) => (prev === r.id ? null : prev));
                          });
                        }
                      }}
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
    [requestCancel, handleAdmReferAgain, reopenReferral, reopenPending, reopenRowId],
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
            Your submitted referrals — {total} referral
            {total === 1 ? "" : "s"}
            {unfilteredTotal !== total ? ` (of ${unfilteredTotal} total)` : ""}.
          </p>
        </div>
        <InputGroup className="max-w-40 shrink-0">
          <InputGroupInput
            placeholder="Filter referrals..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTakeover(true);
              setPage(1);
            }}
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
    </div>
  );

  return (
    <section className={refStyles.page}>
      <div className={refStyles.layout}>
        <div className={refStyles.body}>{body}</div>
        <aside className={refStyles.sideList} aria-label="Refer a student">
          <ReferStudentCard
            open={newReferralOpen}
            onOpenChange={setNewReferralOpen}
            resubmitHintSignal={admResubmitSignal}
          />
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

function TeacherAdvisoryReferralsPageWithHighlight() {
  // useSearchParams needs a Suspense boundary under the app router.
  const params = useSearchParams();
  return <TeacherAdvisoryReferralsView highlightId={params.get("highlight")} />;
}

export default function TeacherAdvisoryReferralsPage() {
  return (
    <React.Suspense fallback={<section className={refStyles.page} aria-busy="true" />}>
      <TeacherAdvisoryReferralsPageWithHighlight />
    </React.Suspense>
  );
}
