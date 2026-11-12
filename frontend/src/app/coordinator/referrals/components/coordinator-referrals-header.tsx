"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import styles from "./coordinator-referrals-board.module.css";

/**
 * In-board filter controls for the referrals kanban board — search box.
 * Rendered inside the board header actions.
 */
export function CoordinatorReferralsFilters({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (v: string) => void;
}) {
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
          placeholder="Search name, LRN, or case ID…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search referrals"
        />
      </div>
    </div>
  );
}
