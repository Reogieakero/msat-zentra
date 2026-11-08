"use client";

import { Grid3X3 } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GuidanceEmptyState } from "../../../components/GuidanceEmptyCard";
import type { InterventionInsightSectionRow } from "@/services/guidance/insights.types";
import { AMBER, BoardIcon } from "./insights-chart-shared";
import styles from "./insights.module.css";

const COLUMNS = [
  { key: "resolved", label: "Resolved" },
  { key: "ongoing", label: "Ongoing" },
  { key: "unresolved", label: "Unresolved" },
  { key: "total", label: "Total" },
] as const;

// Amber heat ramp — empty cells keep the neutral surface, filled cells step up
// through the same amber family as the other insights charts.
const SCALE = [
  "var(--hm-0)",
  `color-mix(in oklch, ${AMBER}, transparent 88%)`,
  `color-mix(in oklch, ${AMBER}, transparent 72%)`,
  `color-mix(in oklch, ${AMBER}, transparent 52%)`,
  `color-mix(in oklch, ${AMBER}, transparent 30%)`,
];

function cellColor(count: number, max: number): string {
  if (count <= 0) return SCALE[0];
  const ratio = count / Math.max(1, max);
  if (ratio <= 0.25) return SCALE[1];
  if (ratio <= 0.5) return SCALE[2];
  if (ratio <= 0.75) return SCALE[3];
  return SCALE[4];
}

/** Non-zero successes never round down to a misleading "0%". */
function formatRate(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return "0%";
  const value = (part / whole) * 100;
  if (value < 1) return "<1%";
  return `${Math.round(value)}%`;
}

export function InsightsHeatmap({
  rows,
  termLabel,
}: {
  rows: InterventionInsightSectionRow[];
  termLabel: string;
}) {
  const max = rows.reduce(
    (m, row) =>
      Math.max(m, row.resolved, row.ongoing, row.unresolved, row.total),
    1,
  );
  const totals = rows.reduce(
    (acc, row) => ({
      resolved: acc.resolved + row.resolved,
      ongoing: acc.ongoing + row.ongoing,
      unresolved: acc.unresolved + row.unresolved,
      total: acc.total + row.total,
    }),
    { resolved: 0, ongoing: 0, unresolved: 0, total: 0 },
  );

  return (
    <KanbanBoard
      title="Section × outcome heatmap"
      icon={<BoardIcon icon={Grid3X3} />}
      count={<span className={styles.heatRate}>{totals.total}</span>}
      description={`Where intervention cases cluster and how they closed — ${termLabel}. Darker amber cells mean more follow-ups.`}
      className={styles.boardIn}
    >
      {rows.length === 0 ? (
        <GuidanceEmptyState
          icon={Grid3X3}
          title="No sections with follow-ups yet"
          hint="Once intervention cases are opened for this term, section outcomes will be mapped here."
        />
      ) : (
        <TooltipProvider>
          <div className={styles.heatScroll}>
            <table className={styles.heatTable}>
              <thead>
                <tr>
                  <th scope="col" className={styles.heatRowHead}>
                    Section
                  </th>
                  {COLUMNS.map((column) => (
                    <th key={column.key} scope="col" className={styles.heatColHead}>
                      <span>{column.label}</span>
                      <span className="block text-[0.625rem] font-medium opacity-70 tabular-nums">
                        {totals[column.key]}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className={styles.heatColHead}>
                    <span>Success</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th
                      scope="row"
                      className={styles.heatRowHead}
                      title={`${row.section} · ${row.grade}`}
                    >
                      <span className={styles.heatSectionCell}>
                        <span className={styles.heatSectionAvatar} aria-hidden="true">
                          {row.section.slice(0, 2).toUpperCase()}
                        </span>
                        <span className={styles.heatSectionText}>
                          <span className={styles.heatSectionName}>{row.section}</span>
                          <span className={styles.heatSectionGrade}>{row.grade}</span>
                        </span>
                      </span>
                    </th>
                    {COLUMNS.map((column) => {
                      const count = row[column.key];
                      return (
                        <td key={column.key} className={styles.heatCell}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={styles.heatBox}
                                style={{ background: cellColor(count, max) }}
                                role="img"
                                aria-label={`${row.section} ${column.label}: ${count} follow-ups`}
                              >
                                {count > 0 ? count : ""}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className="block text-xs font-semibold">
                                {row.section} · {column.label}
                              </span>
                              <span className="block text-[0.6875rem] opacity-80">
                                {count} follow-up{count === 1 ? "" : "s"}
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                    <td className={styles.heatCell}>
                      <span className={`${styles.heatRate} tabular-nums`}>
                        {formatRate(row.resolved, row.total)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.heatFooter}>
            <div className={styles.heatLegend} aria-hidden="true">
              <span className={styles.heatLegendLabel}>0</span>
              <span className={styles.heatLegendSwatches}>
                {SCALE.map((color, index) => (
                  <span
                    key={index}
                    className={styles.heatLegendSwatch}
                    style={{ background: color }}
                  />
                ))}
              </span>
              <span className={styles.heatLegendLabel}>{max}</span>
            </div>
            <p className={styles.heatNote}>
              Success = resolved cases ÷ all cases opened for the section.
            </p>
          </div>
        </TooltipProvider>
      )}
    </KanbanBoard>
  );
}
