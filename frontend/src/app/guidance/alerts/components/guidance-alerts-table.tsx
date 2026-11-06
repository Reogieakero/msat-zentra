"use client";
import * as React from "react";
import {
  BellRing,
  ChevronDown,
  Search,
  SearchX,
  ShieldAlert,
} from "lucide-react";
import { GuidanceEmptyState } from "../../components/GuidanceEmptyCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type { GuidanceRiskLevel } from "@/services/guidance/guidance.types";
import type {
  AlertCaseType,
  GuidanceAlertCasesSummary,
} from "@/services/guidance/alerts.types";
import { useNowTick } from "@/lib/clock";
import { rowKey, rowRisk, type GuidanceAlertRow, type TypeFilter } from "./guidance-alerts-helpers";
import { CaseKanbanRow } from "./guidance-alerts-row";
import { GuidanceBookedSessionButton } from "./GuidanceAlertsRowActions";
import { GuidanceCaseDetailDialog } from "../../components/GuidanceCaseDetailDialog";
import { Pagination } from "@/components/shared/pagination";
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
  { value: "Low", label: "Low risk" },
];

/**
 * Server-paged board: filters, search and paging are query params resolved by
 * `/api/guidance/alerts/cases`, so this component only renders the page it is
 * handed. Low-risk rows never reach the desk — the backend drops them.
 */
export function GuidanceAlertsTable({
  rows,
  riskByStudent,
  summary,
  total,
  page,
  query,
  type,
  risk,
  onQueryChange,
  onTypeChange,
  onRiskChange,
  onPageChange,
}: {
  rows: GuidanceAlertRow[];
  riskByStudent: Record<string, GuidanceRiskLevel>;
  summary: GuidanceAlertCasesSummary;
  total: number;
  page: number;
  query: string;
  type: AlertCaseType;
  risk: RiskFilter;
  onQueryChange: (next: string) => void;
  onTypeChange: (next: AlertCaseType) => void;
  onRiskChange: (next: RiskFilter) => void;
  onPageChange: (next: number) => void;
}) {
  const [activeRow, setActiveRow] = React.useState<GuidanceAlertRow | null>(null);
  const now = useNowTick();
  const activeRisk = risk ?? "";
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";
  const riskLabel = RISK_OPTIONS.find((o) => o.value === activeRisk)?.label ?? "All risks";
  const hasRows = summary.total > 0;
  const hasFilters = type !== "" || activeRisk !== "" || query.trim() !== "";

  return (
    <>
      <KanbanBoard
        title="Referred cases"
        icon={
          <span className="text-amber-600 dark:text-amber-400" aria-hidden>
            <BellRing size={14} />
          </span>
        }
        count={total}
        description={
          hasRows
            ? "Every ADM, counseling, and intervention case on your desk."
            : "No referred cases — nothing needs your attention right now."
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
                  onChange={(e) => onQueryChange(e.target.value)}
                  aria-label="Search referred cases"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Filter cases by type, currently showing: ${typeLabel}`}
                    className={`${styles.filterBtn} ${type !== "" ? styles.filterActive : ""}`}
                  >
                    <span className={styles.filterValue}>{type === "" ? "Type" : typeLabel}</span>
                    {type !== "" && <span className={styles.filterDot} aria-hidden />}
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={styles.filterMenu}>
                  {TYPE_OPTIONS.map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item.label}
                      checked={type === item.value}
                      onCheckedChange={() => onTypeChange(item.value as AlertCaseType)}
                    >
                      {item.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Filter cases by risk, currently showing: ${riskLabel}`}
                    className={`${styles.filterBtn} ${activeRisk !== "" ? styles.filterActive : ""}`}
                  >
                    <ShieldAlert aria-hidden />
                    <span className={styles.filterValue}>
                      {activeRisk === "" ? "Risk" : riskLabel.replace(" risk", "")}
                    </span>
                    {activeRisk !== "" && <span className={styles.filterDot} aria-hidden />}
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={styles.filterMenu}>
                  {RISK_OPTIONS.map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item.label}
                      checked={activeRisk === item.value}
                      onCheckedChange={() => onRiskChange(item.value)}
                    >
                      {item.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null
        }
        footer={
          total > 0 ? (
            <Pagination currentPage={page} totalItems={total} onPageChange={onPageChange} />
          ) : null
        }
      >
        {!hasRows ? (
          <GuidanceEmptyState
            icon={BellRing}
            title="No referred cases"
            hint="No referred cases — nothing needs your attention right now."
          />
        ) : rows.length === 0 ? (
          <GuidanceEmptyState
            icon={SearchX}
            title="No cases match your filters"
            hint={
              hasFilters
                ? "Try a different name or keyword, or clear the search and filters."
                : "Nothing on this page — try an earlier one."
            }
          />
        ) : (
          <ul className={styles.caseList} aria-label="Cases on the guidance desk">
            {rows.map((row) => (
              <CaseKanbanRow
                key={rowKey(row)}
                row={row}
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
