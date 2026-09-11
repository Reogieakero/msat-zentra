"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_ANECDOTALS } from "../../_mock";
import styles from "../../pages.module.css";

export default function GuidanceBehavioralPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights · Behavioral</p>
          <h1 className={styles.title}>Behavioral records</h1>
          <p className={styles.lede}>
            Mock-up only — category flags and counts that feed the behavioral
            risk flag (≥ 1 report). Students and parents later see the level +
            category only, never the write-up.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Behavioral signal feed
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Static rows — category + tier, no clinical text.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className={styles.list}>
            {MOCK_ANECDOTALS.map((row) => (
              <li key={row.id} className={styles.listItem}>
                <span className={styles.dot} aria-hidden />
                <div>
                  <p className={styles.sectionTitle}>
                    {row.student} · {row.category}
                  </p>
                  <p className={styles.sectionDesc}>
                    <span className={styles.mono}>{row.id}</span> · observed by{" "}
                    {row.observer} · {row.date} · {row.confidentiality}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.actions} style={{ marginTop: "0.75rem" }}>
            <Button size="sm" variant="outline" disabled>
              Open risk trend
            </Button>
            <Button size="sm" variant="outline" disabled>
              View gradebooks (view-only)
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className={styles.note}>
        Guidance sees owning + referred rows; Principal stays status-only;
        gradebook access here is explicitly view-only.
      </p>
    </section>
  );
}
