"use client";

import * as React from "react";
import { Grid3x3, Users } from "lucide-react";
import {
  FACTOR_CHIP,
  type BackendHeatmap,
  type RiskFactor,
} from "@/services/principal/riskStudents.types";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { PrincipalEmptyState } from "../../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./StudentHeatmap.module.css";

const FACTORS: RiskFactor[] = ["Academic", "Attendance", "Behavioral"];

const FACTOR_GRADIENT: Record<RiskFactor, string> = {
  Academic: "linear-gradient(90deg, #f59e0b, #b45309)",
  Attendance: "linear-gradient(90deg, #22c55e, #15803d)",
  Behavioral: "linear-gradient(90deg, #3b82f6, #1d4ed8)",
};

const gradeLabel = (grade: string) => {
  const m = String(grade).match(/(\d+)/);
  return m ? `Grade ${m[1]}` : grade;
};

export function StudentHeatmap({
  heat,
  loading,
  selectedSection,
  onSelect,
}: {
  heat: BackendHeatmap | null;
  loading: boolean;
  selectedSection: string | null;
  onSelect: (section: string) => void;
}) {
  const maxByFactor = React.useMemo(() => {
    const max: Record<RiskFactor, number> = { Academic: 0, Attendance: 0, Behavioral: 0 };
    for (const row of heat?.sections ?? []) {
      for (const f of FACTORS) {
        const v = row.factors[f] ?? 0;
        if (v > max[f]) max[f] = v;
      }
    }
    return max;
  }, [heat]);

  const sections = heat?.sections ?? [];

  return (
    <KanbanBoard
      title="Section Heatmap"
      icon={<Grid3x3 size={14} aria-hidden="true" />}
      count={loading ? undefined : sections.length}
      description="Flag intensity for academic, attendance, and behavioral factors per section. Select a section to drill into its students."
      actions={
        <Pill tone="green" label="Data source">
          Adviser-shared
        </Pill>
      }
      ariaLabel="Section heatmap"
    >
      {loading ? (
        <div className={styles.grid} aria-busy="true" aria-label="Loading section heatmap">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.cardHead}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <div className={styles.factorList}>
                {FACTORS.map((f) => (
                  <Skeleton key={f} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <PrincipalEmptyState
          icon={Users}
          title="No sections to display"
          hint="No sections with risk data for the active term. Sections will appear here once detected."
        />
      ) : (
        <div className={styles.grid} role="list" aria-label="Section risk heatmap">
          {sections.map((row) => {
            const isActive = row.section === selectedSection;
            return (
              <button
                type="button"
                key={row.sectionId}
                role="listitem"
                className={`${styles.card} ${isActive ? styles.active : ""}`}
                onClick={() => onSelect(row.section)}
                aria-pressed={isActive}
                aria-label={`${row.section}, ${gradeLabel(row.gradeLevel)}`}
              >
                <div className={styles.cardHead}>
                  <span className={styles.sectionName}>{row.section}</span>
                  <Pill tone="neutral" label="Grade level">
                    {gradeLabel(row.gradeLevel)}
                  </Pill>
                </div>

                <ul className={styles.factorList}>
                  {FACTORS.map((f) => {
                    const v = row.factors[f] ?? 0;
                    const pct =
                      v === 0 || maxByFactor[f] === 0
                        ? 0
                        : Math.max(8, (v / maxByFactor[f]) * 100);
                    return (
                      <li key={f} className={styles.factorRow}>
                        <span
                          className={styles.factorDot}
                          style={{ background: FACTOR_CHIP[f] }}
                          aria-hidden
                        />
                        <span className={styles.factorLabel}>{f}</span>
                        <span className={styles.factorTrack} aria-hidden>
                          <span
                            className={styles.factorBar}
                            style={{
                              width: `${pct}%`,
                              background: FACTOR_GRADIENT[f],
                              opacity: v === 0 ? 0.15 : 1,
                            }}
                          />
                        </span>
                        <span className={styles.factorValue}>{v}</span>
                      </li>
                    );
                  })}
                </ul>
              </button>
            );
          })}
        </div>
      )}
    </KanbanBoard>
  );
}
