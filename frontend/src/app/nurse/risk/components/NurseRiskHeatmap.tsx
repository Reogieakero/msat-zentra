"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import type { SectionMatrixRow } from "./nurse-risk-data";
import styles from "./NurseRiskHeatmap.module.css";

/**
 * Section × category matrix over the clinic desk — status-only case counts,
 * no identities. Darker cells mean more cases from that section in that
 * category. Mirrors the principal board's intensity buckets so the two
 * views agree on what "dark" means.
 */
function cellColor(count: number): string {
  if (count <= 0) return "var(--hm-0)";
  if (count <= 3) return "var(--hm-1)";
  if (count <= 7) return "var(--hm-2)";
  if (count <= 11) return "var(--hm-3)";
  return "var(--hm-4)";
}

const SCALE = ["var(--hm-0)", "var(--hm-1)", "var(--hm-2)", "var(--hm-3)", "var(--hm-4)"];

export function NurseRiskHeatmap({
  categories,
  matrix,
  colTotals,
  total,
  interpretation,
}: {
  categories: string[];
  matrix: SectionMatrixRow[];
  colTotals: number[];
  total: number;
  interpretation: string;
}) {
  return (
    <Card className={styles.panel}>
      <h2 className={styles.panelTitle}>Section × category heatmap</h2>
      <p className={styles.panelDesc}>
        {matrix.length === 0
          ? "No sections on the clinic desk yet."
          : `${total} ${total === 1 ? "case" : "cases"} across ${matrix.length} ${matrix.length === 1 ? "section" : "sections"}. Darker = more cases.`}
      </p>
      {matrix.length > 0 && (
        <TooltipProvider>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.rowHead}>
                    Section
                  </th>
                  {categories.map((c, i) => (
                    <th key={c} scope="col" className={styles.colHead}>
                      <span>{c}</span>
                      <span className={styles.colTotal}>{colTotals[i] ?? 0}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.section}>
                    <th scope="row" className={styles.rowHead}>
                      {row.section}
                    </th>
                    {row.counts.map((count, i) => (
                      <td key={categories[i]} className={styles.cell}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={styles.cellBox}
                              style={{ background: cellColor(count) }}
                              role="img"
                              aria-label={`${row.section} ${categories[i]}: ${count} cases`}
                            >
                              {count > 0 ? count : ""}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span className={styles.tip}>
                              {row.section} · {categories[i]}
                            </span>
                            <span className={styles.tipSub}>
                              {count} {count === 1 ? "case" : "cases"}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      )}
      <div className={styles.footerRow}>
        <div className={styles.legend} aria-hidden="true">
          <span className={styles.legendLabel}>0</span>
          <span className={styles.legendSwatches}>
            {SCALE.map((c, i) => (
              <span key={i} className={styles.legendSwatch} style={{ background: c }} />
            ))}
          </span>
          <span className={styles.legendLabel}>high</span>
        </div>
      </div>
      <p className={styles.interpretation}>
        <span className={styles.interpretationLabel}>What it means · </span>
        {interpretation}
      </p>
    </Card>
  );
}
