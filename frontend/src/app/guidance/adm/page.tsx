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
import { MOCK_ADM } from "../_mock";
import styles from "../pages.module.css";

export default function GuidanceAdmPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Hand-off · ADM Coordinator</p>
          <h1 className={styles.title}>ADM referrals</h1>
          <p className={styles.lede}>
            Mock-up only — students recommended for Alternative Delivery Mode,
            flagged parent-meeting attendance, and hand-off state to the ADM
            Coordinator.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <div className={styles.actions}>
        <Button size="sm" disabled>
          Refer student to ADM
        </Button>
        <Button size="sm" variant="outline" disabled>
          Refer to Nurse
        </Button>
        <Button size="sm" variant="outline" disabled>
          Escalate to Principal
        </Button>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            ADM pipeline (guidance view)
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Static rows — parent attendance flag drives next step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Stage</th>
                  <th>Parent meeting</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ADM.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.id}</td>
                    <td>{row.student}</td>
                    <td>{row.stage}</td>
                    <td>{row.parentAttended}</td>
                    <td>
                      <Badge variant="secondary">{row.status}</Badge>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Button size="xs" variant="outline" disabled>
                          Mark attended
                        </Button>
                        <Button size="xs" variant="outline" disabled>
                          Hand off
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
        Future wiring: create ADM hand-off from a referral, toggle parent
        attendance with minutes + logbook ref, forward to coordinator.
      </p>
    </section>
  );
}
