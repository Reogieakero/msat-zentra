"use client";

import * as React from "react";
import { Grid3X3, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FACTOR_CHIP, type BackendHeatmap, type RiskFactor } from "../api";
import styles from "./StudentHeatmap.module.css";

const FACTORS: RiskFactor[] = ["Academic", "Attendance", "Behavioral"];

// Blend factor colors in the same oklch colour space the rest of the theme
// uses (every other color-mix in the app is `in oklch`), so the map stays on
// the system palette. Lowest band keeps the fill off the raw factor hue.
const gridColor = (base: string, intensity: number) => {
  const normalized = Math.max(0, Math.min(1, intensity));
  const opacity = Math.round(18 + normalized * 72); // 18% → 90%
  return `color-mix(in oklch, ${base} ${opacity}%, transparent)`;
};

// Empty/zero cells use the light theme surface (mirrors the attendance map's
// --hm-0 empty band) so a section without a given flag reads as neutral.
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
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Section Heatmap</CardTitle>
          <CardDescription>
            Intensity of academic, attendance, and behavioral flags per section.
            Select a row to drill into its students.
          </CardDescription>
        </div>
        <Grid3X3 className={styles.headerIcon} aria-hidden />
      </CardHeader>
      <CardContent className={styles.content}>
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
      </CardContent>
    </Card>
  );
}
