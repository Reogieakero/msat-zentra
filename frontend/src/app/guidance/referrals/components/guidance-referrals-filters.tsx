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
import type { GuidanceReferralStatus } from "./guidance-referrals-data";
import styles from "./guidance-referrals-filters.module.css";

export type StatusFilter = "" | GuidanceReferralStatus;

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All cases" },
  { value: "pending", label: "Needs action" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

interface GuidanceReferralsFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
}

export function GuidanceReferralsFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
}: GuidanceReferralsFiltersProps) {
  const hasActiveFilters = status !== "";
  const statusLabel =
    STATUSES.find((s) => s.value === status)?.label ?? "All cases";

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search by student name or keyword…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search your cases"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Filter cases by status, currently showing: ${statusLabel}`}
            className={`${styles.filterBtn} ${status !== "" ? styles.filterActive : ""}`}
          >
            {statusLabel}
            {status !== "" && <span className={styles.filterDot} aria-hidden />}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          {STATUSES.map((item, index) => (
            <div key={item.label}>
              {index === 1 && <DropdownMenuSeparator />}
              <DropdownMenuCheckboxItem
                checked={status === item.value}
                onCheckedChange={() => onStatusChange(item.value)}
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
          onClick={() => onStatusChange("")}
        >
          <X aria-hidden />
          Show all
        </Button>
      )}
    </div>
  );
}
