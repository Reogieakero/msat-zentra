"use client";

import { MapPin } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { findHotspot } from "@/components/risk-dashboard/RiskHotspot";
import { STAT_PILL } from "./nurse-adm-pills";
import { useNurseAdmRiskData } from "./use-nurse-risk-data";
import styles from "./nurse-adm.module.css";

/**
 * Busiest-spot KPI — the hotspot board condensed to a stat so it sits in the
 * top stats strip instead of taking a full risk board below.
 */
export function NurseAdmHotspotStat() {
  const { isPending, dashboard } = useNurseAdmRiskData();
  const hotspot = dashboard
    ? findHotspot(dashboard.matrix, dashboard.matrixCategories, dashboard.totalCases)
    : null;

  const icon = (
    <span className="text-amber-500" aria-hidden>
      <MapPin size={14} />
    </span>
  );

  if (isPending || !dashboard) {
    return (
      <KanbanBoard
        title="Busiest spot"
        icon={icon}
        description={<span className={STAT_PILL}>Loading…</span>}
        className="flex-1"
      >
        <Skeleton className="h-8 w-24" />
      </KanbanBoard>
    );
  }

  return (
    <KanbanBoard
      title="Busiest spot"
      icon={icon}
      description={
        <span className={STAT_PILL}>
          {hotspot
            ? `${hotspot.count} ${hotspot.category.toLowerCase()} case${
                hotspot.count === 1 ? "" : "s"
              }`
            : "No cases yet"}
        </span>
      }
      className="flex-1"
    >
      <p className={styles.findingValue}>{hotspot ? hotspot.section : "—"}</p>
    </KanbanBoard>
  );
}
