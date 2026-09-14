"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GuidanceRiskFactorRow } from "../../components/guidance-risk-data";
import styles from "./guidance-heatmap-visual.module.css";

const FACTORS = [
  { key: "academic", label: "Academic" },
  { key: "attendance", label: "Attendance" },
  { key: "behavioral", label: "Behavioral" },
] as const;

const LEVELS = [
  { key: "high", label: "High" },
  { key: "moderate", label: "Moderate" },
  { key: "low", label: "Low" },
] as const;

type FactorKey = (typeof FACTORS)[number]["key"];
type LevelKey = (typeof LEVELS)[number]["key"];

/**
 * Absolute intensity buckets — shared with the principal risk board so the
 * two views agree on what "dark" means. Status-only counts, no identities.
 */
function cellColor(count: number): string {
  if (count <= 0) return "var(--hm-0)";
  if (count <= 3) return "var(--hm-1)";
  if (count <= 7) return "var(--hm-2)";
  if (count <= 11) return "var(--hm-3)";
  return "var(--hm-4)";
}

const SCALE = ["var(--hm-0)", "var(--hm-1)", "var(--hm-2)", "var(--hm-3)", "var(--hm-4)"];

interface GuidanceHeatmapVisualProps {
  rows: GuidanceRiskFactorRow[];
  totals: {
    academic: number;
    attendance: number;
    behavioral: number;
    high: number;
    moderate: number;
    low: number;
  };
}

function MatrixLegend() {
  return (
    <div className={styles.legend} aria-hidden="true">
      <span className={styles.legendLabel}>0</span>
      <span className={styles.legendSwatches}>
        {SCALE.map((c, i) => (
          <span key={i} className={styles.legendSwatch} style={{ background: c }} />
        ))}
      </span>
      <span className={styles.legendLabel}>high</span>
    </div>
  );
}

export function GuidanceHeatmapVisual({ rows, totals }: GuidanceHeatmapVisualProps) {
  if (rows.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={styles.visual}>
        <div className={styles.matrixBlock}>
          <p className={styles.matrixTitle}>Flagged students by factor</p>
          <p className={styles.matrixSub}>
            At-risk students only — which signal trips per section.
          </p>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.rowHead}>
                    Section
                  </th>
                  {FACTORS.map((f) => (
                    <th key={f.key} scope="col" className={styles.colHead}>
                      <span>{f.label}</span>
                      <span className={styles.colTotal}>{totals[f.key as FactorKey]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.section}>
                    <th scope="row" className={styles.rowHead} title={`${row.section} · ${row.grade}`}>
                      {row.section}
                    </th>
                    {FACTORS.map((f) => {
                      const count = row[f.key as FactorKey];
                      return (
                        <td key={f.key} className={styles.cell}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={styles.cellBox}
                                style={{ background: cellColor(count) }}
                                role="img"
                                aria-label={`${row.section} ${f.label}: ${count} flagged students`}
                              >
                                {count > 0 ? count : ""}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className={styles.tip}>
                                {row.section} · {f.label}
                              </span>
                              <span className={styles.tipSub}>
                                {count} student{count === 1 ? "" : "s"}
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.matrixBlock}>
          <p className={styles.matrixTitle}>Full cohort by level</p>
          <p className={styles.matrixSub}>
            Every enrolled student per section — High (2+ flags), Moderate (1), Low (0).
          </p>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.rowHead}>
                    Section
                  </th>
                  {LEVELS.map((l) => (
                    <th key={l.key} scope="col" className={styles.colHead}>
                      <span>{l.label}</span>
                      <span className={styles.colTotal}>{totals[l.key as LevelKey]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.section}>
                    <th scope="row" className={styles.rowHead} title={`${row.section} · ${row.grade}`}>
                      {row.section}
                    </th>
                    {LEVELS.map((l) => {
                      const count = row[l.key as LevelKey];
                      return (
                        <td key={l.key} className={styles.cell}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={styles.cellBox}
                                style={{ background: cellColor(count) }}
                                role="img"
                                aria-label={`${row.section} ${l.label}: ${count} students`}
                              >
                                {count > 0 ? count : ""}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className={styles.tip}>
                                {row.section} · {l.label}
                              </span>
                              <span className={styles.tipSub}>
                                {count} student{count === 1 ? "" : "s"}
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.footerRow}>
          <MatrixLegend />
          <p className={styles.confidential}>Status-only view — detail lives in the at-risk queue.</p>
        </div>
      </div>
    </TooltipProvider>
  );
}
