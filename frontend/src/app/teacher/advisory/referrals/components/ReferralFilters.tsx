"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./ReferralFilters.module.css";

interface ReferralFiltersProps {
  query: string;
  onQueryChange: (next: string) => void;
}

export function ReferralFilters({ query, onQueryChange }: ReferralFiltersProps) {
  const hasActive = query.trim() !== "";

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search student or LRN…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search referrals"
        />
      </div>
      {hasActive && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onQueryChange("")}
        >
          <X aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
