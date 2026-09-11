"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuidanceGradeAttentionRow } from "./guidance-overview-data";
import styles from "./guidance-overview-grade-table.module.css";

interface GuidanceOverviewGradeTableProps {
  rows: GuidanceGradeAttentionRow[];
}

export function GuidanceOverviewGradeTable({ rows }: GuidanceOverviewGradeTableProps) {
  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>Grade levels needing attention</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Live ranking — most at-risk students per grade this term.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Grade</th>
                <th>Sections</th>
                <th>At-risk</th>
                <th>Highest section</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.short}>
                  <td className={styles.mono}>{row.short}</td>
                  <td>{row.sections}</td>
                  <td>{row.atRisk}</td>
                  <td>
                    {row.topSection === "—"
                      ? "—"
                      : `${row.topSection} · ${row.topCount} student${row.topCount === 1 ? "" : "s"}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
