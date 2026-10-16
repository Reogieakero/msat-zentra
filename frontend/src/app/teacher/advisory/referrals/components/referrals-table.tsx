"use client";
import * as React from "react";
import { Loader2, MoreHorizontal, RotateCcw, Route, SearchIcon, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import { typeForDesk } from "./referral-types";
import { isWithdrawnDismissal, type ReferralRow } from "./use-my-referrals";
import { StudentMascot } from "./StudentMascot";
import { ReferralEmptyKanban, ReferralStarterKanban } from "./ReferralEmptyKanban";
import { ReferralStarterSidebar } from "./ReferralStarterSidebar";
import refStyles from "./referrals.module.css";
type StatusMeta = { variant: "amber" | "blue" | "green" | "red" | "outline"; label: string };
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

const KNOWN_DOT: Record<Exclude<ReferralRow["status"], "escalated">, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  info_requested: "#3b82f6",
  follow_up: "#f59e0b",
  resolved: "#22c55e",
  dismissed: "#ef4444",
};
function statusDot(status: ReferralRow["status"]): string {
  return KNOWN_DOT[status as Exclude<ReferralRow["status"], "escalated">] ?? "#ef4444";
}

const REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
};

/** ADM stages where the case still sits with the consultation reviewer. */
const EARLY_ADM_STAGES = new Set(["anecdotal", "consultation"]);

function formatReferredDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function ReferralCard({
  r,
  highlighted,
  onTrack,
  onRequestCancel,
  reopenPending,
  reopenRowId,
  onReferAgain,
}: {
  r: ReferralRow;
  highlighted: boolean;
  onTrack: (row: ReferralRow) => void;
  onRequestCancel: (row: ReferralRow) => void;
  reopenPending: boolean;
  reopenRowId: string | null;
  onReferAgain: (row: ReferralRow) => void;
}) {
  const meta = statusBadge(r.status, r.dismissedByRole);
  const type = typeForDesk(r.targetRole);
  const dot = statusDot(r.status);
  const cancelled = r.status === "dismissed";
  const cancellable = isCancellable(r.status);
  // Desk holding the case right now: an ADM referral sits with its
  // consultation reviewer only while the ADM stage is still at
  // consultation or earlier; once endorsed it moves to the ADM
  // Coordinator. Direct referrals sit with their target desk.
  const withReviewer =
    r.targetRole === "adm_coordinator" &&
    !!r.consultReviewer &&
    EARLY_ADM_STAGES.has(r.admStage ?? "consultation");
  const deskNow =
    withReviewer && r.consultReviewer
      ? (REVIEWER_LABELS[r.consultReviewer] ?? humanize(r.consultReviewer))
      : humanize(r.targetRole);
  return (
    <div
      id={highlighted ? `teacher-referral-${r.id}` : undefined}
      data-highlighted={highlighted || undefined}
      aria-label={`Referral for ${r.studentName} — ${meta.label}`}
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white py-3 pl-3 pr-4 shadow-sm transition-colors hover:border-primary/60 hover:shadow dark:bg-card"
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <StudentMascot
              name={r.studentName}
              seed={r.lrn}
              character={r.mascot ?? undefined}
            />
            <button
              type="button"
              onClick={() => onTrack(r)}
              aria-label={`Track referral for ${r.studentName}`}
              className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-semibold text-foreground"
              title={r.studentName}
            >
              {r.studentName}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onTrack(r)}
            aria-label={`Track referral details for ${r.studentName}`}
            className="flex min-w-0 cursor-pointer flex-col gap-2 text-left"
          >
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-tight text-secondary-foreground"
              title={r.lrn}
            >
              {r.lrn}
            </span>
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
              style={{
                color: dot,
                borderColor: `color-mix(in srgb, ${dot} 40%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${dot} 12%, transparent)`,
              }}
              title={meta.label}
            >
              {meta.label}
            </span>
            <span
              className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium leading-tight text-secondary-foreground"
              title={type.label}
            >
              {type.label}
            </span>
          </span>
        </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-6 w-6 shrink-0 px-0"
              aria-label={`Actions for ${r.studentName}`}
            >
              <MoreHorizontal size={14} strokeWidth={1.8} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-44 rounded-lg p-1.5 shadow-xl dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/15"
          >
            <DropdownMenuItem
              onSelect={() => onTrack(r)}
              className="gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium dark:focus:bg-white/10 dark:focus:text-zinc-100"
            >
              <Route
                aria-hidden
                strokeWidth={1.8}
                className="size-4 text-zinc-600 dark:text-zinc-300"
              />
              Track
            </DropdownMenuItem>
            {cancelled ? (
              <DropdownMenuItem
                disabled={reopenPending}
                onSelect={() => onReferAgain(r)}
                className="gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium dark:focus:bg-white/10 dark:focus:text-zinc-100"
              >
                {reopenRowId === r.id ? (
                  <Loader2
                    aria-hidden
                    strokeWidth={1.8}
                    className="size-4 animate-spin text-zinc-600 dark:text-zinc-300"
                  />
                ) : (
                  <RotateCcw
                    aria-hidden
                    strokeWidth={1.8}
                    className="size-4 text-zinc-600 dark:text-zinc-300"
                  />
                )}
                {reopenRowId === r.id ? "Re-submitting…" : "Refer again"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={!cancellable}
                onSelect={() => onRequestCancel(r)}
                className="gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-red-600 focus:bg-red-500/10 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-500/20 dark:focus:text-red-400"
              >
                {/* `!` pins the icon red: the menu primitive recolors
                    row icons to the accent tone on hover. */}
                <X
                  aria-hidden
                  strokeWidth={1.8}
                  className="size-4 text-red-600! dark:text-red-400!"
                />
                {cancellable ? "Cancel" : "Cancel (closed)"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button
        type="button"
        onClick={() => onTrack(r)}
        aria-label={`Track desk for ${r.studentName}`}
        className="flex w-full cursor-pointer items-center justify-end gap-1.5 text-[10px] leading-tight text-muted-foreground"
      >
        Desk:
        <span
          className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium leading-tight text-secondary-foreground"
          title={deskNow}
        >
          {deskNow}
        </span>
      </button>
    </div>
  );
}
export function ReferralsTable({
  referrals,
  total,
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
  // Newest referral first (today on top), one kanban column per referred
  // date with one card per referral.
  const sorted = React.useMemo(() => {
    const ts = (v: string) => {
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    return [...referrals].sort((a, b) => ts(b.referredAt) - ts(a.referredAt));
  }, [referrals]);
  // One kanban column per referred date: same-day referrals stack in a
  // single column, newest first. The column wears the newest referral's
  // status color; every card keeps its own status pill.
  const groups = React.useMemo(() => {
    const map = new Map<string, ReferralRow[]>();
    for (const r of sorted) {
      const key = formatReferredDate(r.referredAt);
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()];
  }, [sorted]);
  // Background refetches (e.g. after sending) keep the current list on
  // screen and patch it in place — skeletons only run on the very first
  // load, so the page never visibly refreshes and card state (mascots,
  // menus) survives the update.
  const isPageLoading =
    referralsQuery.isFetching && !referralsQuery.isPending && referrals.length === 0;
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
    if (isTrueEmpty) {
      return (
        <div className="flex min-h-[calc(100dvh-10rem)] w-full items-center justify-center">
          <div className="w-full">
            <ReferralEmptyKanban onNewReferral={onNewReferral} />
          </div>
        </div>
      );
    }
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
            <p className="font-medium">No referrals match your search</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try a different search or filter.
            </p>
          </div>
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
              <p className={styles.sectionDesc}>
                Your submitted referrals — {total} referral
                {total === 1 ? "" : "s"}
                {unfilteredTotal !== total ? ` (of ${unfilteredTotal} total)` : ""}.
              </p>
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
              <ul className={refStyles.recordGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={`skeleton-${i}`} className="flex min-w-0 self-start">
                    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : groups.length > 0 ? (
            <ul className={`relative ${refStyles.recordGrid}`}>
            {groups.map(([date, rows]) => {
              const head = rows[0]!;
              const dot = statusDot(head.status);
              return (
                <li key={date} className="flex min-w-0 self-start">
                  <article
                    aria-label={`${rows.length} referral${rows.length === 1 ? "" : "s"} referred ${date}`}
                    style={{
                      borderColor: `color-mix(in srgb, ${dot} 40%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${dot} 12%, transparent)`,
                    }}
                    className="flex w-full min-w-0 flex-col gap-2 rounded-xl border p-2.5 [font-family:var(--font-inter)]"
                  >
                    <div
                      style={{
                        borderColor: `color-mix(in srgb, ${dot} 30%, transparent)`,
                      }}
                      className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b px-3.5 pb-2"
                    >
                      <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: dot }}
                          aria-hidden
                        />
                        <span className="truncate" title={date}>
                          {date}
                        </span>
                      </span>
                      <span
                        className="shrink-0 text-xs font-semibold text-muted-foreground"
                        aria-label={`${rows.length} referral${rows.length === 1 ? "" : "s"}`}
                      >
                        {rows.length}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      {rows.map((r) => (
                        <ReferralCard
                          key={r.id}
                          r={r}
                          highlighted={highlightId !== null && highlightId === r.id}
                          onTrack={onTrack}
                          onRequestCancel={onRequestCancel}
                          reopenPending={reopenPending}
                          reopenRowId={reopenRowId}
                          onReferAgain={onReferAgain}
                        />
                      ))}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          ) : (
            <p className="relative py-8 text-center text-sm text-muted-foreground">
              No referrals match your search.
            </p>
          )}
        </div>
        {!isPageLoading && groups.length > 0 ? (
          <ReferralStarterSidebar onNewReferral={onNewReferral} />
        ) : null}
      </div>
      <div className="border-t border-border pt-4 lg:hidden" aria-label="Referral starter actions">
        <ReferralStarterKanban singleRow onNewReferral={onNewReferral} />
      </div>
    </div>
  );
}
