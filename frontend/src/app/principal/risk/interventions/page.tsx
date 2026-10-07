"use client";

import { InterventionsListTable } from "./components/InterventionsListTable";
import { PrincipalPageHeader } from "../../components/PrincipalPageHeader";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";

export default function PrincipalInterventionsPage() {
  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section className={styles.page}>
          <PrincipalPageHeader
            title="Intervention Cases"
            description="Flagged by the system. Category only, never the private write-up."
          />
          <InterventionsListTable />
        </section>
      </div>
    </div>
  );
}
