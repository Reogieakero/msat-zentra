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
import { MOCK_ANECDOTALS } from "../_mock";
import styles from "../pages.module.css";

export default function GuidanceAnecdotalPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Records · Confidentiality-aware</p>
          <h1 className={styles.title}>Anecdotal records</h1>
          <p className={styles.lede}>
            Mock-up only — behavior, academic, and emotional write-ups visible
            to guidance under confidentiality rules. Full text stays hidden here
            until the real permission layer lands.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <div className={styles.actions}>
        <Button size="sm" disabled>
          New write-up
        </Button>
        <Button size="sm" variant="outline" disabled>
          Filter by category
        </Button>
        <Button size="sm" variant="outline" disabled>
          Filter by confidentiality
        </Button>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            All referred behavior / incident reports
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Static rows — observer, category, and tier only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Category</th>
                  <th>Observer</th>
                  <th>Date</th>
                  <th>Tier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ANECDOTALS.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.id}</td>
                    <td>{row.student}</td>
                    <td>
                      <Badge variant="secondary">{row.category}</Badge>
                    </td>
                    <td>{row.observer}</td>
                    <td>{row.date}</td>
                    <td>{row.confidentiality}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button size="xs" variant="outline" disabled>
                          View
                        </Button>
                        <Button size="xs" variant="outline" disabled>
                          Follow-up
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className={styles.note}>
        Future wiring: list + create + follow-ups under confidentiality RLS;
        notes / reviews from past cases attach to each record timeline.
      </p>
    </section>
  );
}
