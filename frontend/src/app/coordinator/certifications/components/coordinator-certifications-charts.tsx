"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  CERT_STATUS_META,
  type CertStatus,
  type CertSummary,
} from "./coordinator-certifications-data";
import { usePrimaryScale } from "@/components/risk-dashboard/use-primary-scale";
import { useCoordinatorProfileSettings } from "../../settings/components/profile-settings-data";
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
  // Donut slices wear the coordinator's own saved palette hex —
  // deterministic (no probe timing): darkest (pure primary) first,
  // stepping toward the card surface. Concrete rgb fills because SVG
  // attributes can't resolve CSS vars. Falls back to the runtime probe
  // only when no saved palette exists yet.
  const { data: profile } = useCoordinatorProfileSettings();
  const scale = usePrimaryScale(ORDER.length, profile?.primaryColor ?? null);
  const rows = ORDER.map((status, i) => ({
    status,
    label: CERT_STATUS_META[status].label,
    count: summary[status],
    color: scale[i % scale.length],
  }));

  return (
    /* Shell-less block — the page wraps the whole left panel in one
       shared glow card, so this renders title + content only. */
    <div className={styles.block} aria-label="Certifications by status">
      <div>
        <h3 className={styles.sectionTitle}>Certifications by status</h3>
        <p className={styles.sectionDesc}>
          Every certification you issued — live counts.
        </p>
      </div>
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
