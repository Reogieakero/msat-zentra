"use client";
import { HeartHandshake, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  GuidanceInterventionsSummary,
} from "@/services/guidance/interventions.types";
import type { InterventionStatusFilter } from "./intervention-row-helpers";
import { InterventionTableRow } from "./intervention-row";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./guidance-interventions.module.css";

const STATUS_OPTIONS: { value: InterventionStatusFilter; label: string }[] = [
  { value: "no_action", label: "No action yet" },
  { value: "booked", label: "Booked session" },
  { value: "session_done", label: "Session done" },
  { value: "follow_up", label: "Follow-up session" },
  { value: "done", label: "Done" },
  { value: "discontinued", label: "Discontinued" },
  { value: "risk_cleared", label: "No longer at risk" },
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
  status: InterventionStatusFilter;
  onStatusChange: (value: InterventionStatusFilter) => void;
  isNavigating: boolean;
  expandedKey: string | null;
  onToggleDetails: (key: string) => void;
  now: number;
  locked: (key: string) => boolean;
  isBusy: (key: string, action: string) => boolean;
  isActionPending: boolean;
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
  status,
  onStatusChange,
  isNavigating,
  expandedKey,
  onToggleDetails,
  now,
  locked,
  isBusy,
  isActionPending,
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
  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses";
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
            label="Filter cases by status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={onStatusChange}
            tone="amber"
          />
        </div>
      }
      description={
        total === 0
          ? status === "all"
            ? "No intervention cases right now"
            : `No cases in “${statusLabel}” right now`
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
                : status === "all"
                  ? "No cases match your filters."
                  : `No cases in “${statusLabel}” right now.`}
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
