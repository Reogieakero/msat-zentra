"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { FACTOR_CHIP, type BackendHeatmap, type RiskFactor } from "@/services/principal/riskStudents.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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
          <div className={styles.state}>
            <Loader2 className={styles.spinner} aria-hidden />
            Loading heatmap…
          </div>
        ) : sections.length === 0 ? (
          <div className={styles.state}>No sections to display.</div>
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
