"use client";

import { useEffect, useState } from "react";
import { ActionRequired } from "./components/ActionRequired";
import { Sf10Summary } from "./components/Sf10Summary";
import { AcademicsKpis } from "./components/AcademicsKpis";
import { StudentApprovals } from "./components/StudentApprovals";
import { AttentionPanel } from "./components/AttentionPanel";
import type { RegistrarOverviewData } from "./components/data";
import { apiClient } from "@/lib/api/client";
import { useMediaQuery } from "@/components/use-media-query";
import styles from "./overview.module.css";

const EMPTY: RegistrarOverviewData = {
  pendingAccounts: 0,
  pendingAdviserAccess: 0,
  lockedFinalsAwaiting: 0,
  sf10Released: 0,
  sections: 0,
  subjects: 0,
  reportCards: 0,
  latestAttachments: [],
  missingSf10: [],
  pendingStudents: [],
  sf10Students: [],
};

export default function RegistrarOverviewPage() {
  const [data, setData] = useState<RegistrarOverviewData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<RegistrarOverviewData>("/api/registrar/overview")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(status ? `Failed to load overview (HTTP ${status})` : "Failed to load overview");
          console.error("[/api/registrar/overview] fetch failed:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const m = data;
  // On desktop widths the right rail lives in the sidebar column (aside);
  // at laptop/tablet widths it stacks under the academic section.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const showRailAside = isDesktop;

  return (
    <section className={styles.page}>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.layout}>
        <div className={styles.main}>
          <ActionRequired data={m} />
          <Sf10Summary data={m} />
          <AcademicsKpis data={m} />
          {!showRailAside ? (
            <div className={styles.railInline}>
              <StudentApprovals data={m} />
              <AttentionPanel data={m} />
            </div>
          ) : null}
        </div>

        {showRailAside ? (
          <aside className={styles.rail} aria-label="Registrar summary">
            <StudentApprovals data={m} />
            <AttentionPanel data={m} />
          </aside>
        ) : null}
      </div>
    </section>
  );
}
