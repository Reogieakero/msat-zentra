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
import type { GuidanceAnecdotalCategory } from "./guidance-anecdotal-data";
import styles from "./guidance-anecdotal-filters.module.css";

export type CategoryFilter = "" | GuidanceAnecdotalCategory;

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "behavioral", label: "Behavioral" },
  { value: "bullying", label: "Bullying" },
  { value: "academic", label: "Academic" },
  { value: "attendance", label: "Attendance" },
  { value: "health", label: "Health" },
];

interface GuidanceAnecdotalFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
}

export function GuidanceAnecdotalFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
}: GuidanceAnecdotalFiltersProps) {
  const hasActiveFilters = category !== "";
  const categoryLabel =
    CATEGORIES.find((c) => c.value === category)?.label ?? "Category";

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search student, LRN, observer…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search anecdotal records"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`${styles.filterBtn} ${category !== "" ? styles.filterActive : ""}`}
          >
            {category === "" ? "Category" : categoryLabel}
            {category !== "" && <span className={styles.filterDot} aria-hidden />}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          {CATEGORIES.map((item, index) => (
            <div key={item.label}>
              {index === 1 && <DropdownMenuSeparator />}
              <DropdownMenuCheckboxItem
                checked={category === item.value}
                onCheckedChange={() => onCategoryChange(item.value)}
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
          onClick={() => onCategoryChange("")}
        >
          <X aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
