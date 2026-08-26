"use client";

import * as React from "react";
import { LayoutGrid } from "lucide-react";
import { PatternFloats } from "./components/PatternFloats";
import { FloatingMenu } from "./components/FloatingMenu";
import styles from "./components/heatmap.module.css";

export default function PrincipalRiskHeatmapsPage() {
  const [showPatterns, setShowPatterns] = React.useState(false);

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <FloatingMenu selected="attendance-heatmap" onSelect={() => {}} />

        <section className={styles.page}>
          <header className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.kicker}>
              <LayoutGrid size={14} /> Early Intervention
            </span>
            <h1 className={styles.title}>Risk Heatmaps</h1>
            <p className={styles.subtitle}>
              School-wide risk, attendance &amp; academics heatmaps &middot; status-only
            </p>
          </div>
          <div className={styles.headActions}>
            <label className={styles.toggle}>
              <span className={styles.toggleLabel}>Patterns</span>
              <button
                type="button"
                role="switch"
                aria-checked={showPatterns}
                className={`${styles.track} ${showPatterns ? styles.trackOn : ""}`}
                onClick={() => setShowPatterns((v) => !v)}
              >
                <span className={`${styles.thumb} ${showPatterns ? styles.thumbOn : ""}`} />
              </button>
            </label>
          </div>
        </header>

        {showPatterns && <PatternFloats onClose={() => setShowPatterns(false)} />}
        </section>
      </div>
    </div>
  );
}
