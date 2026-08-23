"use client";

import { useEffect, useState } from "react";
import { NotebookPen, CalendarOff, FileSignature, FileBarChart } from "lucide-react";
import { SchoolCard } from "./components/SchoolCard";
import { BrowserWindow } from "./components/BrowserWindow";
import { AttendanceHeatmap } from "./components/AttendanceHeatmap";
import { ActionRequired } from "./components/ActionRequired";
import { TABS, SCHOOL_NAME } from "./components/data";
import type { TabDef, OverviewData } from "./components/data";
import { apiClient } from "@/lib/api/client";
import styles from "./overview.module.css";

const TAB_DEFS: TabDef[] = TABS.map((t) => ({
  ...t,
  icon:
    t.id === "anecdotal"
      ? NotebookPen
      : t.id === "attendance"
        ? CalendarOff
        : t.id === "adm"
          ? FileSignature
          : FileBarChart,
}));

export default function PrincipalOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<OverviewData>("/api/overview")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(status ? `Failed to load overview (HTTP ${status})` : "Failed to load overview");
          console.error("[/api/overview] fetch failed:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kpisFallback = { enrollment: 0, activeSections: 0, teachers: 0, anecdotals: 0 };

  return (
    <section className={styles.page}>
      <div className={styles.grid}>
        <SchoolCard
          schoolName={SCHOOL_NAME}
          kpis={data?.kpis ?? kpisFallback}
          loading={!data && !error}
        />
        <BrowserWindow tabs={TAB_DEFS} />
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <AttendanceHeatmap />
      <ActionRequired />
    </section>
  );
}
