"use client";

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
              <h1 className={`${styles.title} ${styles.academicTitle}`}>Academic Heat Map</h1>
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
