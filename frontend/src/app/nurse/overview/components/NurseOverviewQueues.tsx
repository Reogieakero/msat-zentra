"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  deriveActionStatus,
  type NurseQueueRow,
} from "./nurse-overview-data";
import { NurseQueueRowActions } from "./NurseQueueRowActions";
import { NurseAdmReviewDialog } from "./NurseAdmReviewDialog";
import { NurseForwardAdmButton } from "./NurseForwardAdmButton";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseAdmReferralFormSheet } from "../../referrals/components/NurseAdmReferralFormSheet";
import styles from "./nurse-overview.module.css";

const ROW_LIMIT = 8;

/* Status badge follows what the nurse actually did with the referral —
   the same action vocabulary as the overview KPI cards and charts. */
function nurseActionStatus(row: NurseQueueRow): { key: string; label: string; className: string } {
  const action = deriveActionStatus(row.type, row.status, row.sessions);
  let className: string;
  switch (action.key) {
    case "endorsed":
    case "done":
    case "done_session":
      className = `${styles.badge} ${styles.badgeResolved}`;
      break;
    case "rejected":
      className = `${styles.badge} ${styles.badgeMuted}`;
      break;
    case "needs_review":
      className = `${styles.badge} ${styles.badgePending}`;
      break;
    case "escalated":
      className = `${styles.badge} ${styles.badgeEscalated}`;
      break;
    default:
      className = `${styles.badge} ${styles.badgeActive}`;
  }
  return { ...action, className };
}

/* Elapsed wait from the referred time to now — days / hours / minutes,
   never seconds. */
function waitingElapsed(referredAt: string, nowMs: number): string {
  if (!referredAt) return "—";
  const t = new Date(referredAt).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.floor(Math.max(0, nowMs - t) / 60_000);
  if (mins < 1) return "Just now";
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (mins % 60 > 0) parts.push(`${mins % 60}m`);
  return parts.join(" ");
}

/* Minute-precision clock is enough (no seconds displayed) — re-renders
   twice a minute so the Waiting column stays fresh. */
function useNowMs(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

export function NurseNeedsReviewPanel({
  needsReview,
}: {
  needsReview: NurseQueueRow[];
}) {
  const [formSheet, setFormSheet] = React.useState<{
    row: NurseQueueRow;
    draft: AdmReviewDraft;
  } | null>(null);
  const queryClient = useQueryClient();
  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
  }, [queryClient]);
  const nowMs = useNowMs();

  const filtered = needsReview;

  const visibleRows = filtered.slice(0, ROW_LIMIT);

  return (
    <>
      <Card className={`${styles.panel} ${styles.needsPanel}`}>
        <div className={styles.panelHeadText}>
          <h2 className={styles.panelTitle}>Needs your review</h2>
          <p className={styles.panelDesc}>
            Pending cases routed to the clinic, longest waiting first.
          </p>
        </div>
        {needsReview.length === 0 ? (
          <p className={styles.empty}>All caught up — nothing waiting for review.</p>
        ) : (
          <>
            <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Grade</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Waiting</th>
                        <th>
                          <span className={styles.srOnly}>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => {
                        const action = nurseActionStatus(row);
                        // Same deep-links as the alerts table — the case
                        // page auto-scrolls to and highlights the row; ADM
                        // form-ready cases also overlay the filled form.
                        const homeBase =
                          row.type === "ADM" ? "/nurse/referrals/adm" : "/nurse/referrals/clinic";
                        const seeMoreHref = `${homeBase}?highlight=${row.id}`;
                        const viewFormHref =
                          row.type === "ADM" && row.referralReady
                            ? `${seeMoreHref}&form=1`
                            : seeMoreHref;
                        return (
                        <tr key={row.id}>
                          <td>
                            <div className={styles.studentCell}>
                              <span className={styles.studentName}>{row.student}</span>
                              <span className={styles.studentLrn}>{row.lrn}</span>
                            </div>
                          </td>
                          <td>{row.grade}</td>
                          <td>
                            <span
                              className={
                                row.type === "ADM"
                                  ? `${styles.badge} ${styles.badgeActive}`
                                  : `${styles.badge} ${styles.badgeMuted}`
                              }
                            >
                              {row.type === "ADM" ? "ADM case" : "Clinic"}
                            </span>
                          </td>
                          <td>{row.category}</td>
                          <td>
                            <span className={action.className}>{action.label}</span>
                          </td>
                          <td className={styles.wait}>{waitingElapsed(row.referredAt, nowMs)}</td>
                          <td>
                            <div className={styles.cellActions}>
                              {row.type === "ADM" &&
                                row.status === "pending" &&
                                row.referralReady && (
                                  <NurseForwardAdmButton
                                    id={row.id}
                                    student={row.student}
                                    onChanged={refresh}
                                  />
                                )}
                              {row.type === "ADM" && row.status === "pending" && (
                                <NurseAdmReviewDialog
                                  row={row}
                                  onChanged={refresh}
                                  onCreateReferral={(draft) => setFormSheet({ row, draft })}
                                />
                              )}
                              <NurseQueueRowActions
                                row={row}
                                onChanged={refresh}
                                seeMoreHref={seeMoreHref}
                                viewFormHref={viewFormHref}
                                viewOnly
                              />
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
          </>
        )}
      </Card>

      {formSheet && (
        <NurseAdmReferralFormSheet
          open
          onClose={() => setFormSheet(null)}
          row={formSheet.row}
          initialDraft={formSheet.draft}
          onChanged={refresh}
        />
      )}
    </>
  );
}
