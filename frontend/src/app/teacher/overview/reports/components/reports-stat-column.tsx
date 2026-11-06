"use client";

import type { ReactNode } from "react";
import { KanbanBoardHeader } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./reports.module.css";

/**
 * One column of a stat board: tinted column shell + KanbanBoardHeader + a
 * bordered value card (+ optional mascot chip and footer action). Mirrors the
 * coordinator / principal / registry overview stat boards so every desk's
 * numbers read the same.
 */
export function ReportsStatColumn({
  icon,
  title,
  value,
  hint,
  hintText,
  tooltip,
  valueTone,
  valueSize = "number",
  action,
  mascot,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  /** Rendered under the value — text or a row of shared pills. */
  hint: ReactNode;
  /** Plain-text version of `hint` for the column's aria-label. */
  hintText?: string;
  /** Hover text on the column icon — describes the metric, never the value. */
  tooltip?: string;
  valueTone?: "positive" | "warn" | "danger" | "muted";
  valueSize?: "number" | "text";
  action?: ReactNode;
  mascot?: ReactNode;
}) {
  const toneClass =
    valueTone === "positive"
      ? styles.valuePositive
      : valueTone === "warn"
        ? styles.valueWarn
        : valueTone === "danger"
          ? styles.valueDanger
          : valueTone === "muted"
            ? styles.valueMuted
            : "";

  return (
    <div
      className={styles.statColumn}
      aria-label={`${title}: ${value}${hintText ? `. ${hintText}` : ""}`}
    >
      <KanbanBoardHeader
        icon={
          tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={styles.statIcon} aria-hidden>
                  {icon}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className={styles.statIcon} aria-hidden>
              {icon}
            </span>
          )
        }
        title={title}
      />
      <div className={styles.statCard}>
        <span className={styles.statTop}>
          <span
            className={`${styles.statValue} ${valueSize === "text" ? styles.statValueText : ""} ${toneClass}`}
            title={value}
          >
            {value}
          </span>
          {mascot ? (
            <span className={styles.statMascot} aria-hidden="true">
              {mascot}
            </span>
          ) : null}
        </span>
        <span className={styles.statHint}>{hint}</span>
      </div>
      {action ? <div className={styles.statAction}>{action}</div> : null}
    </div>
  );
}
