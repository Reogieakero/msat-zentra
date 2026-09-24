"use client";

import * as React from "react";
import {
  CaseHistoryDialog,
  type HistoryTarget,
} from "../components/CaseHistoryDialog";
import { useCoordinatorOverview } from "./components/use-coordinator-overview";
import { CoordinatorOverviewKpis } from "./components/coordinator-overview-kpis";
import { CoordinatorOverviewAttentionDialog } from "./components/coordinator-overview-attention-dialog";
import { CoordinatorOverviewStageChart } from "./components/coordinator-overview-stage-chart";
import { CoordinatorOverviewForwards } from "./components/coordinator-overview-forwards";
import { CoordinatorOverviewDevices } from "./components/coordinator-overview-devices";
import {
  CoordinatorOverviewError,
  CoordinatorOverviewSkeleton,
} from "./components/coordinator-overview-states";
import styles from "./components/coordinator-overview.module.css";

export default function CoordinatorOverviewPage() {
  const [historyTarget, setHistoryTarget] =
    React.useState<HistoryTarget | null>(null);
  const [attentionOpen, setAttentionOpen] = React.useState(false);
  const overview = useCoordinatorOverview();

  if (overview.isPending) return <CoordinatorOverviewSkeleton />;
  if (overview.isError) {
    return (
      <CoordinatorOverviewError
        onRetry={overview.refetch}
        isRefetching={overview.isRefetching}
      />
    );
  }

  return (
    <section className={styles.page}>
      <CoordinatorOverviewKpis
        attentionTotal={overview.attentionTotal}
        attentionReady={overview.attentionReady}
        attentionError={overview.attentionError}
        allClear={overview.allClear}
        referredToMe={overview.referredToMe}
        certificationsIssued={overview.certificationsIssued}
        awaitingPrincipal={overview.awaitingPrincipal}
        activeEnrolled={overview.activeEnrolled}
        onReview={() => setAttentionOpen(true)}
      />

      <CoordinatorOverviewAttentionDialog
        open={attentionOpen}
        onClose={() => setAttentionOpen(false)}
        attention={overview.attention}
        attentionError={overview.attentionError}
        isRetrying={overview.devices.isRefetching}
        onRetry={overview.devices.refetch}
      />

      <div className={styles.railRow}>
        <CoordinatorOverviewStageChart stageDonut={overview.stageDonut} />
        <CoordinatorOverviewForwards
          rows={overview.forwards.rows}
          isPending={overview.forwards.isPending}
          isError={overview.forwards.isError}
          isRefetching={overview.forwards.isRefetching}
          now={overview.now}
          onRetry={overview.forwards.refetch}
          onHistory={setHistoryTarget}
        />
      </div>

      <CoordinatorOverviewDevices
        issued={overview.devices.data?.issued ?? null}
        returned={overview.devices.data?.returned ?? null}
        hasData={Boolean(overview.devices.data)}
        isPending={overview.devices.isPending}
        isError={overview.devices.isError}
        isRefetching={overview.devices.isRefetching}
        oldestOut={overview.devices.oldestOut}
        now={overview.now}
        onRetry={overview.devices.refetch}
      />

      <CaseHistoryDialog
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </section>
  );
}
