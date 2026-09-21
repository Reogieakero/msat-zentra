"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, MoreHorizontal, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  GuidanceAdmCase,
  GuidanceAdmSummary,
} from "./guidance-adm-data";
import { reviewAdmConsultation } from "./guidance-adm-data";
import { AdmReviewDialog } from "./AdmReviewDialog";
import { GuidanceAdmReferralFormSheet } from "./GuidanceAdmReferralFormSheet";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { fetchOcForm01Detail, type OcForm01Detail } from "@/components/ocform01/ocform01";
import {
  buildGcForm03Data,
  consultRecommendation,
  type GcForm03Data,
} from "./gcform03-data";
import { GcForm03PreviewDialog } from "./GcForm03PreviewDialog";
import { toast } from "@/components/ui/sonner";
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

/* Live clock for the queue's elapsed readouts — ticks every 30s, same as
   the alerts table. */
function useQueueTick(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/* "4d 3h 12m" — days, hours, minutes only, never seconds. */
function formatElapsedShort(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
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
  const queueNow = useQueueTick();
  const [queueQuery, setQueueQuery] = React.useState("");
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [formSheet, setFormSheet] = React.useState<{
    row: GuidanceAdmCase;
    draft: AdmReviewDraft;
  } | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
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

  const openReview = (row: GuidanceAdmCase) => {
    setReviewId(row.id);
  };

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
      toast.success({
        title: "Rejected from ADM",
        description: "The case was closed with your reason kept on record. No further ADM action is needed.",
      });
    },
    onError: () => {
      toast.error({
        title: "Could not reject the case",
        description: "The rejection did not go through. Check your connection and try again.",
      });
    },
  });

  const closeReject = () => {
    setRejectId(null);
    setRejectReason("");
  };

  const filteredQueue = React.useMemo(() => {
    const q = queueQuery.trim().toLowerCase();
    if (!q) return reviewQueue;
    return reviewQueue.filter((r) =>
      `${r.student} ${r.lrn} ${r.section} ${r.reason} ${r.referredBy}`
        .toLowerCase()
        .includes(q)
    );
  }, [reviewQueue, queueQuery]);

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
          read-only. */}
      <Card className={pageStyles.card}>
        <CardHeader>
          <div className={styles.queueHeadRow}>
            <div>
              <CardTitle className={pageStyles.sectionTitle}>
                Latest referred ADM cases
              </CardTitle>
              <CardDescription className={pageStyles.sectionDesc}>
                The latest ADM cases referred to you — review the anecdotal,
                then endorse or reject.
              </CardDescription>
            </div>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                style={{ height: "2rem" }}
                placeholder="Search student…"
                value={queueQuery}
                onChange={(e) => setQueueQuery(e.target.value)}
                aria-label="Search referred ADM cases"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredQueue.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {queueQuery.trim() !== ""
                  ? "No cases match your search"
                  : "No ADM cases referred to you yet"}
              </p>
              <p className={styles.emptyHint}>
                {queueQuery.trim() !== ""
                  ? "Try a different name or keyword."
                  : "New ADM cases referred to you will appear here."}
              </p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <Table aria-label="Latest ADM cases referred to you">
                <TableHeader>
                  <TableRow>
                    <TableHead>LRN</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Case status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Latest action</TableHead>
                    <TableHead>Time elapsed</TableHead>
                    <TableHead>Date referred</TableHead>
                    <TableHead>
                      <span className={styles.srOnly}>Row actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueue.map((row) => {
                    const needsAction = row.reviewed === false;
                    const status = queueStatus(row);
                    const isEndorsed =
                      row.reviewed === true && row.referralStatus === "in_progress";
                    const latest = queueLatest(row);
                    const at = new Date(`${row.date}T00:00:00`).getTime();
                    const actionMs = Number.isFinite(at) ? Math.max(0, queueNow - at) : null;
                    const ActionIcon = latest.icon === "eye" ? Eye : Send;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className={styles.cellMain}>
                            <span className={styles.lrn}>{row.lrn || "—"}</span>
                          </p>
                          <p className={styles.cellSub}>
                            {row.student} · {row.section}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">ADM</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {row.category ? (
                            <p className={styles.cellSub}>{formatStatus(row.category)}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {row.riskLevel === "High" ? (
                            <Badge variant="destructive">High</Badge>
                          ) : row.riskLevel === "Moderate" ? (
                            <Badge variant="warning">Moderate</Badge>
                          ) : row.riskLevel === "Low" ? (
                            <Badge variant="outline">Low</Badge>
                          ) : (
                            <span className={styles.noRisk}>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className={styles.actionLabel}>
                            <ActionIcon className={styles.actionIcon} aria-hidden />
                            <span>{latest.label}</span>
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className={styles.cellTime} aria-live="off">
                            {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className={styles.cellMain}>{formatDate(row.date)}</p>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>



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
