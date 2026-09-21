"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GuidanceGradeAttentionRow } from "./guidance-overview-data";
import styles from "./guidance-overview-grade-table.module.css";

interface GuidanceOverviewGradeTableProps {
  rows: GuidanceGradeAttentionRow[];
}

function buildInterpretation(rows: GuidanceGradeAttentionRow[]): string {
  const totalAtRisk = rows.reduce((n, row) => n + row.atRisk, 0);
  const totalHigh = rows.reduce((n, row) => n + row.high, 0);

  if (totalAtRisk === 0) {
    return "No students are currently flagged as at-risk in any grade level this term.";
  }

  const top = [...rows].sort((a, b) => b.atRisk - a.atRisk)[0];
  const hotspot =
    top.topSection !== "—" && top.topCount > 0
      ? `, concentrated in ${top.topSection} with ${top.topCount} students`
      : "";

  return (
    `${totalAtRisk} are flagged at-risk, including ${totalHigh} high-risk. ` +
    `${top.grade} needs the most attention with ${top.atRisk} flagged students${hotspot}.`
  );
}

export function GuidanceOverviewGradeTable({ rows }: GuidanceOverviewGradeTableProps) {
  // Longest bar = the grade with the most at-risk students; every other
  // bar scales against it. Zero-height impact: the bar sits on the same
  // line as the count, inside the existing row padding.
  const maxAtRisk = Math.max(1, ...rows.map((row) => row.atRisk));
  return (
    <Card className={styles.card}>
      <CardHeader>
        <div className={styles.headerRow}>
          <div>
            <CardTitle className={styles.sectionTitle}>Grade levels needing attention</CardTitle>
            <CardDescription className={styles.sectionDesc}>
              Live ranking — most at-risk students per grade this term.
            </CardDescription>
          </div>
          <Button asChild size="xs" variant="outline" aria-label="See more in Interventions">
            <Link href="/guidance/interventions">See more</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
             <thead>
                <tr>
                  <th>Grade</th>
                  <th>High</th>
                  <th>At-risk</th>
                  <th>Highest section</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const barPct = (row.atRisk / maxAtRisk) * 100;
                  const highPct = row.atRisk > 0 ? (row.high / row.atRisk) * 100 : 0;
                  return (
                    <tr key={row.short}>
                      <td className={styles.mono}>{row.short}</td>
                      <td className={row.high > 0 ? styles.highRisk : undefined}>{row.high}</td>
                      <td>
                        <span className={styles.atRiskCell}>
                          <span className={styles.atRiskCount}>{row.atRisk}</span>
                          <span
                            className={styles.atRiskBar}
                            role="img"
                            aria-label={`${row.grade}: ${row.atRisk} at-risk, including ${row.high} high-risk`}
                            title={`${row.atRisk} at-risk · ${row.high} high-risk`}
                          >
                            <span className={styles.atRiskTrack} style={{ width: `${barPct}%` }}>
                              <span className={styles.atRiskHigh} style={{ width: `${highPct}%` }} />
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {row.topSection === "—"
                          ? "—"
                          : `${row.topSection} · ${row.topCount} student${row.topCount === 1 ? "" : "s"}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
          </table>
        </div>
        <p className={styles.interpretation}>{buildInterpretation(rows)}</p>
      </CardContent>
    </Card>
  );
}
