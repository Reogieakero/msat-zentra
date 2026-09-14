"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  FactorFilter,
  FollowUpStatusFilter,
  RiskLevelFilter,
} from "./guidance-interventions-data";
import styles from "./intervention-filters.module.css";

const LEVEL_OPTIONS: { value: RiskLevelFilter; label: string }[] = [
  { value: "High", label: "High risk" },
  { value: "Moderate", label: "Moderate risk" },
  { value: "All", label: "All at-risk" },
];

const FACTOR_OPTIONS: { value: FactorFilter; label: string }[] = [
  { value: "", label: "All reasons" },
  { value: "Academic", label: "Low grades" },
  { value: "Attendance", label: "Absences" },
  { value: "Behavioral", label: "Behavior reports" },
];

const FOLLOW_UP_OPTIONS: { value: FollowUpStatusFilter; label: string }[] = [
  { value: "all", label: "Show everything" },
  { value: "", label: "Open follow-ups" },
  { value: "ongoing", label: "Still ongoing" },
  { value: "resolved", label: "Resolved" },
  { value: "unresolved", label: "Closed — not resolved" },
];

interface CompactFilterProps {
  buttonLabel: string;
  active: boolean;
  ariaLabel: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/* Same compact dropdown design as the referrals status filter. */
function CompactFilter({
  buttonLabel,
  active,
  ariaLabel,
  options,
  value,
  onChange,
}: CompactFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          className={`${styles.filterBtn} ${active ? styles.filterActive : ""}`}
        >
          {buttonLabel}
          {active && <span className={styles.filterDot} aria-hidden />}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.filterMenu}>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={value === option.value}
            onCheckedChange={() => onChange(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface InterventionFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  level: RiskLevelFilter;
  onLevelChange: (value: RiskLevelFilter) => void;
  factor: FactorFilter;
  onFactorChange: (value: FactorFilter) => void;
  outcome: FollowUpStatusFilter;
  onOutcomeChange: (value: FollowUpStatusFilter) => void;
  mineOnly: boolean;
  onMineOnlyChange: (value: boolean) => void;
}

export function InterventionFilters({
  query,
  onQueryChange,
  level,
  onLevelChange,
  factor,
  onFactorChange,
  outcome,
  onOutcomeChange,
  mineOnly,
  onMineOnlyChange,
}: InterventionFiltersProps) {
  const hasActiveFilters =
    query.trim() !== "" ||
    level !== "High" ||
    factor !== "" ||
    outcome !== "all" ||
    mineOnly;
  const levelLabel =
    LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? "High risk";
  const factorLabel =
    FACTOR_OPTIONS.find((o) => o.value === factor)?.label ?? "All reasons";
  const outcomeLabel =
    FOLLOW_UP_OPTIONS.find((o) => o.value === outcome)?.label ??
    "Show everything";

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search student…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search at-risk students"
        />
      </div>

      <CompactFilter
        buttonLabel={levelLabel}
        active={level !== "High"}
        ariaLabel={`Filter by risk level, currently showing: ${levelLabel}`}
        options={LEVEL_OPTIONS}
        value={level}
        onChange={(v) => onLevelChange(v as RiskLevelFilter)}
      />
      <CompactFilter
        buttonLabel={factorLabel}
        active={factor !== ""}
        ariaLabel={`Filter by reason, currently showing: ${factorLabel}`}
        options={FACTOR_OPTIONS}
        value={factor}
        onChange={(v) => onFactorChange(v as FactorFilter)}
      />
      <CompactFilter
        buttonLabel={outcomeLabel}
        active={outcome !== "all"}
        ariaLabel={`Filter by follow-up status, currently showing: ${outcomeLabel}`}
        options={FOLLOW_UP_OPTIONS}
        value={outcome}
        onChange={(v) => onOutcomeChange(v as FollowUpStatusFilter)}
      />

      <Button
        type="button"
        size="sm"
        variant={mineOnly ? "default" : "outline"}
        onClick={() => onMineOnlyChange(!mineOnly)}
        aria-pressed={mineOnly}
      >
        Only mine
      </Button>

      {hasActiveFilters && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={styles.clearBtn}
          onClick={() => {
            onQueryChange("");
            onLevelChange("High");
            onFactorChange("");
            onOutcomeChange("all");
            onMineOnlyChange(false);
          }}
        >
          <X aria-hidden />
          Show all
        </Button>
      )}
    </div>
  );
}
