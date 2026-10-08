"use client";
import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import {
  AdmQueueTable,
} from "@/components/adm-queue/AdmQueueTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  GuidanceAdmCase,
  GuidanceAdmSummary,
} from "@/services/guidance/adm.types";
import { AdmReviewDialog } from "./AdmReviewDialog";
import { GuidanceAdmReferralFormSheet } from "./GuidanceAdmReferralFormSheet";
import { AdmTrackDialog } from "@/components/adm-tracker/AdmTrackDialog";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { GcForm03PreviewDialog } from "./GcForm03PreviewDialog";
import { useGuidanceAdmQueue } from "./use-guidance-adm-queue";
import { GuidanceAdmRejectDialog } from "./guidance-adm-reject-dialog";
import styles from "./guidance-adm.module.css";
interface GuidanceAdmTableProps {
  summary: GuidanceAdmSummary;
  reviewQueue: GuidanceAdmCase[];
}
export function GuidanceAdmTable({
  reviewQueue,
}: GuidanceAdmTableProps) {
  const {
    invalidateGuidance,
    reviewId,
    setReviewId,
    rejectId,
    setRejectId,
    rejectReason,
    setRejectReason,
    trackId,
    setTrackId,
    gcRow,
    setGcRow,
    gcData,
    gcLoadingId,
    openGcForm,
    activeReview,
    activeReject,
    activeTrack,
    openReview,
    reviewMutation,
    closeReject,
    vmRows,
    submitQuickReject,
  } = useGuidanceAdmQueue(reviewQueue);
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [formSheet, setFormSheet] = React.useState<{
    row: GuidanceAdmCase;
    draft: AdmReviewDraft;
  } | null>(null);
  function renderQueueActions(id: string) {
    const row = reviewQueue.find((c) => c.id === id) ?? null;
    if (!row) return null;
    const needsAction = row.reviewed === false;
    const isEndorsed =
      row.reviewed === true && row.referralStatus === "in_progress";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${row.student}'s case`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onSelect={() => setTrackId(row.id)}>
            Track ADM referral
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={gcLoadingId === row.id}
            onSelect={() => void openGcForm(row)}
          >
            {gcLoadingId === row.id ? "Loading form…" : "See referral form"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (isEndorsed) setEndorsedFor(row.student);
              else openReview(row);
            }}
          >
            View anecdotal
          </DropdownMenuItem>
          {needsAction && (
            <DropdownMenuItem
              onSelect={() => {
                setRejectId(row.id);
                setRejectReason("");
              }}
            >
              Reject
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <div className={styles.feed}>
      <AdmQueueTable
        title="Latest referred ADM cases"
        description="The latest ADM cases referred to you — review the anecdotal, then endorse or reject."
        searchPlaceholder="Search student…"
        emptyTitle="No ADM cases referred to you yet"
        emptyHint="New ADM cases referred to you will appear here."
        rows={vmRows}
        renderActions={renderQueueActions}
      />
      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={() => setEndorsedFor(null)}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />
      {activeReview && (
        <AdmReviewDialog
          referralId={activeReview.referralId}
          student={activeReview.student}
          anecdotalId={activeReview.anecdotalId ?? null}
          info={{
            lrn: activeReview.lrn,
            section: activeReview.section,
            grade: activeReview.grade,
            category: activeReview.category,
            date: activeReview.date,
          }}
          open={reviewId !== null}
          onClose={() => setReviewId(null)}
          onChanged={() => {
            invalidateGuidance();
          }}
          onCreateReferral={(draft) => setFormSheet({ row: activeReview, draft })}
        />
      )}
      {formSheet && (
        <GuidanceAdmReferralFormSheet
          open
          onClose={() => setFormSheet(null)}
          adapter={formSheet.row}
          anecdotalId={formSheet.row.anecdotalId ?? null}
          lrn={formSheet.row.lrn}
          initialDraft={formSheet.draft}
          onChanged={() => {
            invalidateGuidance();
          }}
        />
      )}
      {reviewMutation.isError ? (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — that rejection did not go through. Please try again.
          </p>
        </div>
      ) : null}
      {gcRow && gcData && (
        <GcForm03PreviewDialog
          open
          data={gcData}
          confirming={false}
          onClose={() => setGcRow(null)}
          onConfirm={() => {}}
          viewOnly
        />
      )}
      {activeTrack && (
        <AdmTrackDialog
          open={trackId !== null}
          onClose={() => setTrackId(null)}
          caseInfo={{
            student: activeTrack.student,
            lrn: activeTrack.lrn,
            section: activeTrack.section,
            reason: activeTrack.reason,
          }}
          track={{
            stage: activeTrack.stage,
            referralStatus: activeTrack.referralStatus,
            consultReviewer: activeTrack.consultReviewer ?? "guidance_counselor",
            referredBy: activeTrack.referredBy,
            anecdotalDate: activeTrack.date,
            referredDate: activeTrack.date,
            meetingAttended: activeTrack.meetingAttended,
            hasHomeVisit: activeTrack.hasHomeVisit,
            approved: activeTrack.approved,
            approvedAt: activeTrack.approvedAt,
          }}
        />
      )}
      <GuidanceAdmRejectDialog
        rejectId={rejectId}
        activeReject={activeReject}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        pending={reviewMutation.isPending}
        onClose={closeReject}
        onSubmit={submitQuickReject}
      />
    </div>
  );
}
