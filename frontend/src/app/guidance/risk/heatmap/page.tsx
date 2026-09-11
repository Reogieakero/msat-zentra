"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_HEATMAP } from "../../_mock";
import styles from "../../pages.module.css";

export default function GuidanceHeatmapPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights · Risk heatmap</p>
          <h1 className={styles.title}>Attendance × academic heatmap</h1>
          <p className={styles.lede}>
            Mock-up only — full heatmap grid placeholder. Cells aggregate
            counts; no confidential text is shown at this grain.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Section × risk factor
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Static grid — High / Moderate / Low per section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>High</th>
                  <th>Moderate</th>
                  <th>Low</th>
                  <th>Needs attention</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_HEATMAP.map((row) => (
                  <tr key={row.section}>
                    <td className={styles.mono}>{row.section}</td>
                    <td>{row.high}</td>
                    <td>{row.moderate}</td>
                    <td>{row.low}</td>
                    <td>{row.high + row.moderate} students</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className={styles.note}>
        Future wiring: term-scoped heatmap endpoint with grade / section
        filters; snapshot cache for heavy aggregates.
      </p>
    </section>
  );
}
