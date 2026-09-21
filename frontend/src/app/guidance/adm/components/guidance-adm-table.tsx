"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, MoreHorizontal, Send } from "lucide-react";
import { useGuidanceMutation } from "../../overview/components/use-guidance-mutation";
import { Button } from "@/components/ui/button";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import {
  AdmQueueTable,
  type AdmQueueRowVM,
} from "@/components/adm-queue/AdmQueueTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  GuidanceAdmCase,
  GuidanceAdmSummary,
} from "./guidance-adm-data";
import { reviewAdmConsultation } from "./guidance-adm-data";
import { AdmReviewDialog } from "./AdmReviewDialog";
import { GuidanceAdmReferralFormSheet } from "./GuidanceAdmReferralFormSheet";
import { AdmTrackDialog } from "@/components/adm-tracker/AdmTrackDialog";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { fetchOcForm01Detail, type OcForm01Detail } from "@/components/ocform01/ocform01";
import {
  buildGcForm03Data,
  consultRecommendation,
  type GcForm03Data,
} from "./gcform03-data";
import { GcForm03PreviewDialog } from "./GcForm03PreviewDialog";
import styles from "./guidance-adm.module.css";

function formatStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

function referralLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Waiting on coordinator";
    case "in_progress":
      return "Being handled";
    case "resolved":
      return "Resolved";
    case "escalated":
      return "Sent higher up";
    case "follow_up":
      return "Follow-up";
    case "dismissed":
      return "Closed";
    default:
      return formatStatus(status);
  }
}

function eligibilityLabel(value: string): string {
  switch (value) {
    case "eligible":
      return "Eligible";
    case "ineligible":
      return "Incomplete file";
    default:
      return "For review";
  }
}

/* Queue-row case status: referred (needs review), endorsed, or rejected. */
function queueStatus(row: GuidanceAdmCase): { label: string; variant: "warning" | "success" | "destructive" | "secondary" } {
  if (row.reviewed === false) return { label: "Needs review", variant: "warning" };
  if (row.referralStatus === "dismissed") return { label: "Rejected", variant: "destructive" };
  if (row.referralStatus === "in_progress") return { label: "Endorsed", variant: "success" };
  return { label: "Reviewed", variant: "secondary" };
}

/* Latest action on a queue row, timed from the referral date. */
function queueLatest(row: GuidanceAdmCase): { label: string; icon: "eye" | "send" } {
  if (row.reviewed === false) return { label: "Waiting on your review", icon: "eye" };
  if (row.referralStatus === "dismissed") return { label: "Rejected", icon: "send" };
  return { label: "Endorsed to ADM coordinator", icon: "send" };
}

/* Plain next step so non-technical readers know who holds the case. */
function nextStep(row: GuidanceAdmCase): string {
  if (row.meetingAttended === false && !row.hasHomeVisit) {
    return "Needs a home visit";
  }
  switch (row.stage) {
    case "consultation":
      // Early ADM referrals sit at the guidance-owned consultation stage:
      // the counselor reviews the anecdotal first, the coordinator acts after.
      if (row.reviewed !== true) return "Waiting on your review";
      return row.referralStatus === "dismissed"
        ? "Rejected from ADM"
        : "Reviewed — with coordinator for parent meeting";
    case "meeting_parents":
      return row.meetingAttended ? "Meeting done — with coordinator" : "Waiting on parent meeting";
    case "home_visitation":
      return "Home visit in progress";
    case "certification":
      return "Coordinator building the file";
    case "principal_approval":
      return "Waiting on principal signature";
    case "enrollment_monitoring":
      return "Student on modules";
    case "completion":
      return "Done";
    default:
      return formatStatus(row.stage);
  }
}

function stageVariant(stage: string): "warning" | "destructive" | "secondary" | "outline" | "default" {
  if (stage === "consultation" || stage === "meeting_parents") return "warning";
  if (stage === "home_visitation") return "destructive";
  if (stage === "completion") return "secondary";
  if (stage === "principal_approval") return "default";
  return "outline";
}

interface GuidanceAdmTableProps {
  summary: GuidanceAdmSummary;
  /* Latest ADM cases referred to guidance — referred or endorsed. */
  reviewQueue: GuidanceAdmCase[];
}

