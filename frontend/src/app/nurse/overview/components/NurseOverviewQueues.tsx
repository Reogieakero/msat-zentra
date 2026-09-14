"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  NURSE_STATUS_LABELS,
  type NurseFollowUpRow,
  type NurseQueueRow,
} from "./nurse-overview-data";
import { NurseQueueFilters, type NurseQueueTypeFilter } from "./NurseQueueFilters";
import { NurseQueueRowActions } from "./NurseQueueRowActions";
import { NurseAdmReviewDialog } from "./NurseAdmReviewDialog";
import { NurseForwardAdmButton } from "./NurseForwardAdmButton";
import styles from "./nurse-overview.module.css";

const PAGE_SIZE = 5;

function statusBadgeClass(status: string): string {
  if (status === "pending") return `${styles.badge} ${styles.badgePending}`;
  if (status === "escalated") return `${styles.badge} ${styles.badgeEscalated}`;
  if (status === "resolved") return `${styles.badge} ${styles.badgeResolved}`;
  if (status === "dismissed") return `${styles.badge} ${styles.badgeMuted}`;
  return `${styles.badge} ${styles.badgeActive}`;
}

function statusLabel(status: string): string {
  return NURSE_STATUS_LABELS[status] ?? status;
}

function waitingText(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  return `${days}d waiting`;
}

export function NurseOverviewQueues({
  needsReview,
  followUpsDue,
}: {
  needsReview: NurseQueueRow[];
  followUpsDue: NurseFollowUpRow[];
}) {
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<NurseQueueTypeFilter>("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const queryClient = useQueryClient();
  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
  }, [queryClient]);

  const statusOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of needsReview) {
      if (!seen.has(row.status)) {
        seen.set(row.status, NURSE_STATUS_LABELS[row.status] ?? row.status);
      }
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [needsReview]);

  const categoryOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const row of needsReview) seen.add(row.category);
    return [...seen].sort();
  }, [needsReview]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return needsReview.filter((row) => {
      if (typeFilter !== "" && row.type !== typeFilter) return false;
      if (statusFilter !== "" && row.status !== statusFilter) return false;
      if (categoryFilter !== "" && row.category !== categoryFilter) return false;
      if (q !== "" && !`${row.student} ${row.lrn} ${row.reason}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [needsReview, query, typeFilter, statusFilter, categoryFilter]);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setTypeFilter("");
    setStatusFilter("");
    setCategoryFilter("");
    setPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <>
      <Card className={styles.panel}>
        <div className={styles.panelHead}>
          <div className={styles.panelHeadText}>
            <h2 className={styles.panelTitle}>Needs your review</h2>
            <p className={styles.panelDesc}>
              Pending cases routed to the clinic, longest waiting first.
            </p>
          </div>
          {needsReview.length > 0 && (
            <NurseQueueFilters
              query={query}
              onQueryChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              typeFilter={typeFilter}
              onTypeChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
              statusFilter={statusFilter}
              onStatusChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              statusOptions={statusOptions}
              categoryFilter={categoryFilter}
              onCategoryChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
              categoryOptions={categoryOptions}
              onClear={clearFilters}
            />
          )}
        </div>
        {needsReview.length === 0 ? (
          <p className={styles.empty}>All caught up — nothing waiting for review.</p>
        ) : (
          <>
            {filtered.length === 0 ? (
              <p className={styles.empty}>No cases match your search and filters.</p>
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
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Waiting</th>
                        <th>
                          <span className={styles.srOnly}>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => (
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
                          <td className={styles.reason}>{row.reason}</td>
                          <td>
                            <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                          </td>
                          <td className={styles.wait}>{waitingText(row.waitingDays)}</td>
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
                                <NurseAdmReviewDialog row={row} onChanged={refresh} />
                              )}
                              <NurseQueueRowActions row={row} onChanged={refresh} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.pager}>
                  <span className={styles.pagerInfo}>
                    {start}–{end} of {filtered.length}
                  </span>
                  <div className={styles.pagerActions}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Go to previous page"
                    >
                      <ChevronLeft aria-hidden />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Go to next page"
                    >
                      Next
                      <ChevronRight aria-hidden />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </Card>

      <Card className={styles.panel}>
        <h2 className={styles.panelTitle}>Follow-ups due</h2>
        <p className={styles.panelDesc}>
          Cases with a follow-up date of today or earlier that are still open.
        </p>
        {followUpsDue.length === 0 ? (
          <p className={styles.empty}>No follow-ups are overdue.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Grade</th>
                  <th>Due</th>
                  <th>Overdue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {followUpsDue.slice(0, 10).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.studentCell}>
                        <span className={styles.studentName}>{row.student}</span>
                        <span className={styles.studentLrn}>{row.lrn}</span>
                      </div>
                    </td>
                    <td>{row.grade}</td>
                    <td>{row.dueDate}</td>
                    <td className={styles.wait}>
                      {row.overdueDays === null || row.overdueDays === 0 ? "Due today" : `${row.overdueDays}d overdue`}
                    </td>
                    <td>
                      <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
