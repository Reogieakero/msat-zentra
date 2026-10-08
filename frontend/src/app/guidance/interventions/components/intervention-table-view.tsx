"use client";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  GuidanceInterventionsSummary,
} from "@/services/guidance/interventions.types";
import { InterventionTableRow } from "./intervention-row";
import { Busy } from "./busy";
import styles from "./guidance-interventions.module.css";
export interface InterventionTableViewProps {
  summary: GuidanceInterventionsSummary;
  students: AtRiskStudentItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unfilteredTotal?: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating: boolean;
  actionIsError: boolean;
  collapsedPlans: Record<string, boolean>;
  onTogglePlan: (key: string) => void;
  expandedKey: string | null;
  onToggleDetails: (key: string) => void;
  now: number;
  locked: (key: string) => boolean;
  isBusy: (key: string, action: string) => boolean;
  isActionPending: boolean;
  onStart: (row: AtRiskStudentItem) => void;
  onChange: (row: AtRiskStudentItem) => void;
  onOutcome: (row: AtRiskStudentItem) => void;
  onSchedule: (row: AtRiskStudentItem) => void;
  onSession: (
    row: AtRiskStudentItem,
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onReview: (row: AtRiskStudentItem, decision: "approved" | "rejected") => void;
  onDocsChanged: () => void;
}
export function InterventionTableView({
  summary,
  students,
  page,
  pageSize,
  total,
  totalPages,
  unfilteredTotal,
  onPageChange,
  query,
  onQueryChange,
  onRetry,
  isRetrying,
  isNavigating,
  actionIsError,
  collapsedPlans,
  onTogglePlan,
  expandedKey,
  onToggleDetails,
  now,
  locked,
  isBusy,
  isActionPending,
  onStart,
  onChange,
  onOutcome,
  onSchedule,
  onSession,
  onReview,
  onDocsChanged,
}: InterventionTableViewProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasActiveSearch = query.trim() !== "";
  return (
    <section aria-label="Intervention cases" className={`${styles.feed} ${styles.panel}`}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Intervention cases</h2>
          <p className={styles.sectionDesc} aria-live="polite">
            {total === 0
              ? "No at-risk students right now"
              : `${total} at-risk student${total === 1 ? "" : "s"}${
                  summary.waitingReview > 0
                    ? ` · ${summary.waitingReview} follow-up${summary.waitingReview === 1 ? "" : "s"} waiting for review`
                    : ""
                }`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              style={{ height: "2rem" }}
              placeholder="Search student…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Search at-risk students"
            />
          </div>
        </div>
      </div>
      {actionIsError && (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — that did not go through. Please try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => onRetry()}
          >
            <Busy busy={isRetrying} />
            {isRetrying ? "Loading…" : "Try again"}
          </Button>
        </div>
      )}
      <div className={styles.tableBody}>
        {students.length === 0 ? (
          <p className={styles.empty}>
            {hasActiveSearch
              ? "No cases match your search."
              : "No intervention cases — nothing needs your attention right now."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label="Intervention cases on the guidance desk">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Risk level</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Latest action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className={styles.srOnly}>Row actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((row) => (
                  <InterventionTableRow
                    key={row.studentKey}
                    row={row}
                    locked={locked(row.studentKey)}
                    isActionPending={isActionPending}
                    isBusy={(action) => isBusy(row.studentKey, action)}
                    planCollapsed={collapsedPlans[row.studentKey] === true}
                    onTogglePlan={() => onTogglePlan(row.studentKey)}
                    expanded={expandedKey === row.studentKey}
                    onToggleDetails={() => onToggleDetails(row.studentKey)}
                    now={now}
                    onStart={() => onStart(row)}
                    onChange={() => onChange(row)}
                    onOutcome={() => onOutcome(row)}
                    onSchedule={() => onSchedule(row)}
                    onSession={(session, dialog) =>
                      onSession(row, session, dialog)
                    }
                    onReview={(decision) => onReview(row, decision)}
                    onDocsChanged={onDocsChanged}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className={styles.pager}>
          <p className={styles.range}>
            Showing {start}–{end} of {total}
            {unfilteredTotal !== undefined && unfilteredTotal !== total
              ? ` (of ${unfilteredTotal} in cohort)`
              : ""}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
              variant="outline"
              disabled={page <= 1 || isNavigating}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className={styles.pageLabel} aria-live="polite">
              {isNavigating ? (
                <span className={styles.loadingLabel}>
                  <Busy busy />
                  Loading…
                </span>
              ) : (
                `Page ${page} of ${totalPages}`
              )}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={page >= totalPages || isNavigating}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
