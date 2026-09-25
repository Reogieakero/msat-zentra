"use client";

import { OverviewShortcuts } from "./components/OverviewShortcuts";
import { Sf10AttachFeed } from "./components/Sf10AttachFeed";
import { OverviewGradeChart } from "./components/OverviewGradeChart";
import { FinalGradeApprovals } from "./components/FinalGradeApprovals";
import { Sf10Coverage } from "./components/Sf10Coverage";
import { OverviewSectionsSubjects } from "./components/OverviewSectionsSubjects";
import styles from "./components/overview.module.css";

export default function RegistrarOverviewPage() {
  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Overview sidebar">
          <OverviewShortcuts />
          <OverviewGradeChart />
        </aside>

        <div className={styles.main}>
          <Sf10Coverage />
          <Sf10AttachFeed />
          <div className={styles.duo}>
            <FinalGradeApprovals />
            <OverviewSectionsSubjects />
          </div>
        </div>
      </div>
    </section>
  );
}
