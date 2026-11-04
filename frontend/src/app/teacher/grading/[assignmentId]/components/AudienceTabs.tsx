"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./CategoryTabs.module.css";

export type AssessmentAudience = "regular" | "adm";

const OPTIONS: { value: AssessmentAudience; label: string; hint: string }[] = [
  { value: "regular", label: "Regular", hint: "Assessments graded for regular learners" },
  { value: "adm", label: "ADM", hint: "Assessments graded for signed ADM learners" },
];

type Props = {
  value: AssessmentAudience;
  onChange: (audience: AssessmentAudience) => void;
};

/** Pill-shaped selector that filters the assessment list by grade input type. */
export function AudienceTabs({ value, onChange }: Props) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Assessment type">
      {OPTIONS.map((o) => (
        <Tooltip key={o.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="tab"
              aria-selected={value === o.value}
              aria-label={o.hint}
              className={`${styles.tab} ${value === o.value ? styles.tabActive : ""}`}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{o.hint}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
