"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdmTrackingTimeline } from "@/components/adm-tracker/AdmTrackingTimeline";
import type {
  StageTimelineEntry,
  TrackerCaseInput,
} from "@/components/adm-tracker/adm-stage-activity";
import {
  admCaseStatusVariant,
  deriveAdmCaseStatus,
  friendlyReason,
  stageLabel,
} from "@/services/coordinator/labels";
import { fetchCaseHistory } from "@/services/coordinator/cases.service";
import type {
  AdmCaseRow,
  AdmHistoryEvent,
} from "@/services/coordinator/coordinator.types";
import { stageOrder } from "@/lib/labels/adm-pipeline";

export interface HistoryTarget {
  title: string;
  profileId?: string;
  referralId?: string;
  row: AdmCaseRow;
}

export function historyTargetFor(row: AdmCaseRow): HistoryTarget {
  if (row.id.startsWith("referral:")) {
    return { title: row.student, referralId: row.id.replace(/^referral:/, ""), row };
  }
  return { title: row.student, profileId: row.id, row };
}

function toTrackEntries(events: AdmHistoryEvent[]): StageTimelineEntry[] {
  return events
    .filter((e) => e && e.at)
    .map((e) => ({
      label: friendlyReason(e.reason, e.actionType),
      detail: null,
      date: e.at.slice(0, 10),
      at: e.at,
      action: e.actionType,
      byRole: e.actorRole ?? null,
      source: (
        e.sourceTable === "referrals"
          ? "referrals"
          : e.sourceTable === "adm_parent_meetings"
            ? "adm_parent_meetings"
            : "case"
      ) as StageTimelineEntry["source"],
    }));
}

function trackInputFor(row: AdmCaseRow, events: AdmHistoryEvent[]): TrackerCaseInput {
  const timeline = toTrackEntries(events);

  if (row.datePrepared) {
    timeline.push({
      label: `Moved to the ${stageLabel(row.stage)} stage.`,
      detail: null,
      date: row.datePrepared,
      at: `${row.datePrepared}T00:00:00`,
      action: "adm_stage",
      byRole: "adm_coordinator",
      source: "case",
      stage: row.stage,
    });
  }
  if (row.approvedBy && row.approvalDate) {
    timeline.push({
      label: "The principal signed the approval.",
      detail: null,
      date: row.approvalDate,
      at: `${row.approvalDate}T00:00:00`,
      action: "adm_approved",
      byRole: "principal",
      source: "case",
    });
  }
  const order = stageOrder(row.stage);
  return {
    stage: row.stage,
    referralStatus: row.referralStatus ?? null,
    consultReviewer: row.consultReviewer ?? null,
    referredBy: null,
    anecdotalDate: null,
    referredDate: row.endorsedAt ?? row.datePrepared,
    meetingAttended: row.meeting ? row.meeting.attended : null,
    lastMeetingAt: row.meeting?.datetime ?? null,
    hasHomeVisit: order > stageOrder("home_visitation") || row.stage === "home_visitation",
    approved: !!row.approvedBy,
    approvedAt: row.approvalDate ? `${row.approvalDate}T00:00:00` : null,
    certificationIssued: row.forms.some(
      (f) => f.formType === "CERTIFICATION" && f.status === "verified",
    ),
  };
}

/**
 * Track-case overlay — the same full-screen portal board the teacher / nurse
 * referral trackers use (compact header, status chip, progress bar, then the
 * `variant="cards"` kanban step grid) instead of the old card modal.
 */
export function CaseHistoryDialog({
  target,
  onClose,
}: {
  target: HistoryTarget | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const historyQuery = useQuery({
    queryKey: [
      "coordinator-history",
      target?.profileId ?? null,
      target?.referralId ?? null,
    ],
    queryFn: ({ signal }) =>
      fetchCaseHistory(
        { profileId: target?.profileId, referralId: target?.referralId },
        signal,
      ),
    enabled: target !== null,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  React.useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [target]);

  const events = historyQuery.data ?? [];
  const row = target?.row ?? null;
  const trackInput = React.useMemo(
    () => (row ? trackInputFor(row, events) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, historyQuery.dataUpdatedAt],
  );
  const currentOrder = row ? stageOrder(row.stage) : 2;

  if (!target || !mounted || !row) return null;

  const caseStatus = deriveAdmCaseStatus(
    row.stage,
    row.eligibilityStatus,
    row.approvedBy,
    row.referralStatus,
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150 dark:bg-black/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-track-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] animate-in fade-in-0 zoom-in-95 duration-150 dark:bg-background"
      >
        <div className="-mx-2.5 flex min-w-0 items-start gap-1.5 border-b border-border px-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="case-track-title" className="truncate text-[13px] font-semibold">
              {row.student} — tracking
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              LRN {row.lrn} · {row.grade}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-6 w-6 shrink-0 px-0"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
          </Button>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 px-1">
          <Badge variant={admCaseStatusVariant(caseStatus.key)} className="rounded-md">
            {caseStatus.label}
          </Badge>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round((currentOrder / 8) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall pipeline progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((currentOrder / 8) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              Stage {currentOrder} of 8
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 px-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <History size={14} aria-hidden />
            Pipeline tracking
          </p>
          {historyQuery.isPending ? (
            <div
              className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
              aria-busy="true"
              aria-label="Loading case tracking"
            >
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: "8rem" }} />
              ))}
            </div>
          ) : historyQuery.isError ? (
            <div className="flex flex-col items-start gap-2" role="alert">
              <p className="text-sm">
                We couldn&apos;t load the tracking timeline. Please try again.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={historyQuery.isRefetching}
                onClick={() => historyQuery.refetch()}
              >
                {historyQuery.isRefetching ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                {historyQuery.isRefetching ? "Loading…" : "Try again"}
              </Button>
            </div>
          ) : trackInput ? (
            <AdmTrackingTimeline
              input={trackInput}
              reader="coordinator"
              variant="cards"
            />
          ) : null}
        </div>

        <div className="-mx-2.5 flex justify-end gap-2 border-t border-border px-3.5 pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-6 px-2.5 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            className="h-6 px-2.5 text-xs"
            asChild
          >
            <Link href={`/coordinator/referrals/${encodeURIComponent(row.id)}`}>
              Open case file
            </Link>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
