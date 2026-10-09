"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PANEL_ROWS, type ReportsPayload, type ReportScope } from "@/services/principal/reports";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { toast } from "@/components/ui/sonner";
import { ReportsToolbar } from "./components/ReportsToolbar";
import { ReportsKpis } from "./components/ReportsKpis";
import { ReportPanel } from "./components/ReportsPanels";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./page.module.css";

export default function PrincipalReportsPage() {
  const scope: ReportScope = "school";
  const queryClient = useQueryClient();
  const { activeTerm, termReady } = useTerm();
  const termId = activeTerm?.termId ?? null;

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["principal-reports", termId, scope],
    queryFn: async () =>
      (await apiClient.get<ReportsPayload>("/api/reports", { params: { scope } })).data,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  const loading = isPending || isFetching || !termReady;
  const errorMsg = isError
    ? (() => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        return status ? `Failed to load reports (HTTP ${status})` : "Failed to load reports";
      })()
    : null;

  const handleRefresh = () => {
    void queryClient
      .invalidateQueries({ queryKey: ["principal-reports", termId, scope] })
      .then(() => refetch())
      .then(() => toast.success({ title: "Reports refreshed" }))
      .catch(() => toast.error({ title: "Refresh failed", description: "Could not reload reports." }));
  };

  const handleExport = () => {
    if (!data) return;
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const block = (rows: (string | number | null)[][]) =>
      rows.map((r) => r.map(escape).join(",")).join("\n");
    const sections: string[] = [];
    sections.push(`"Reports — ${data.termLabel} (${data.schoolYear})"`);
    sections.push(
      block([
        ["Metric", "Value"],
        ["Avg transmuted grade", data.kpis.avgTransmuted],
        ["Interventions resolved", data.kpis.interventionsResolved],
        ["Intervention success rate", `${data.kpis.interventionRate}%`],
        ["Sections at risk", data.kpis.sectionsAtRisk],
        ["Honor roll candidates", data.kpis.honorRoll],
      ])
    );
    sections.push(
      block([
        ["Risk level", "Count"],
        ...data.riskDistribution.map((r) => [r.level, r.count]),
      ])
    );
    sections.push(
      block([
        ["Grade", "Honor roll candidates"],
        ...data.honorRollByGrade.map((r) => [r.grade, r.candidates]),
      ])
    );
    sections.push(
      block([
        ["ADM stage", "Count"],
        ...data.admStages.map((r) => [r.stage, r.count]),
      ])
    );
    const csv = sections.join("\n\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reports-${data.schoolYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalRecords =
    (data?.trends ?? []).length +
    (data?.honorRollByGrade ?? []).reduce((s, r) => s + r.candidates, 0) +
    (data?.admStages ?? []).reduce((s, r) => s + r.count, 0) +
    (data?.riskDistribution ?? []).reduce((s, r) => s + r.count, 0) +
    (data?.kpis.honorRoll ?? 0);
  const isEmpty = !loading && !errorMsg && !!data && totalRecords === 0;
  return (
    <section className={styles.page} aria-busy={isPending || undefined}>
      {isPending || !termReady ? (
        <PageHeaderSkeleton withActions actionCount={2} />
      ) : isEmpty ? null : (
      <PrincipalPageHeader
        title="Reports & Analytics"
        description="Every transaction and data stream across the school, visualized."
        actions={
          <ReportsToolbar onRefresh={handleRefresh} onExport={handleExport} loading={loading} />
        }
      />
      )}

      {errorMsg ? (
        <div className={styles.error}>{errorMsg}</div>
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
