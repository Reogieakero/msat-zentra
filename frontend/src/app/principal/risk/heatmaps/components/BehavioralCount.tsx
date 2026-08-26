import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { mockHeatmap, delay } from "./mockData";
import styles from "./factor.module.css";

const SCALE = ["var(--hm-0)", "var(--hm-1)", "var(--hm-2)", "var(--hm-3)", "var(--hm-4)"];

function cellColor(count: number): string {
  if (count <= 0) return SCALE[0];
  if (count <= 3) return SCALE[1];
  if (count <= 7) return SCALE[2];
  if (count <= 11) return SCALE[3];
  return SCALE[4];
}

export function BehavioralCount() {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<typeof mockHeatmap | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    delay(mockHeatmap, 450)
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
  const total = data ? data.factorTotals.Behavioral : 0;

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>Behavioral Records</h3>
        <span className={styles.meta}>{loading ? "—" : `${total} total`}</span>
      </div>
      <p className={styles.subtitle}>Anecdotal records per section &middot; status-only</p>
      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className={styles.tileSkel} />
          ))}
        </div>
      ) : (
        <div className={styles.grid}>
          {sections.map((s) => {
            const count = s.factors.Behavioral as number;
            return (
              <div key={s.sectionId} className={styles.tile}>
                <span className={styles.tileCode}>{s.sectionId}</span>
                <span className={styles.tileCount} style={{ background: cellColor(count) }}>
                  {count > 0 ? count : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className={styles.note}>Confidential source hidden — status-only count.</p>
    </section>
  );
}
