"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALL_GRADES } from "./types";
import styles from "./academics.module.css";

function gradeDisplay(value: string): string {
  return value === ALL_GRADES ? "All grades" : value;
}

export function AcademicsHeader({
  grades,
  gradeFilter,
  onGradeFilterChange,
  dataUpdatedAt,
}: {
  grades: string[];
  gradeFilter: string;
  onGradeFilterChange: (grade: string) => void;
  dataUpdatedAt: number;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <h1 className={styles.title}>Academic Heatmap</h1>
        <p className={styles.subtitle}>
          Live subject averages across sections. The trend line moves as
          teachers save scores — no manual refresh, no finalized-only view.
        </p>
      </div>
      <div className={styles.headerSide}>
        <span className={styles.toolbarLabel}>Grade</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={styles.toolbarBtn}>
              {gradeDisplay(gradeFilter)}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onGradeFilterChange(ALL_GRADES)}>
              {gradeFilter === ALL_GRADES ? (
                <Check aria-hidden />
              ) : (
                <span className={styles.checkSpacer} aria-hidden />
              )}
              <span>All grades</span>
            </DropdownMenuItem>
            {grades.map((g) => (
              <DropdownMenuItem key={g} onSelect={() => onGradeFilterChange(g)}>
                {gradeFilter === g ? (
                  <Check aria-hidden />
                ) : (
                  <span className={styles.checkSpacer} aria-hidden />
                )}
                <span>{g}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {dataUpdatedAt > 0 ? (
          <span className={styles.updatedHint}>
            Updated{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
