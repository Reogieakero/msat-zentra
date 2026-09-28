"use client";

import * as React from "react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { AcademicInsights } from "./components/AcademicInsights";
import styles from "../components/heatmap.module.css";

const SECTION_KEY = "academics-heatmap:sectionId";

export default function PrincipalAcademicHeatmapsPage() {
  const [selectedId, setSelectedId] = usePersistentState<string | null>(
    SECTION_KEY,
    null
  );

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <section className={styles.page}>
          <AcademicInsights
            selectedId={selectedId}
            onSelectId={setSelectedId}
            onClearSection={() => setSelectedId(null)}
          />
        </section>
      </div>
    </div>
  );
}
