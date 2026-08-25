import * as React from "react";
import { AlertTriangle, Activity, ShieldAlert } from "lucide-react";
import { type BackendBoard } from "../api";
import { KpiCard } from "./KpiCard";
import styles from "./RiskKpiRail.module.css";

export function RiskKpiRail({
  board,
  heat,
  loading,
  boardError,
}: {
  board: BackendBoard | null;
  heat: { sections: unknown[] } | null;
  loading: boolean;
  boardError: string | null;
}) {
  return (
    <aside className={styles.rail}>
      {boardError ? <p className={styles.confidential}>{boardError}</p> : null}
      <div className={styles.kpiRow}>
        <KpiCard
          icon={<AlertTriangle size={14} />}
          value={
            !board
              ? "—"
              : String(
                  (board.levelDistribution.find((l) => l.level === "High")?.count ?? 0) +
                    (board.levelDistribution.find((l) => l.level === "Moderate")?.count ?? 0)
                )
          }
          label="At-risk students"
          description="High + Moderate"
          loading={!board}
        />
        <KpiCard
          icon={<Activity size={14} />}
          value={!board ? "—" : String(board.kpis.highRiskStudents)}
          label="High-risk students"
          description="need priority review"
          loading={!board}
        />
        <KpiCard
          icon={<ShieldAlert size={14} />}
          value={!board ? "—" : String(board.kpis.totalAtRiskFlags)}
          label="Total risk flags"
          description="across all factors"
          loading={!board}
        />
        <KpiCard
          icon={<AlertTriangle size={14} />}
          value={loading ? "—" : String(heat?.sections.length ?? 0)}
          label="Sections flagged"
          description="with ≥1 at-risk student"
          loading={loading}
        />
      </div>
    </aside>
  );
}
