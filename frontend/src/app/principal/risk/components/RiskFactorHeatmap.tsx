import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X } from "lucide-react";
import { useRiskHeatmap, fetchSectionFactorStudents, type HeatmapStudent, type RiskFactor } from "../riskBoard";
import styles from "./risk-factor-heatmap.module.css";

const FACTORS: RiskFactor[] = ["Academic", "Attendance", "Behavioral"];

function cellColor(count: number): string {
  if (count <= 0) return "var(--hm-0)";
  if (count <= 3) return "var(--hm-1)";
  if (count <= 7) return "var(--hm-2)";
  if (count <= 11) return "var(--hm-3)";
  return "var(--hm-4)";
}

const SCALE = ["var(--hm-0)", "var(--hm-1)", "var(--hm-2)", "var(--hm-3)", "var(--hm-4)"];

type Selection = { sectionId: string; section: string; factor: RiskFactor } | null;

export function RiskFactorHeatmap() {
  const { data, loading, error } = useRiskHeatmap();
  const [selected, setSelected] = React.useState<Selection>(null);
  const [visible, setVisible] = React.useState(false);
  const [students, setStudents] = React.useState<HeatmapStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = React.useState(false);

  const open = React.useCallback((next: Selection) => {
    if (next) {
      setSelected(next);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, []);

  React.useEffect(() => {
    if (!selected) return;
    const id = setTimeout(() => open(null), 5000);
    return () => clearTimeout(id);
  }, [selected, open]);

  // Fetch the per-cell student list whenever a new cell is opened.
  React.useEffect(() => {
    if (!selected || !data?.termId) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadingStudents(true);
    });
    fetchSectionFactorStudents(selected.sectionId, selected.factor, data.termId)
      .then((res) => {
        if (!cancelled) setStudents(res);
      })
      .catch((err) => {
        console.error("[/api/risk/sections/:id/students] failed:", err);
        if (!cancelled) setStudents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStudents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, data?.termId]);

  const sections = data?.sections ?? [];
  const factorTotals = data?.factorTotals;
  const selectedCount =
    selected && factorTotals ? factorTotals[selected.factor] : 0;

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle>Section × Risk-Factor</CardTitle>
        <span className={styles.subtitle}>student counts · status-only</span>
      </CardHeader>
      <CardContent className={styles.content}>
        {error ? (
          <p className={styles.confidential}>{error}</p>
        ) : loading ? (
          <div className={styles.skelWrap}>
            <div className={styles.skelRow}>
              <Skeleton className={styles.skelRowHead} />
              {FACTORS.map((f) => (
                <Skeleton key={f} className={styles.skelColHead} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skelRow}>
                <Skeleton className={styles.skelRowHead} />
                {FACTORS.map((f) => (
                  <Skeleton key={f} className={styles.skelCell} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <TooltipProvider>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.rowHead}>Section</th>
                    {FACTORS.map((f) => (
                      <th key={f} className={styles.colHead}>
                        <span>{f}</span>
                        <span className={styles.factorTotal}>
                          {loading || !factorTotals ? "—" : factorTotals[f]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map((row) => (
                    <tr key={row.sectionId}>
                      <th scope="row" className={styles.rowHead}>
                        {row.section}
                      </th>
                      {FACTORS.map((f) => {
                        const count = row.factors[f];
                        const isActive =
                          selected?.sectionId === row.sectionId &&
                          selected?.factor === f;
                        const prevIsActive = isActive;
                        return (
                          <td key={f} className={styles.cell}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={`${styles.cellBtn} ${isActive ? styles.cellActive : ""}`}
                                  style={{ background: cellColor(count) }}
                                  aria-label={`${row.section} ${f}: ${count} students`}
                                  aria-pressed={isActive}
                                  disabled={loading}
                                  onClick={() =>
                                    open(
                                      prevIsActive
                                        ? null
                                        : {
                                            sectionId: row.sectionId,
                                            section: row.section,
                                            factor: f,
                                          }
                                    )
                                  }
                                >
                                  {loading ? "" : count > 0 ? count : ""}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span className={styles.tip}>
                                  {row.section} · {f}
                                </span>
                                <span className={styles.tipSub}>
                                  {count} student{count === 1 ? "" : "s"}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TooltipProvider>
        )}
        <div className={styles.legend}>
          <span className={styles.legendLabel}>0</span>
          <span className={styles.legendSwatches}>
            {SCALE.map((c, i) => (
              <span key={i} className={styles.legendSwatch} style={{ background: c }} />
            ))}
          </span>
          <span className={styles.legendLabel}>high</span>
        </div>
        <p className={styles.confidential}>
          Confidential source hidden — status-only view.
        </p>
      </CardContent>

      {selected && (
        <div
          className={`${styles.floating} ${visible ? "" : styles.floatingClosed}`}
          role="dialog"
          aria-label={`At-risk students in ${selected.section} · ${selected.factor}`}
          onTransitionEnd={() => {
            if (!visible) setSelected(null);
          }}
        >
          <div className={styles.floatingHead}>
            <div>
              <p className={styles.floatingTitle}>{selected.section}</p>
              <p className={styles.floatingSub}>
                {selected.factor} · {selectedCount} flagged
              </p>
            </div>
            <button
              type="button"
              className={styles.floatingClose}
              aria-label="Close panel"
              onClick={() => open(null)}
            >
              <X size={16} />
            </button>
          </div>
          {loadingStudents ? (
            <ul className={styles.studentList}>
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className={styles.studentItem}>
                  <Skeleton className={styles.skelStudentDot} />
                  <Skeleton className={styles.skelStudentLrn} />
                </li>
              ))}
            </ul>
          ) : students.length === 0 ? (
            <p className={styles.floatingEmpty}>No at-risk students recorded.</p>
          ) : (
            <ul className={styles.studentList}>
              {students.map((s) => (
                <li key={s.lrn} className={styles.studentItem}>
                  <span
                    className={styles.studentDot}
                    data-level={s.riskLevel}
                  />
                  <span className={styles.studentLrn}>{s.lrn}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
