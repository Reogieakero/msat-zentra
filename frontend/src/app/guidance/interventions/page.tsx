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
import { MOCK_INTERVENTIONS } from "../_mock";
import styles from "../pages.module.css";

export default function GuidanceInterventionsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Actions · Outcomes</p>
          <h1 className={styles.title}>Interventions</h1>
          <p className={styles.lede}>
            Mock-up only — review, approve, reject, or modify recommendations,
            then record actions and track outcomes. Past notes and reviews
            collapse into each row later.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Recommendation review queue
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Static rows — approval state and outcome tracked per student.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Recommended action</th>
                  <th>Review</th>
                  <th>Outcome</th>
                  <th>Updated</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_INTERVENTIONS.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.id}</td>
                    <td>{row.student}</td>
                    <td>{row.action}</td>
                    <td>
                      <Badge
                        variant={
                          row.status === "Approved" ? "success" : "warning"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td>{row.outcome}</td>
                    <td>{row.updated}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button size="xs" variant="outline" disabled>
                          Approve
                        </Button>
                        <Button size="xs" variant="outline" disabled>
                          Modify
                        </Button>
                        <Button size="xs" variant="outline" disabled>
                          Reject
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
        Future wiring: approve / reject / modify writes audit + notification;
        outcome recorder (ongoing / resolved / unresolved) with notes.
      </p>
    </section>
  );
}
