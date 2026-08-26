import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Flame, BookOpen } from "lucide-react";
import { mockAcademicHeatmap, delay, type AcademicHeatmapData } from "./mockData";
import styles from "./heatmap.module.css";

const SCALE = [
  "var(--acad-0)",
  "var(--acad-1)",
  "var(--acad-2)",
  "var(--acad-3)",
  "var(--acad-4)",
];

// Strongest fills are deep green/red — use light text for contrast.
const TEXT_BY_LEVEL = [
  "var(--foreground)",
  "var(--foreground)",
  "var(--foreground)",
  "var(--primary-foreground)",
  "var(--primary-foreground)",
];

function levelFor(pct: number): number {
  if (pct <= 0) return 0;
  if (pct <= 8) return 1;
  if (pct <= 18) return 2;
  if (pct <= 30) return 3;
  return 4;
}

function cellColor(pct: number): string {
  return SCALE[levelFor(pct)];
}

function cellText(pct: number): string {
  return TEXT_BY_LEVEL[levelFor(pct)];
}

function barColor(pct: number): string {
  if (pct <= 8) return "var(--acad-1)";
  if (pct <= 18) return "var(--acad-2)";
  if (pct <= 30) return "var(--acad-3)";
  return "var(--acad-4)";
}

export function AcademicHeatmap() {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<AcademicHeatmapData | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    delay(mockAcademicHeatmap(), 450)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = data?.sections ?? [];
  const subjects = data?.subjects ?? [];
  const totals = data?.subjectTotals ?? [];

  const totalBelow = totals.reduce((a, t) => a + t.below75Count, 0);
  const sectionsAtRisk = sections.filter((s) => s.anyAtRisk).length;
  const worst = totals[0];

  return (
    <section className={styles.board}>
      <div className={styles.statRow}>
        <div className={`${styles.tile} ${styles.tile_warn}`}>
          <span className={styles.tileIcon}>
            <AlertTriangle size={18} />
          </span>
          <div className={styles.tileBody}>
            <span className={styles.tileValue}>
              {loading ? "—" : totalBelow}
            </span>
            <span className={styles.tileLabel}>Students below 75</span>
            <span className={styles.tileHint}>across all subjects</span>
          </div>
        </div>

        <div className={`${styles.tile} ${styles.tile_neutral}`}>
          <span className={styles.tileIcon}>
            <BookOpen size={18} />
          </span>
          <div className={styles.tileBody}>
            <span className={styles.tileValue}>
              {loading ? "—" : sectionsAtRisk}
            </span>
            <span className={styles.tileLabel}>Sections with at-risk</span>
            <span className={styles.tileHint}>≥1 learner below 75</span>
          </div>
        </div>

        <div className={`${styles.tile} ${styles.tile_hot}`}>
          <span className={styles.tileIcon}>
            <Flame size={18} />
          </span>
          <div className={styles.tileBody}>
            <span className={styles.tileValue}>
              {loading || !worst ? "—" : worst.subject}
            </span>
            <span className={styles.tileLabel}>Highest failure subject</span>
            <span className={styles.tileHint}>
              {loading || !worst ? "status-only" : `${worst.below75Pct}% below 75`}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Section × Subject — % below 75</h3>
          {loading ? (
            <Skeleton className={styles.tileSkel} />
          ) : (
            <div
              className={styles.matrix}
              style={{
                gridTemplateColumns: `minmax(64px, auto) repeat(${subjects.length}, minmax(0, 1fr))`,
              }}
            >
              <span className={styles.matrixCorner} />
              {subjects.map((subj) => (
                <span key={subj} className={styles.matrixColHead}>
                  {subj}
                </span>
              ))}
              {sections.map((s) => (
                <React.Fragment key={s.sectionId}>
                  <span className={styles.matrixRowHead}>{s.sectionId}</span>
                  {s.cells.map((c) => (
                    <span
                      key={c.subject}
                      className={styles.matrixCell}
                      style={{
                        background: cellColor(c.below75Pct),
                        color: cellText(c.below75Pct),
                      }}
                      title={`${s.sectionId} · ${c.subject}: ${c.below75Pct}% below 75`}
                    >
                      {c.below75Pct > 0 ? `${c.below75Pct}%` : "—"}
                    </span>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Subject failure ranking</h3>
          {loading ? (
            <Skeleton className={styles.tileSkel} />
          ) : (
            <div className={styles.bars}>
              {totals.map((t, i) => (
                <div key={t.subject} className={styles.barRow}>
                  <span className={styles.barLabel}>{t.subject}</span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{
                        width: `${Math.min(100, t.below75Pct * 3)}%`,
                        background: barColor(t.below75Pct),
                      }}
                    />
                  </span>
                  <span className={styles.barValue}>{t.below75Pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendLabel}>% below 75:</span>
        <span className={styles.legendScale}>
          {SCALE.map((c, i) => (
            <span
              key={i}
              className={styles.legendSwatch}
              style={{ background: c }}
            />
          ))}
        </span>
        <span className={styles.legendNote}>
          Confidential source hidden — status-only counts.
        </span>
      </div>
    </section>
  );
}
