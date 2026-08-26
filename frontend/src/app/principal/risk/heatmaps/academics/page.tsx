"use client";

import { LayoutGrid } from "lucide-react";
import { AcademicHeatmap } from "../components/AcademicHeatmap";
import { FloatingMenu } from "../components/FloatingMenu";
import styles from "../components/heatmap.module.css";

export default function PrincipalAcademicHeatmapsPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <FloatingMenu selected="academic-heatmap" onSelect={() => {}} />

        <section className={styles.page}>
          <header className={styles.head}>
            <div className={styles.headText}>
              <span className={styles.kicker}>
                <LayoutGrid size={14} aria-hidden /> Early Intervention
              </span>
              <h1 className={styles.title}>Academic Heat Map</h1>
              <p className={styles.subtitle}>
                School-wide section &amp; subject performance &middot; status-only
              </p>
            </div>
          </header>

          <div id="academic-heatmap">
            <AcademicHeatmap />
          </div>
        </section>
      </div>
    </div>
  );
}
