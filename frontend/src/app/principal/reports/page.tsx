"use client";

import * as React from "react";

import { PANEL_ROWS, type ReportsPayload, type ReportScope } from "./reports-data";
import { apiClient } from "@/lib/api/client";
import { ReportsToolbar } from "./components/ReportsToolbar";
import { ReportsKpis } from "./components/ReportsKpis";
import { ReportPanel } from "./components/ReportsPanels";
import styles from "./page.module.css";

export default function PrincipalReportsPage() {
  const scope: ReportScope = "school";
  const [data, setData] = React.useState<ReportsPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    apiClient
      .get<ReportsPayload>("/api/reports", { params: { scope } })
      .then((res) => setData(res.data))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(status ? `Failed to load reports (HTTP ${status})` : "Failed to load reports");
        console.error("[/api/reports] fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, [scope]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    load();
  };

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Reports &amp; Analytics Command Center</h1>
          <p className={styles.subtitle}>
            Every transaction and data stream across the school, visualized.
          </p>
        </div>
        <ReportsToolbar onRefresh={handleRefresh} loading={loading} />
      </div>

      {error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <>
          <ReportsKpis loading={loading} data={data?.kpis ?? null} />

          <div className={styles.rows}>
            {PANEL_ROWS.map((row, ri) => (
              <div className={styles.row} key={ri}>
                {row.map((panel) => (
                  <div
                    key={panel.id}
                    className={`${styles.frame} ${panel.cols === 2 ? styles.cols2 : panel.cols === 3 ? styles.cols3 : styles.cols1}`}
                  >
                    {data ? (
                      <ReportPanel panel={panel} data={data} />
                    ) : (
                      <div className={styles.panelSkeleton} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
