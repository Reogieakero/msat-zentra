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
import { MOCK_REFERRALS } from "../_mock";
import styles from "../pages.module.css";

export default function GuidanceReferralsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Cases · Referred to me</p>
          <h1 className={styles.title}>Referrals to guidance</h1>
          <p className={styles.lede}>
            Mock-up only — every behavior / incident report routed to the
            Guidance Counselor (including LRP scope). Actions below are
            placeholders.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Referral queue</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            8 open in sidebar badge · showing 4 mock rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Referred by</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_REFERRALS.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.id}</td>
                    <td>{row.student}</td>
                    <td>{row.from}</td>
                    <td>{row.reason}</td>
                    <td>
                      <Badge
                        variant={
                          row.status === "Pending" ? "warning" : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td>{row.date}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button size="xs" variant="outline" disabled>
                          Open
                        </Button>
                        <Button size="xs" variant="outline" disabled>
                          Accept
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
        Future actions: open case file, accept / return, refer to Nurse / ADM
        Coordinator / Principal, and log parent-meeting attendance.
      </p>
    </section>
  );
}
