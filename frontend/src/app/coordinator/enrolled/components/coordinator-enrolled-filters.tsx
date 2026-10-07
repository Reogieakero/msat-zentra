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
import type { AdmEligibility } from "@/services/coordinator/coordinator.types";
import { ELIG_OPTIONS } from "./coordinator-enrolled-constants";
import styles from "./coordinator-enrolled-filters.module.css";

interface CoordinatorEnrolledFiltersProps {
  total: number;
  query: string;
  onQueryChange: (v: string) => void;
  elig: "all" | AdmEligibility;
  onEligChange: (v: "all" | AdmEligibility) => void;
  eligMenuLabel: string;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function CoordinatorEnrolledFilters({
  total,
  query,
  onQueryChange,
  elig,
  onEligChange,
  eligMenuLabel,
  hasActiveFilters,
  onClear,
}: CoordinatorEnrolledFiltersProps) {
  return (
    <div className={styles.panelHead}>
      <div>
        <h2 className={styles.sectionTitle}>Enrolled Students</h2>
        <p className={styles.sectionDesc}>
          Learners approved into Alternative Delivery Mode — {total} case
          {total === 1 ? "" : "s"} signed by the Principal.
        </p>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.searchWrap}>
          <Search className={styles.searchIcon} aria-hidden />
          <Input
            style={{ height: "2rem", paddingLeft: "2rem" }}
            placeholder="Search name, LRN, or case ID…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Search enrolled students"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              style={{ height: "2rem" }}
              aria-label={`Filter by status, currently: ${eligMenuLabel}`}
            >
              {elig === "all" ? "Status" : eligMenuLabel}
              {elig !== "all" && (
                <span className={styles.filterDot} aria-hidden />
              )}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ELIG_OPTIONS.map((item) => (
              <DropdownMenuCheckboxItem
                key={item.value}
                checked={elig === item.value}
                onCheckedChange={() => onEligChange(item.value)}
              >
                {item.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X aria-hidden />
            Show all
          </Button>
        )}
      </div>
    </div>
  );
}
