"use client";

import { useQuery } from "@tanstack/react-query";
import { OverviewShortcuts } from "@/components/registry/overview/OverviewShortcuts";
import { OverviewKpiRail } from "@/components/registry/overview/OverviewKpiRail";
import { Sf10AttachFeed } from "@/components/registry/overview/Sf10AttachFeed";
import { FinalGradeApprovals } from "@/components/registry/overview/FinalGradeApprovals";
import { OverviewGradeChart } from "@/components/registry/overview/OverviewGradeChart";
import { Sf10RequestsChart } from "@/components/registry/overview/Sf10RequestsChart";
import { fetchRegistrarOverview } from "@/services/registry/overview.service";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import styles from "./components/overview.module.css";

// Mirror of /record-keeper/overview — same cards, rail, motion; every widget
// is desk-scoped, so this page reads the G11–12 band while the record keeper
// page reads G7–10.
export default function RegistrarOverviewPage() {
  // Same key OverviewShortcuts reads, so this only observes its cache.
  const { data } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
    staleTime: 30_000,
  });

  const isEmpty =
    !!data &&
    data.pendingAccounts === 0 &&
    data.pendingAdviserAccess === 0 &&
    data.lockedFinalsAwaiting === 0 &&
    data.latestAttachments.length === 0 &&
    data.pendingStudents.length === 0 &&
    data.finals.total === 0 &&
    data.sf10.total === 0 &&
    data.sections === 0 &&
    data.subjects === 0 &&
    data.rosterByGrade.reduce((sum, row) => sum + row.count, 0) === 0 &&
    data.sf10RequestsDaily.length === 0;

  if (isEmpty) {
    return (
      <section className={styles.page}>
        <PageEmptyCallout>
          No records for this grade band yet. Approvals, SF10 activity, and
          grade distribution will appear here once data is filed.
        </PageEmptyCallout>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <OverviewShortcuts desk="registrar" variant="stats" />

          <div className={styles.duo}>
            <Sf10AttachFeed desk="registrar" variant="kanban" />
            <FinalGradeApprovals desk="registrar" variant="kanban" />
          </div>

          <div className={styles.duo}>
            <OverviewGradeChart desk="registrar" variant="kanban" />
            <Sf10RequestsChart desk="registrar" />
          </div>
        </div>
        <OverviewKpiRail desk="registrar" />
      </div>
    </section>
  );
}
