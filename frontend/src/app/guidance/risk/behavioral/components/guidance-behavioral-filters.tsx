"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  GuidanceAnecdotalCategory,
  GuidanceAnecdotalSummary,
} from "../../../anecdotal/components/guidance-anecdotal-data";
import styles from "./guidance-behavioral-filters.module.css";

export type BehavioralCategoryFilter = "all" | GuidanceAnecdotalCategory;

interface GuidanceBehavioralFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: BehavioralCategoryFilter;
  onCategoryChange: (value: BehavioralCategoryFilter) => void;
  summary: GuidanceAnecdotalSummary;
}

const CATEGORIES: GuidanceAnecdotalCategory[] = [
  "behavioral",
  "bullying",
  "academic",
  "attendance",
  "health",
];

function label(value: BehavioralCategoryFilter): string {
  if (value === "all") return "All categories";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Search + category dropdown — same DropdownMenu filter language as the
 * interventions and alerts pages (no Select component).
 */
export function GuidanceBehavioralFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  summary,
}: GuidanceBehavioralFiltersProps) {
  const hasActiveFilters = query.trim() !== "" || category !== "all";
  const buttonLabel = category === "all" ? "Category" : label(category);

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search student, LRN, section, observer…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search behavioral records"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Filter by category, currently showing: ${label(category)}`}
            className={`${styles.filterBtn} ${category !== "all" ? styles.filterActive : ""}`}
          >
            {buttonLabel}
            {category !== "all" && <span className={styles.filterDot} aria-hidden />}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          <DropdownMenuRadioGroup
            value={category}
            onValueChange={(v) => onCategoryChange(v as BehavioralCategoryFilter)}
          >
            <DropdownMenuRadioItem value="all">
              All categories ({summary.total})
            </DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {CATEGORIES.map((c) => (
              <DropdownMenuRadioItem key={c} value={c}>
                {label(c)} ({summary[c]})
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.clearBtn}
          onClick={() => {
            onQueryChange("");
            onCategoryChange("all");
          }}
        >
          <X aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
