"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import styles from "./coordinator-certifications-filters.module.css";

interface CoordinatorCertificationsFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
}

/**
 * In-board search for the certifications board — same shape as the referrals
 * desk search (16px radius, 2rem tall), rendered inside the board header
 * actions. Status filtering lives in the centered pill tabs.
 */
export function CoordinatorCertificationsFilters({
  query,
  onQueryChange,
}: CoordinatorCertificationsFiltersProps) {
  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          style={{
            height: "2rem",
            paddingLeft: "2rem",
            borderRadius: "16px",
          }}
          placeholder="Search student, LRN, or grade…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search certifications"
        />
      </div>
    </div>
  );
}
