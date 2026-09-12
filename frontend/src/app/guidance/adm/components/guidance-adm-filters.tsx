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
import type { GuidanceAdmStageFilter } from "./guidance-adm-data";
import styles from "./guidance-adm-filters.module.css";

export const ADM_STAGE_OPTIONS: { value: GuidanceAdmStageFilter; label: string }[] = [
  { value: "", label: "All stages" },
  { value: "consultation", label: "Consultation & referral" },
  { value: "meeting_parents", label: "Meeting with parents" },
  { value: "home_visitation", label: "Home visitation" },
  { value: "certification", label: "Recommendation & certification" },
  { value: "principal_approval", label: "Principal approval" },
  { value: "enrollment_monitoring", label: "Enrollment monitoring" },
  { value: "completion", label: "Completed" },
];

interface GuidanceAdmFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  stage: GuidanceAdmStageFilter;
  onStageChange: (value: GuidanceAdmStageFilter) => void;
}

export function GuidanceAdmFilters({
  query,
  onQueryChange,
  stage,
  onStageChange,
}: GuidanceAdmFiltersProps) {
  const hasActiveFilters = query.trim() !== "" || stage !== "";
  const stageLabel =
    ADM_STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? "All stages";

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search student, LRN, or reason…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search ADM hand-offs"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Filter by ADM stage, currently showing: ${stageLabel}`}
            className={`${styles.filterBtn} ${stage !== "" ? styles.filterActive : ""}`}
          >
            {stageLabel}
            {stage !== "" && <span className={styles.filterDot} aria-hidden />}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          {ADM_STAGE_OPTIONS.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.label}
              checked={stage === item.value}
              onCheckedChange={() => onStageChange(item.value)}
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className={styles.clearBtn}
          onClick={() => {
            onQueryChange("");
            onStageChange("");
          }}
        >
          <X aria-hidden />
          Show all
        </Button>
      )}
    </div>
  );
}
