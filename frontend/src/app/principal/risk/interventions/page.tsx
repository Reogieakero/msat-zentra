"use client";

import * as React from "react";
import { useGradeMode } from "../../grade-mode-context";
import type { RiskSnapshotStudent } from "./types";
import { InterventionsHeader } from "./components/InterventionsHeader";
import { InterventionsListTable } from "./components/InterventionsListTable";
import { InterventionDrawer } from "./components/InterventionDrawer";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";

export default function PrincipalInterventionsPage() {
  const { gradeMode } = useGradeMode();
  const [selected, setSelected] = React.useState<RiskSnapshotStudent | null>(null);

  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section className={styles.page}>
          <InterventionsHeader />

          <hr className={styles.divider} />

          <InterventionsListTable onSelect={setSelected} />
        </section>
      </div>

      <InterventionDrawer
        student={selected}
        gradeMode={gradeMode}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
