"use client";

import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { RecordsHeader } from "./components/RecordsHeader";
import { RecordsHeatblocks } from "./components/RecordsHeatblocks";
import { RecordsOverview } from "./components/RecordsOverview";
import { RecordDetailSheet } from "./components/RecordDetailSheet";
import styles from "./components/records.module.css";

const SELECTED_KEY = "records-heatmap:selectedLrn";
const GRADE_KEY = "records-heatmap:grade";

export default function PrincipalRecordsPage() {
  const [selectedLrn, setSelectedLrn] = usePersistentState<string | null>(
    SELECTED_KEY,
    null
  );
  const [selectedGrade, setSelectedGrade] = usePersistentState<string | null>(
    GRADE_KEY,
    "7"
  );

  return (
    <section className={styles.page}>
      <RecordsHeader />

      <hr className={styles.divider} />

      <RecordsHeatblocks
        selectedLrn={selectedLrn}
        onSelectLrn={setSelectedLrn}
        selectedGrade={selectedGrade}
        onSelectGrade={setSelectedGrade}
      />

      <RecordsOverview />

      <RecordDetailSheet
        lrn={selectedLrn}
        onClose={() => setSelectedLrn(null)}
      />
    </section>
  );
}