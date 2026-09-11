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
import { MOCK_ALERTS } from "../_mock";
import styles from "../pages.module.css";

export default function GuidanceAlertsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Queue · System-flagged</p>
          <h1 className={styles.title}>Alerts</h1>
          <p className={styles.lede}>
            Mock-up only — students the rule engine flagged (academic &lt; 75,
            attendance &lt; 80%, ≥ 1 anecdotal). Acknowledge or convert to an
            intervention later.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Flag queue
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Static rows — newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Trigger</th>
                  <th>Level</th>
                  <th>Flagged</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ALERTS.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.id}</td>
                    <td>{row.student}</td>
                    <td>{row.reason}</td>
                    <td>
                      <Badge
                        variant={
                          row.level === "High"
                            ? "default"
                            : row.level === "Moderate"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {row.level}
                      </Badge>
                    </td>
                    <td>{row.time}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button size="xs" variant="outline" disabled>
                          Acknowledge
                        </Button>
                        <Button size="xs" variant="outline" disabled>
                          Create intervention
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
        Future wiring: live risk recompute feed; acknowledged flags write audit
        + notification to the adviser.
      </p>
    </section>
  );
}
