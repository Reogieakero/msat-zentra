"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CERT_STATUS_META,
  type CertStatus,
  type CertSummary,
} from "./coordinator-certifications-data";
import styles from "./coordinator-certifications-charts.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const ORDER: CertStatus[] = ["prepared", "awaiting", "revision", "approved"];

function interpretSummary(summary: CertSummary): string {
  if (summary.total === 0) {
    return "No certifications on file yet — recommendations you prepare will break down here by status.";
  }
  if (summary.awaiting > 0) {
    return `${summary.total} certification${summary.total === 1 ? "" : "s"} — ${summary.awaiting} locked awaiting the Principal's signature. Only the Principal can sign.`;
  }
  if (summary.prepared > 0) {
    return `${summary.total} certification${summary.total === 1 ? "" : "s"} — ${summary.prepared} prepared and ready for you to endorse to the Principal.`;
  }
  if (summary.revision > 0) {
    return `${summary.total} certification${summary.total === 1 ? "" : "s"} — ${summary.revision} need${summary.revision === 1 ? "s" : ""} revision before they can move forward.`;
  }
  return `${summary.total} certification${summary.total === 1 ? "" : "s"} — all signed by the Principal. Monitoring continues on the Enrolled page.`;
}

export function CoordinatorCertificationsCharts({ summary }: { summary: CertSummary }) {
  const rows = ORDER.map((status) => ({
    status,
    label: CERT_STATUS_META[status].label,
    count: summary[status],
  }));

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>Certifications by status</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Every certification you issued — live counts.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.body}>
        {summary.total === 0 ? (
          <div className={styles.emptyWrap}>
            <p className={styles.empty}>No certifications on file yet.</p>
          </div>
        ) : (
          <div className={styles.split}>
            <div className={styles.donutWrap}>
              <ResponsiveContainer width="100%" height={168}>
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {rows.map((r) => (
                      <Cell key={r.status} fill={CERT_STATUS_META[r.status].color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutCenter}>
                <span className={styles.donutValue}>{summary.total}</span>
                <span className={styles.donutCaption}>certifications</span>
              </div>
            </div>
            <ul className={styles.legend}>
              {rows.map((r) => (
                <li key={r.status} className={styles.legendItem}>
                  <span className={styles.legendLabel}>
                    <span
                      className={styles.legendDot}
                      style={{ backgroundColor: CERT_STATUS_META[r.status].color }}
                      aria-hidden
                    />
                    {r.label}
                  </span>
                  <span className={styles.legendCount}>{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.total > 0 ? (
          <p className={styles.interpretation}>{interpretSummary(summary)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
