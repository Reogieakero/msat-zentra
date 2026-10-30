"use client";

import { InterventionsListTable } from "./components/InterventionsListTable";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";

export default function PrincipalInterventionsPage() {
  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section className={styles.page}>
          <InterventionsListTable />
        </section>
      </div>
    </div>
  );
}
