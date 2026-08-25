import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BackendHeatmap, type RiskFactor } from "../api";
import styles from "./SectionHeatmap.module.css";

function ErrorNote({ message }: { message: string }) {
  return <p className={styles.confidential}>{message}</p>;
}

export function SectionHeatmap({
  heat,
  loading,
  error,
  factors,
  selectedSection,
  onSelect,
  titleRef,
}: {
  heat: BackendHeatmap | null;
  loading: boolean;
  error: string | null;
  factors: RiskFactor[];
  selectedSection: string | null;
  onSelect: (section: string) => void;
  titleRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Card className={styles.tableCard} ref={titleRef}>
      <CardHeader className={styles.header}>
        <CardTitle>Section × Risk-Factor</CardTitle>
        <span className={styles.subtitle}>counts · status-only</span>
      </CardHeader>
      <CardContent>
        <div className={styles.tableWrap}>
          {error ? (
            <ErrorNote message={error} />
          ) : loading && !heat ? (
            <div className={styles.skeletonRows}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={styles.skelRow} />
              ))}
            </div>
          ) : (
            <div className={styles.heatScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Section</th>
                    {factors.map((f) => (
                      <th key={f}>{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(heat?.sections ?? []).map((row) => {
                    const active = selectedSection === row.section;
                    return (
                      <tr
                        key={row.sectionId}
                        className={active ? styles.rowActive : undefined}
                        onClick={() => onSelect(row.section)}
                        role="button"
                        tabIndex={0}
                        aria-pressed={active}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(row.section);
                          }
                        }}
                      >
                        <td className={styles.sectionCell}>{row.section}</td>
                        {factors.map((f) => (
                          <td key={f} className={styles.mono}>
                            {row.factors[f]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className={styles.confidential} style={{ marginTop: "0.75rem" }}>
          Confidential source hidden — status-only view.
        </p>
      </CardContent>
    </Card>
  );
}
