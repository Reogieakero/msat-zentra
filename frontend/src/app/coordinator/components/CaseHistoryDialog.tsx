"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardModal } from "@/components/ui/CardModal";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import { AdmTrackingTimeline } from "@/components/adm-tracker/AdmTrackingTimeline";
import type {
  StageTimelineEntry,
  TrackerCaseInput,
} from "@/components/adm-tracker/adm-stage-activity";
import {
  friendlyReason,
  stageLabel,
} from "@/services/coordinator/labels";
import { fetchCaseHistory } from "@/services/coordinator/cases.service";
import type {
  AdmCaseRow,
  AdmHistoryEvent,
} from "@/services/coordinator/coordinator.types";
import { stageOrder } from "@/lib/labels/adm-pipeline";
import trackStyles from "@/app/teacher/advisory/adm-cases/components/AdmCaseDialog.module.css";

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

export function CaseHistoryDialog({
  target,
  onClose,
}: {
  target: HistoryTarget | null;
  onClose: () => void;
}) {
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

  const events = historyQuery.data ?? [];
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const row = target?.row ?? null;
  const trackInput = React.useMemo(
    () => (row ? trackInputFor(row, events) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, historyQuery.dataUpdatedAt],
  );
  const currentOrder = row ? stageOrder(row.stage) : 2;

  return (
    <CardModal
      open={target !== null}
      onClose={onClose}
      size="lg"
      title={target && row ? `${row.student} — tracking` : "Track case"}
      description={
        target && row ? `LRN ${row.lrn} · ${row.grade}` : undefined
      }
      watchKey={[
        row?.id ?? null,
        historyQuery.dataUpdatedAt,
        historyQuery.isPending,
      ]}
    >
      {target && row ? (

        <div
          className="flex min-w-0 flex-col gap-3"
          aria-label={`Track ADM case for ${row.student}`}
        >
            <div className="relative flex items-center gap-2">
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

            {historyQuery.isPending ? (
              <div className="relative flex flex-col gap-2" aria-busy="true" aria-label="Loading case tracking">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} style={{ width: `${85 - i * 10}%`, height: "0.875rem" }} />
                ))}
              </div>
            ) : historyQuery.isError ? (
              <div className="relative" role="alert">
                <p className="text-sm">We couldn&apos;t load the tracking timeline. Please try again.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={historyQuery.isRefetching}
                  onClick={() => historyQuery.refetch()}
                >
                  {historyQuery.isRefetching ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : null}
                  {historyQuery.isRefetching ? "Loading…" : "Try again"}
                </Button>
              </div>
            ) : (
              <>
                <div ref={listRef} className={`relative ${trackStyles.timelineScroll} pr-1`}>
                  {trackInput ? (
                    <AdmTrackingTimeline input={trackInput} reader="coordinator" />
                  ) : null}
                </div>
                <div className="flex justify-center pt-1">
                  <ScrollDownHint
                    scrollRef={listRef}
                    watchKey={row.id}
                    label="Scroll down"
                    className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
                  />
                </div>
              </>
            )}

            <div className="relative flex justify-end">
              <Button type="button" size="sm" asChild>
                <Link href={`/coordinator/referrals/${encodeURIComponent(row.id)}`}>
                  Open case file
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
    </CardModal>
  );
}
