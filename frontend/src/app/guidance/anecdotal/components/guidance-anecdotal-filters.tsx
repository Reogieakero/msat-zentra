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
import styles from "./guidance-anecdotal-filters.module.css";

export type CategoryFilter = "";
export type TypeFilter = "" | "ADM" | "Counseling";

const TYPES: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ADM", label: "ADM cases" },
  { value: "Counseling", label: "Counseling cases" },
];

interface GuidanceAnecdotalFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
}

export function GuidanceAnecdotalFilters({
  query,
  onQueryChange,
  type,
  onTypeChange,
}: GuidanceAnecdotalFiltersProps) {
  const hasActiveFilters = type !== "";
  const typeLabel = TYPES.find((t) => t.value === type)?.label ?? "Type";

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
            className={`${styles.filterBtn} ${type !== "" ? styles.filterActive : ""}`}
          >
            {type === "" ? "Type" : typeLabel}
            {type !== "" && <span className={styles.filterDot} aria-hidden />}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          {TYPES.map((item, index) => (
            <div key={item.label}>
              {index === 1 && <DropdownMenuSeparator />}
              <DropdownMenuCheckboxItem
                checked={type === item.value}
                onCheckedChange={() => onTypeChange(item.value)}
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
            onTypeChange("");
          }}
        >
          <X aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
