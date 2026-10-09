"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { FACTOR_CHIP, type BackendHeatmap, type RiskFactor } from "@/services/principal/riskStudents.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PrincipalEmptyState } from "../../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./StudentHeatmap.module.css";

const FACTORS: RiskFactor[] = ["Academic", "Attendance", "Behavioral"];

const gridColor = (base: string, intensity: number) => {
  const normalized = Math.max(0, Math.min(1, intensity));
  const opacity = Math.round(18 + normalized * 72);
  return `color-mix(in oklch, ${base} ${opacity}%, transparent)`;
};

const EMPTY_CELL_BG = "color-mix(in oklch, var(--muted), transparent 45%)";

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

  const isEmpty = !loading && sections.length === 0;
  if (isEmpty) {
    return (
      <section aria-label="Section heatmap">
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <PrincipalEmptyState
            icon={Users}
            title="No sections to display"
            hint="No sections with risk data for the active term. Sections will appear here once detected."
          />
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Section heatmap">
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className={`${styles.header} relative`}>
          <div className={styles.headerText}>
            <h2 className={styles.sectionTitle}>Section Heatmap</h2>
            <p className={styles.sectionDesc}>
              Intensity of academic, attendance, and behavioral flags per section.
              Select a row to drill into its students.
            </p>
          </div>
        </div>
        <div className={`${styles.tableBody} relative`}>
        {loading ? (
          <div className={styles.grid} aria-hidden="true" aria-label="Loading section heatmap">
            <div className={`${styles.row} ${styles.headRow}`}>
              <div className={styles.sectionHead}>
                <Skeleton className="h-4 w-20" />
              </div>
              {FACTORS.map((f) => (
                <div key={f} className={styles.factorHead}>
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${styles.row} ${styles.dataRow}`}>
                <div className={styles.sectionName}>
                  <Skeleton className="h-4 w-24" />
                </div>
                {FACTORS.map((f) => (
                  <div key={f} className={styles.cell}>
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))}
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
          <div className={styles.grid} role="grid" aria-label="Section risk heatmap">
            <div className={`${styles.row} ${styles.headRow}`}>
              <div className={styles.sectionHead}>Section</div>
              {FACTORS.map((f) => (
                <div key={f} className={styles.factorHead}>
                  <span
                    className={styles.factorDot}
                    style={{ backgroundColor: FACTOR_CHIP[f] }}
                    aria-hidden
                  />
                  {f}
                </div>
              ))}
            </div>
            {sections.map((row) => {
              const isActive = row.section === selectedSection;
              return (
                <button
                  type="button"
                  key={row.section}
                  role="row"
                  className={`${styles.row} ${styles.dataRow} ${isActive ? styles.active : ""}`}
                  onClick={() => onSelect(row.section)}
                  aria-selected={isActive}
                >
                  <div className={styles.sectionName}>{row.section}</div>
                  {FACTORS.map((f) => {
                    const v = row.factors[f] ?? 0;
                    const intensity = v === 0 ? 0 : maxByFactor[f] > 0 ? v / maxByFactor[f] : 0;
                    return (
                      <div
                        key={f}
                        className={styles.cell}
                        style={{
                          backgroundColor:
                            v === 0 ? EMPTY_CELL_BG : gridColor(FACTOR_CHIP[f], intensity),
                        }}
                      >
                        <span
                          className={`${styles.cellValue} ${
                            v === 0 ? styles.cellEmpty : ""
                          }`}
                        >
                          {v}
                        </span>
                      </div>
                    );
                  })}
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </section>
  );
}
