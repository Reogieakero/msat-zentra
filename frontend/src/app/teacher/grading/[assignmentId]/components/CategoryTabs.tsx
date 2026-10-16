"use client";

import {
  COMPONENT_LABELS,
  COMPONENT_NAMES,
  COMPONENT_ORDER,
} from "@/services/teacher/grading.compute";
import type { ComponentType } from "@/services/teacher/grading.types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./CategoryTabs.module.css";

type Props = {
  value: ComponentType;
  onChange: (tab: ComponentType) => void;
};

export function CategoryTabs({ value, onChange }: Props) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Assessment category">
      {COMPONENT_ORDER.map((t) => {
        return (
          <Tooltip key={t}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={value === t}
                aria-label={COMPONENT_NAMES[t]}
                className={`${styles.tab} ${value === t ? styles.tabActive : ""}`}
                onClick={() => onChange(t)}
              >
                {COMPONENT_LABELS[t]}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{COMPONENT_NAMES[t]}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
