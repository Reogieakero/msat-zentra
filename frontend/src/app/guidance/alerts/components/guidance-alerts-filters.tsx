"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  GuidanceAlertFactor,
  GuidanceAlertLevel,
} from "./guidance-alerts-data";
import styles from "./guidance-alerts-filters.module.css";

export type LevelFilter = "" | GuidanceAlertLevel;
export type FactorFilter = "" | GuidanceAlertFactor;

const LEVELS: { value: LevelFilter; label: string }[] = [
  { value: "", label: "All levels" },
  { value: "High", label: "High" },
  { value: "Moderate", label: "Moderate" },
];

const FACTORS: { value: FactorFilter; label: string }[] = [
  { value: "", label: "All factors" },
  { value: "academic", label: "Academic" },
  { value: "attendance", label: "Attendance" },
  { value: "behavioral", label: "Behavioral" },
];

interface GuidanceAlertsFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  level: LevelFilter;
  onLevelChange: (value: LevelFilter) => void;
  factor: FactorFilter;
  onFactorChange: (value: FactorFilter) => void;
}

export function GuidanceAlertsFilters({
  query,
  onQueryChange,
  level,
  onLevelChange,
  factor,
  onFactorChange,
}: GuidanceAlertsFiltersProps) {
  const hasActiveFilters = level !== "" || factor !== "";
  const levelLabel = LEVELS.find((l) => l.value === level)?.label ?? "Level";
  const factorLabel = FACTORS.find((f) => f.value === factor)?.label ?? "Factor";

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search name, LRN, or section…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search flagged students"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`${styles.filterBtn} ${level !== "" ? styles.filterActive : ""}`}
          >
            {level === "" ? "Level" : levelLabel}
            {level !== "" && <span className={styles.filterDot} aria-hidden />}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          {LEVELS.map((item, index) => (
            <div key={item.label}>
              {index === 1 && <DropdownMenuSeparator />}
              <DropdownMenuCheckboxItem
                checked={level === item.value}
                onCheckedChange={() => onLevelChange(item.value)}
              >
                {item.label}
              </DropdownMenuCheckboxItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`${styles.filterBtn} ${factor !== "" ? styles.filterActive : ""}`}
          >
            {factor === "" ? "Factor" : factorLabel}
            {factor !== "" && <span className={styles.filterDot} aria-hidden />}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          {FACTORS.map((item, index) => (
            <div key={item.label}>
              {index === 1 && <DropdownMenuSeparator />}
              <DropdownMenuCheckboxItem
                checked={factor === item.value}
                onCheckedChange={() => onFactorChange(item.value)}
              >
                {item.label}
              </DropdownMenuCheckboxItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className={styles.clearBtn}
          onClick={() => {
            onLevelChange("");
            onFactorChange("");
          }}
        >
          <X aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
