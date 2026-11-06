"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CERT_STATUS_META } from "@/services/coordinator/certifications.service";
import type {
  CertStatus,
  CertSummary,
} from "@/services/coordinator/certifications.types";
import { AMBER_RAMP } from "../../overview/components/coordinator-overview-helpers";
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

export function CoordinatorCertificationsCharts({
  summary,
  bare = false,
}: {
  summary: CertSummary;
  /** Render only the chart body — the rail flyout already supplies the title. */
  bare?: boolean;
}) {
  const rows = ORDER.map((status, i) => ({
    status,
    label: CERT_STATUS_META[status].label,
    count: summary[status],
    color: AMBER_RAMP[i % AMBER_RAMP.length],
  }));

  return (
    <div
      className={styles.block}
      aria-label={bare ? "Certifications by status" : undefined}
    >
      {bare ? null : (
        <div>
          <h3 className={styles.sectionTitle}>Certifications by status</h3>
          <p className={styles.sectionDesc}>
            Every certification you issued — live counts.
          </p>
        </div>
      )}
      <div className={styles.body}>
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
                      <Cell key={r.status} fill={r.color} />
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
                      style={{ backgroundColor: r.color }}
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
      </div>
    </div>
  );
}
