"use client";
import * as React from "react";
import {
  BellRing,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import type { GuidanceRiskLevel } from "@/services/guidance/guidance.types";
import type {
  AlertCaseType,
  GuidanceAlertCasesSummary,
} from "@/services/guidance/alerts.types";
import { useNowTick } from "@/lib/clock";
import {
  rowKey,
  rowRisk,
  rowSearchText,
  rowType,
  type GuidanceAlertRow,
  type TypeFilter,
} from "./guidance-alerts-helpers";
import { CaseKanbanRow } from "./guidance-alerts-row";
import { GuidanceBookedSessionButton } from "./GuidanceAlertsRowActions";
import { GuidanceCaseDetailDialog } from "../../components/GuidanceCaseDetailDialog";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import styles from "./guidance-alerts-table.module.css";
export type { GuidanceAlertRow };

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ADM", label: "ADM" },
  { value: "Counseling", label: "Counseling" },
  { value: "Intervention", label: "Intervention" },
];

export type RiskFilter = "" | GuidanceRiskLevel;

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "", label: "All risks" },
  { value: "High", label: "High risk" },
  { value: "Moderate", label: "Moderate risk" },
];

/** Pill tab group — same pattern as the record-keeper academics grade tabs. */
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

/**
 * Client-side board: the page loads the whole alerts desk once and hands every
 * row here, so typing in the search box filters instantly with no request (same
 * behaviour as the adviser-access desk). Low-risk rows never reach the desk —
 * the backend drops them.
 */
export function GuidanceAlertsTable({
  rows,
  riskByStudent,
  summary,
  query,
  type,
  risk,
  onQueryChange,
  onTypeChange,
  onRiskChange,
}: {
  rows: GuidanceAlertRow[];
  riskByStudent: Record<string, GuidanceRiskLevel>;
  summary: GuidanceAlertCasesSummary;
  query: string;
  type: AlertCaseType;
  risk: RiskFilter;
  onQueryChange: (next: string) => void;
  onTypeChange: (next: AlertCaseType) => void;
  onRiskChange: (next: RiskFilter) => void;
}) {
  const [activeRow, setActiveRow] = React.useState<GuidanceAlertRow | null>(null);
  const [page, setPage] = React.useState(1);
  const now = useNowTick();
  const activeRisk = risk ?? "";
  const hasRows = summary.total > 0;
  const searching = query.trim().length > 0;

  const filteredRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (type && rowType(row) !== type) return false;
      if (activeRisk && rowRisk(row, riskByStudent) !== activeRisk) return false;
      if (needle && !rowSearchText(row).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, type, activeRisk, query, riskByStudent]);

  // Any filter change starts the board back at page 1.
  const changeType = (next: AlertCaseType) => {
    setPage(1);
    onTypeChange(next);
  };
  const changeRisk = (next: RiskFilter) => {
    setPage(1);
    onRiskChange(next);
  };
  const changeQuery = (next: string) => {
    setPage(1);
    onQueryChange(next);
  };

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = React.useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage],
  );

  return (
    <>
      <KanbanBoard
        title="Referred cases"
        className={styles.boardIn}
        icon={
          <span className="text-amber-600 dark:text-amber-400" aria-hidden>
            <BellRing size={14} />
          </span>
        }
        description={
          hasRows
            ? "Every ADM, counseling, and intervention case on your desk."
            : "No referred cases — nothing needs your attention right now."
        }
        headerCenter={
          hasRows ? (
            <div className={styles.headerTabs}>
              <FilterTabs
                label="Filter cases by type"
                options={TYPE_OPTIONS}
                value={type}
                onChange={(next) => changeType(next as AlertCaseType)}
                tone="amber"
              />
              <span className={styles.tabDivider} aria-hidden />
              <FilterTabs
                label="Filter cases by risk"
                options={RISK_OPTIONS}
                value={activeRisk}
                onChange={changeRisk}
                tone="blue"
              />
            </div>
          ) : null
        }
        actions={
          hasRows ? (
            <div className={styles.headerControls}>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} aria-hidden />
                <Input
                  className={styles.search}
                  style={{ borderRadius: "16px" }}
                  placeholder="Search by student or keyword…"
                  value={query}
                  onChange={(e) => changeQuery(e.target.value)}
                  aria-label="Search referred cases"
                />
              </div>
            </div>
          ) : null
        }
        footer={
          filteredRows.length > 0 ? (
            <Pagination
              currentPage={safePage}
              totalItems={filteredRows.length}
              onPageChange={setPage}
            />
          ) : null
        }
      >
        {filteredRows.length === 0 ? (
          <div className="flex w-full justify-center py-6">
            <InsightCallout role="status">
              {searching
                ? `No cases match “${query.trim()}”.`
                : "No cases match your filters."}
            </InsightCallout>
          </div>
        ) : (
          <ul className={styles.caseList} aria-label="Cases on the guidance desk">
            {pageRows.map((row, index) => (
              <CaseKanbanRow
                key={rowKey(row)}
                row={row}
                index={index}
                riskLevel={rowRisk(row, riskByStudent)}
                now={now}
                onOpen={() => setActiveRow(row)}
                onBook={() => setActiveRow(null)}
              />
            ))}
          </ul>
        )}
      </KanbanBoard>
      <GuidanceCaseDetailDialog
        row={activeRow}
        riskLevel={activeRow ? rowRisk(activeRow, riskByStudent) : undefined}
        onClose={() => setActiveRow(null)}
        actions={
          activeRow?.kind === "intervention" ? (
            <GuidanceBookedSessionButton
              item={activeRow.item}
              onBeforeOpen={() => setActiveRow(null)}
              keepOverlayOnOpen
            />
          ) : undefined
        }
      />
    </>
  );
}
