"use client";
import { ChevronDown, HeartHandshake, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceEmptyState } from "../../components/GuidanceEmptyCard";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  GuidanceInterventionsSummary,
  RiskLevelFilter,
} from "@/services/guidance/interventions.types";
import { InterventionTableRow } from "./intervention-row";
import { Busy } from "./busy";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./guidance-interventions.module.css";

const LEVEL_OPTIONS: { value: RiskLevelFilter; label: string }[] = [
  { value: "High", label: "High risk" },
  { value: "Moderate", label: "Moderate risk" },
  { value: "All", label: "All at-risk" },
];
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
  const levelLabel =
    LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? "High risk";
  const levelNoun =
    level === "High"
      ? "high-risk student"
      : level === "Moderate"
        ? "moderate-risk student"
        : "at-risk student";
  return (
    <KanbanBoard
      title="Intervention cases"
      icon={
        <span className="text-amber-600 dark:text-amber-400" aria-hidden>
          <HeartHandshake size={14} />
        </span>
      }
      count={total}
      description={
        total === 0
          ? `No ${levelNoun}s right now`
          : `${total} ${levelNoun}${total === 1 ? "" : "s"}${
              summary.waitingReview > 0
                ? ` · ${summary.waitingReview} follow-up${summary.waitingReview === 1 ? "" : "s"} waiting for review`
                : ""
            }`
      }
      actions={
        <div className={styles.headerActions}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${styles.filterBtn} ${level !== "High" ? styles.filterActive : ""}`}
                aria-label={`Filter by risk level, currently showing: ${levelLabel}`}
              >
                <span className={styles.filterValue}>{levelLabel}</span>
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              {LEVEL_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={level === option.value}
                  onCheckedChange={() => onLevelChange(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
          <GuidanceEmptyState
            icon={hasActiveSearch ? SearchX : HeartHandshake}
            title={
              hasActiveSearch
                ? "No cases match your search"
                : "No intervention cases"
            }
            hint={
              hasActiveSearch
                ? "Try a different name or keyword, or clear the search to see every case."
                : "No intervention cases — nothing needs your attention right now."
            }
          />
        ) : (
          <ul
            className={styles.caseList}
            aria-label="Intervention cases on the guidance desk"
          >
            {students.map((row) => (
              <InterventionTableRow
                key={row.studentKey}
                row={row}
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
