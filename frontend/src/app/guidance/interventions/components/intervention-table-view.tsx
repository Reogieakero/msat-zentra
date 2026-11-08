"use client";
import { HeartHandshake, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  GradeFilter,
  GuidanceInterventionsSummary,
  RiskLevelFilter,
} from "@/services/guidance/interventions.types";
import { InterventionTableRow } from "./intervention-row";
import { Busy } from "./busy";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./guidance-interventions.module.css";

const LEVEL_OPTIONS: { value: RiskLevelFilter; label: string }[] = [
  { value: "All", label: "All at-risk" },
  { value: "High", label: "High risk" },
  { value: "Moderate", label: "Moderate risk" },
];

const GRADE_OPTIONS: { value: GradeFilter; label: string }[] = [
  { value: "", label: "All grades" },
  { value: "G7", label: "G7" },
  { value: "G8", label: "G8" },
  { value: "G9", label: "G9" },
  { value: "G10", label: "G10" },
  { value: "G11", label: "G11" },
  { value: "G12", label: "G12" },
];

/** Pill tab group — same markup/behaviour as the alerts desk FilterTabs. */
function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  tone,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  tone: "amber" | "blue";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className="inline-flex cursor-pointer rounded-md p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Pill tone={active ? tone : "neutral"}>{option.label}</Pill>
          </button>
        );
      })}
    </div>
  );
}
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
  level: RiskLevelFilter;
  onLevelChange: (value: RiskLevelFilter) => void;
  grade: GradeFilter;
  onGradeChange: (value: GradeFilter) => void;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating: boolean;
  actionIsError: boolean;
  expandedKey: string | null;
  onToggleDetails: (key: string) => void;
  now: number;
  locked: (key: string) => boolean;
  isBusy: (key: string, action: string) => boolean;
  isActionPending: boolean;
  onStart: (row: AtRiskStudentItem) => void;
  onChange: (row: AtRiskStudentItem) => void;
  onOutcome: (row: AtRiskStudentItem) => void;
  onMarkDone: (row: AtRiskStudentItem) => void;
  onSchedule: (row: AtRiskStudentItem) => void;
  onSession: (
    row: AtRiskStudentItem,
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onReview: (row: AtRiskStudentItem, decision: "approved" | "rejected") => void;
  onDocsChanged: () => void;
  highlightId?: string | null;
}
export function InterventionTableView({
  summary,
  students,
  page,
  pageSize,
  total,
  onPageChange,
  query,
  onQueryChange,
  level,
  onLevelChange,
  grade,
  onGradeChange,
  onRetry,
  isRetrying,
  isNavigating,
  actionIsError,
  expandedKey,
  onToggleDetails,
  now,
  locked,
  isBusy,
  isActionPending,
  onStart,
  onChange,
  onOutcome,
  onMarkDone,
  onSchedule,
  onSession,
  onReview,
  onDocsChanged,
  highlightId = null,
}: InterventionTableViewProps) {
  const hasActiveSearch = query.trim() !== "";
  const levelNoun =
    level === "High"
      ? "high-risk student"
      : level === "Moderate"
        ? "moderate-risk student"
        : "at-risk student";
  return (
    <KanbanBoard
      title="Intervention cases"
      className={styles.boardIn}
      icon={
        <span className="text-amber-600 dark:text-amber-400" aria-hidden>
          <HeartHandshake size={14} />
        </span>
      }
      headerCenter={
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs
            label="Filter cases by risk level"
            options={LEVEL_OPTIONS}
            value={level}
            onChange={onLevelChange}
            tone="blue"
          />
          <span className="h-4 w-px bg-border" aria-hidden />
          <FilterTabs
            label="Filter cases by grade level"
            options={GRADE_OPTIONS}
            value={grade}
            onChange={onGradeChange}
            tone="amber"
          />
        </div>
      }
      description={
        total === 0
          ? `No ${levelNoun}s right now`
          : `Students flagged by the risk engine who need a guidance follow-up.${
              summary.waitingReview > 0
                ? ` ${summary.waitingReview} follow-up${summary.waitingReview === 1 ? "" : "s"} waiting for review.`
                : ""
            }`
      }
      actions={
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              style={{ height: "2rem", borderRadius: "16px" }}
              placeholder="Search student…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Search at-risk students"
            />
          </div>
        </div>
      }
      footer={
        total > 0 ? (
          <Pagination
            currentPage={page}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        ) : null
      }
    >
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
      <div aria-busy={isNavigating || undefined}>
        {isNavigating ? (
          <div className={styles.caseList}>
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className={styles.skelCaseRow}>
                <Skeleton className={styles.skelAvatar} />
                <div className={styles.skelCaseLines}>
                  <Skeleton className={styles.skelBar} style={{ width: "38%" }} />
                  <Skeleton className={styles.skelBar} style={{ width: "24%" }} />
                </div>
                <Skeleton className={styles.skelCasePill} />
                <Skeleton className={styles.skelCaseBtn} />
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex w-full justify-center py-6">
            <InsightCallout role="status">
              {hasActiveSearch
                ? `No cases match “${query.trim()}”.`
                : "No cases match your filters."}
            </InsightCallout>
          </div>
        ) : (
          <ul
            className={styles.caseList}
            aria-label="Intervention cases on the guidance desk"
          >
            {students.map((row, index) => (
              <InterventionTableRow
                key={row.studentKey}
                row={row}
                index={index}
                highlighted={highlightId !== null && highlightId === row.studentKey}
                locked={locked(row.studentKey)}
                isActionPending={isActionPending}
                isBusy={(action) => isBusy(row.studentKey, action)}
                expanded={expandedKey === row.studentKey}
                onToggleDetails={() => onToggleDetails(row.studentKey)}
                now={now}
                onStart={() => onStart(row)}
                onChange={() => onChange(row)}
                onOutcome={() => onOutcome(row)}
                onMarkDone={() => onMarkDone(row)}
                onSchedule={() => onSchedule(row)}
                onSession={(session, dialog) =>
                  onSession(row, session, dialog)
                }
                onReview={(decision) => onReview(row, decision)}
                onDocsChanged={onDocsChanged}
              />
            ))}
          </ul>
        )}
      </div>
    </KanbanBoard>
  );
}
