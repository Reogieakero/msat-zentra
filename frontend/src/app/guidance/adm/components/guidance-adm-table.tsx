"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { OcForm01Print } from "@/components/ocform01/OcForm01Print";
import {
  fetchOcForm01Detail,
  type OcForm01Detail,
} from "@/components/ocform01/ocform01";
import type {
  GuidanceAdmCase,
  GuidanceAdmStageFilter,
  GuidanceAdmSummary,
} from "./guidance-adm-data";
import { reviewAdmConsultation } from "./guidance-adm-data";
import { REFERRAL_DRAFT_KEY } from "./gcform03-data";
import { GuidanceAdmFilters } from "./guidance-adm-filters";
import pageStyles from "../../pages.module.css";
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
  /* Latest ADM cases referred to guidance still needing review. */
  reviewQueue: GuidanceAdmCase[];
  cases: GuidanceAdmCase[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  stage: GuidanceAdmStageFilter;
  onStageChange: (value: GuidanceAdmStageFilter) => void;
  isNavigating: boolean;
}

export function GuidanceAdmTable({
  summary,
  reviewQueue,
  cases,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  query,
  onQueryChange,
  stage,
  onStageChange,
  isNavigating,
}: GuidanceAdmTableProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [recommendation, setRecommendation] = React.useState("");
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [report, setReport] = React.useState<OcForm01Detail | null>(null);
  const [reportLoading, setReportLoading] = React.useState(false);
  const [reportError, setReportError] = React.useState<string | null>(null);
  const findCase = (id: string | null) =>
    reviewQueue.find((c) => c.id === id) ?? cases.find((c) => c.id === id) ?? null;
  const activeReview = findCase(reviewId);
  const activeReject = findCase(rejectId);
  const activeAnecdotalId = activeReview?.anecdotalId ?? null;

  /* Load the official anecdotal report when the overlay opens — same
     GCForm-01 sheet the referrals page previews. */
  React.useEffect(() => {
    if (reviewId === null || !activeAnecdotalId) return;
    let cancelled = false;
    fetchOcForm01Detail(activeAnecdotalId)
      .then((d) => {
        if (!cancelled) setReport(d);
      })
      .catch(() => {
        if (!cancelled)
          setReportError(
            "The anecdotal report could not be loaded. Check your connection and try again."
          );
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reviewId, activeAnecdotalId]);

  const reviewMutation = useMutation({
    mutationFn: ({
      referralId,
      outcome,
      text,
    }: {
      referralId: string;
      outcome: "endorse" | "reject";
      text: string;
    }) => reviewAdmConsultation(referralId, { recommendation: text, outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
    },
  });

  const closeReview = () => {
    setReviewId(null);
    setRecommendation("");
    setReport(null);
    setReportError(null);
    setReportLoading(false);
  };

  const closeReject = () => {
    setRejectId(null);
    setRejectReason("");
  };

  const openReview = (row: GuidanceAdmCase) => {
    setReviewId(row.id);
    setRecommendation("");
    setReport(null);
    setReportError(null);
    setReportLoading(true);
  };

  const submitReview = (outcome: "endorse" | "reject") => {
    if (!activeReview || !recommendation.trim()) return;
    reviewMutation.mutate({
      referralId: activeReview.referralId,
      outcome,
      text: recommendation.trim(),
    });
    closeReview();
  };

  /* Create referral opens the dedicated form page — stash the typed
     recommendation so the page auto-fills it. */
  const openReferralForm = () => {
    if (!activeReview) return;
    try {
      window.sessionStorage.setItem(REFERRAL_DRAFT_KEY, recommendation.trim());
    } catch {
      /* Private mode — the page still works, recommendation starts empty. */
    }
    closeReview();
    router.push(
      `/guidance/adm/referral/${encodeURIComponent(activeReview.referralId)}`
    );
  };

  const submitQuickReject = () => {
    if (!activeReject || !rejectReason.trim()) return;
    reviewMutation.mutate({
      referralId: activeReject.referralId,
      outcome: "reject",
      text: rejectReason.trim(),
    });
    closeReject();
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasActiveFilters = query.trim() !== "" || stage !== "";

  return (
    <div className={styles.feed}>
      {/* ADM cases referred to YOU that still need your anecdotal review —
          the 2 latest. Everything else is in the tracker below. */}
      <Card className={pageStyles.card}>
        <CardHeader>
          <CardTitle className={pageStyles.sectionTitle}>
            ADM referred needing action ({summary.awaitingReview})
          </CardTitle>
          <CardDescription className={pageStyles.sectionDesc}>
            The 3 latest ADM cases referred to you awaiting your anecdotal
            review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviewQueue.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No ADM cases waiting for your review</p>
              <p className={styles.emptyHint}>
                New ADM cases referred to you will appear here for review.
              </p>
            </div>
          ) : (
            <ul className={styles.reviewGrid}>
              {reviewQueue.map((row) => (
                <li key={row.id} className={styles.reviewCard}>
                  <div className={styles.consultMain}>
                    <p className={styles.studentName}>
                      {row.student}{" "}
                      <Badge variant="warning">Needs review</Badge>{" "}
                      {row.category ? (
                        <Badge variant="outline">{formatStatus(row.category)}</Badge>
                      ) : null}
                    </p>
                    <div className={styles.nestedCard}>
                      <ul className={styles.msgList}>
                      <li>
                        <span className={pageStyles.mono}>{row.lrn || "—"}</span>
                      </li>
                      <li>
                        {row.section}
                        {row.grade ? ` · ${row.grade}` : ""}
                      </li>
                      <li>
                        Sent by {row.referredBy} · {formatDate(row.date)}
                      </li>
                      </ul>
                    </div>
                  </div>
                  <div className={styles.consultActions}>
                    <Button
                      size="sm"
                      disabled={reviewMutation.isPending}
                      onClick={() => openReview(row)}
                    >
                      View anecdotal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewMutation.isPending}
                      onClick={() => {
                        setRejectId(row.id);
                        setRejectReason("");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Step 2+: handed to the ADM coordinator — read-only tracker. */}
      <div className={styles.kpiGrid}>
        <Card className={styles.kpiCard}>
          <p className={styles.kpiLabel}>ADM hand-offs</p>
          <p className={styles.kpiValue}>{summary.total}</p>
          <p className={styles.kpiHint}>Tracked profiles + referrals awaiting a profile.</p>
        </Card>
        <Card className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Awaiting your review</p>
          <p className={styles.kpiValue}>{summary.awaitingReview}</p>
          <p className={styles.kpiHint}>Consultation-stage referrals needing your anecdotal review.</p>
        </Card>
        <Card className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Home visitation stage</p>
          <p className={styles.kpiValue}>{summary.homeVisitation}</p>
          <p className={styles.kpiHint}>Cases currently on a home visit.</p>
        </Card>
        <Card className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Needs a home visit</p>
          <p className={styles.kpiValue}>{summary.needsHomeVisit}</p>
          <p className={styles.kpiHint}>Parents missed the meeting and no visit logged.</p>
        </Card>
      </div>

      <div className={styles.toolbar}>
        <p className={styles.count} aria-live="polite">
          {total === 0
            ? "No ADM cases referred to you for review"
            : `${total} ADM case${total === 1 ? "" : "s"} referred to you for review`}
        </p>
        <GuidanceAdmFilters
          query={query}
          onQueryChange={onQueryChange}
          stage={stage}
          onStageChange={onStageChange}
        />
      </div>

      {cases.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {hasActiveFilters ? "No hand-offs match your search" : "No ADM hand-offs yet"}
          </p>
          <p className={styles.emptyHint}>
            {hasActiveFilters
              ? "Try a different name or keyword, or clear the filter to see every hand-off."
              : "Cases you hand off to the ADM coordinator above will appear here with their stage and review state."}
          </p>
        </div>
      ) : (
        <div className={pageStyles.tableWrap}>
          <table className={pageStyles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Next step</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((row) => {
                const needsReview =
                  row.stage === "consultation" && row.reviewed === false;
                return (
                <tr key={row.id}>
                  <td>
                    <div className={styles.msgCard}>
                      <p className={styles.msgHead}>{row.student}</p>
                      <ul className={styles.msgList}>
                        <li>
                          <span className={pageStyles.mono}>{row.lrn || "—"}</span>
                        </li>
                        <li>
                          {row.section}
                          {row.grade ? ` · ${row.grade}` : ""}
                        </li>
                        <li>
                          Sent by {row.referredBy} · {formatDate(row.date)}
                        </li>
                      </ul>
                    </div>
                  </td>
                  <td>
                    <div className={styles.badgeRow}>
                      <Badge variant={stageVariant(row.stage)}>{row.stageLabel}</Badge>
                    </div>
                    <p className={styles.studentSub}>
                      File {row.referralId.slice(0, 8)}… ·{" "}
                      {row.stage === "consultation" && row.reviewed !== undefined
                        ? !row.reviewed
                          ? "Waiting on your review"
                          : row.referralStatus === "dismissed"
                            ? "Rejected"
                            : "Reviewed — with coordinator"
                        : referralLabel(row.referralStatus)}
                    </p>
                  </td>
                  <td>
                    <div className={styles.badgeRow}>
                      <Badge variant="secondary">{eligibilityLabel(row.eligibility)}</Badge>
                      {row.approved ? <Badge variant="default">Signed</Badge> : null}
                    </div>
                    <p className={styles.studentSub}>
                      {row.approved && row.approvedAt
                        ? `Principal signed ${formatDate(row.approvedAt)}`
                        : `Prepared by ${row.preparedBy}`}
                    </p>
                  </td>
                  <td>
                    <p className={styles.studentName}>{nextStep(row)}</p>
                    <p className={styles.studentSub}>
                      {row.stage === "consultation"
                        ? row.reviewed === true
                          ? "Coordinator schedules the parent meeting next."
                          : "Review the anecdotal, then endorse or return."
                        : "Tracked by the ADM coordinator."}
                    </p>
                  </td>
                  <td>
                    {needsReview ? (
                      <div className={styles.badgeRow}>
                        <Button
                          size="sm"
                          disabled={reviewMutation.isPending}
                          onClick={() => openReview(row)}
                        >
                          View anecdotal
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() => {
                            setRejectId(row.id);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : row.stage === "consultation" && row.reviewed === true ? (
                      <Badge
                        variant={
                          row.referralStatus === "dismissed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {row.referralStatus === "dismissed"
                          ? "Rejected"
                          : "Reviewed"}
                      </Badge>
                    ) : (
                      <span className={styles.studentSub}>—</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav className={styles.pager} aria-label="ADM hand-off pages">
        <p className={styles.range}>
          Showing hand-offs {start}–{end} of {total}
        </p>
        <div className={styles.pagerButtons}>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || isNavigating}
            onClick={() => onPageChange(page - 1)}
            aria-label="Show newer hand-offs"
          >
            ← Newer
          </Button>
          <span className={styles.pageLabel} aria-live="polite">
            {isNavigating ? (
              <span className={styles.loadingLabel}>
                <Loader2 className={styles.spin} aria-hidden="true" />
                Loading…
              </span>
            ) : (
              `Page ${page} of ${totalPages}`
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || isNavigating}
            onClick={() => onPageChange(page + 1)}
            aria-label="Show older hand-offs"
          >
            Older →
          </Button>
        </div>
      </nav>

      {/* Consultation review: the official anecdotal report, then the next
          step — create the referral forward to the coordinator, or reject. */}
      <Dialog open={reviewId !== null} onOpenChange={(open) => { if (!open) closeReview(); }}>
        <DialogContent
          style={{ maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }}
          className={styles.noScrollbar}
        >
          <DialogHeader>
            <DialogTitle>
              Anecdotal report{activeReview ? ` — ${activeReview.student}` : ""}
            </DialogTitle>
            <DialogDescription>
              This record was passed for ADM purposes and sits at your
              consultation stage. Read the official report, then create the
              referral forward or reject it.
            </DialogDescription>
          </DialogHeader>
          {reportLoading ? (
            <div className={styles.reviewFile} aria-busy="true">
              <Skeleton style={{ width: "100%", height: "0.875rem" }} />
              <Skeleton style={{ width: "100%", height: "0.875rem" }} />
              <Skeleton style={{ width: "55%", height: "0.875rem" }} />
            </div>
          ) : reportError ? (
            <div className={styles.errorBlock} role="alert">
              <p className={styles.errorText}>{reportError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => activeReview && openReview(activeReview)}
              >
                Try again
              </Button>
            </div>
          ) : report ? (
            <OcForm01Print detail={report} />
          ) : null}
          {reviewMutation.isError ? (
            <div className={styles.errorBlock} role="alert">
              <p className={styles.errorText}>
                Sorry — your review did not go through. Please try again.
              </p>
            </div>
          ) : null}
          <div>
            <Label htmlFor="consultRecommendation">Your consultation recommendation</Label>
            <Textarea
              id="consultRecommendation"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="What did your review find? What should happen next…"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeReview}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reviewMutation.isPending || !recommendation.trim() || !report}
              onClick={() => submitReview("reject")}
            >
              {reviewMutation.isPending ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : null}
              Reject
            </Button>
            <Button
              disabled={reviewMutation.isPending || !recommendation.trim() || !report}
              onClick={openReferralForm}
            >
              {reviewMutation.isPending ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : null}
              Create referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              variant="outline"
              onClick={closeReject}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
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