export function GuidanceAdmTable({
  summary,
  reviewQueue,
}: GuidanceAdmTableProps) {
  const queryClient = useQueryClient();
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [formSheet, setFormSheet] = React.useState<{
    row: GuidanceAdmCase;
    draft: AdmReviewDraft;
  } | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [trackId, setTrackId] = React.useState<string | null>(null);
  // GCForm-03 (Control No. GCForm-03) viewer — rebuilt from the row + its
  // OCForm-01, exactly like the endorse-time preview.
  const [gcRow, setGcRow] = React.useState<GuidanceAdmCase | null>(null);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoadingId, setGcLoadingId] = React.useState<string | null>(null);

  async function openGcForm(row: GuidanceAdmCase) {
    if (gcLoadingId) return;
    if (gcData && gcRow?.id === row.id) {
      setGcRow(row);
      return;
    }
    setGcLoadingId(row.id);
    try {
      let report: OcForm01Detail | null = null;
      try {
        if (row.anecdotalId) report = await fetchOcForm01Detail(row.anecdotalId);
      } catch {
        report = null;
      }
      setGcData(buildGcForm03Data(row, report, consultRecommendation(row.consultNote)));
      setGcRow(row);
    } finally {
      setGcLoadingId(null);
    }
  }
  const findCase = (id: string | null) =>
    reviewQueue.find((c) => c.id === id) ?? null;
  const activeReview = findCase(reviewId);
  const activeReject = findCase(rejectId);
  const activeTrack = findCase(trackId);

  const openReview = (row: GuidanceAdmCase) => {
    setReviewId(row.id);
  };

  const reviewMutation = useGuidanceMutation({
    mutationFn: ({
      referralId,
      outcome,
      text,
    }: {
      referralId: string;
      outcome: "endorse" | "reject";
      text: string;
    }) => reviewAdmConsultation(referralId, { recommendation: text, outcome }),
    successTitle: "Rejected from ADM",
    successDescription:
      () => "The case was closed with your reason kept on record. No further ADM action is needed.",
    errorTitle: "Could not reject the case",
    errorFallback: "The rejection did not go through. Check your connection and try again.",
  });

  const closeReject = () => {
    setRejectId(null);
    setRejectReason("");
  };

  /* Shared queue rows — the table shell, search, and elapsed clock live
     in the shared component; this adapter only maps guidance rows. */
  const vmRows = React.useMemo<AdmQueueRowVM[]>(
    () =>
      reviewQueue.map((row) => {
        const status = queueStatus(row);
        const latest = queueLatest(row);
        const risk =
          row.riskLevel === "High" ||
          row.riskLevel === "Moderate" ||
          row.riskLevel === "Low"
            ? row.riskLevel
            : undefined;
        return {
          id: row.id,
          lrn: row.lrn || "—",
          student: row.student,
          section: row.section,
          searchText: `${row.student} ${row.lrn} ${row.section} ${row.reason} ${row.referredBy}`,
          statusLabel: status.label,
          statusVariant: status.variant,
          riskLevel: risk,
          latestLabel: latest.label,
          LatestIcon: latest.icon === "eye" ? Eye : Send,
          actionTime: `${row.date}T00:00:00`,
          dateReferred: formatDate(row.date),
        };
      }),
    [reviewQueue]
  );

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

  const submitQuickReject = () => {
    if (!activeReject || !rejectReason.trim()) return;
    if (reviewMutation.isPending) return;
    // Keep the dialog open while rejecting so the Reject button's spinner
    // stays visible. Close only on confirmed success; on error the dialog
    // stays open with the reason intact so the user can retry.
    reviewMutation.mutate(
      {
        referralId: activeReject.referralId,
        outcome: "reject",
        text: rejectReason.trim(),
      },
      {
        onSuccess: () => {
          closeReject();
        },
      }
    );
  };

  return (
    <div className={styles.feed}>
      {/* Latest ADM cases referred to you — referred or endorsed. Rows still
          needing your anecdotal review carry actions; decided rows render
          read-only. The table shell is shared with the nurse queue. */}
      <AdmQueueTable
        title="Latest referred ADM cases"
        description="The latest ADM cases referred to you — review the anecdotal, then endorse or reject."
        searchPlaceholder="Search student…"
        emptyTitle="No ADM cases referred to you yet"
        emptyHint="New ADM cases referred to you will appear here."
        rows={vmRows}
        renderActions={renderQueueActions}
      />



      {/* Endorsed cases moved to the coordinator with their full report —
          the anecdotal never opens on this desk (same overlay as the
          referrals desk). */}
      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={() => setEndorsedFor(null)}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />

      {/* Consultation review — shared dialog, same actions as the nurse
          ADM review: report, recommendation, book session, reject, or
          create the referral. */}
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
            void queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
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
            void queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
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

      {/* GCForm-03 referral-form viewer — read-only; the filled form lives
          with the ADM coordinator once endorsed. */}
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

      {/* Track ADM referral — full pipeline from the adviser's anecdotal
          filing through the picked consultation reviewer and every backend
          ADM stage. Read-only; handling stays on this page. */}
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

      {/* Quick reject straight from the Action column — no need to open the
           full report when the case clearly doesn't warrant ADM. */}
      <Dialog open={rejectId !== null} onOpenChange={(open) => { if (!open) closeReject(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject from ADM{activeReject ? ` — ${activeReject.student}` : ""}
            </DialogTitle>
            <DialogDescription>
              The case closes without further ADM action. Please say why, so
              there is a record.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="quickRejectReason">Why is this being rejected?</Label>
            <Textarea
              id="quickRejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this case doesn't warrant ADM…"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={closeReject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className={styles.btnRed}
              disabled={reviewMutation.isPending || !rejectReason.trim()}
              onClick={submitQuickReject}
            >
              {reviewMutation.isPending ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : null}
              {reviewMutation.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
