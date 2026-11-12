"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRecords } from "@/services/principal/records.service";
import { RecordsHeatblocks } from "./components/RecordsHeatblocks";
import { RecordsCharts } from "./components/RecordsCharts";
import { RecordsRail } from "./components/RecordsRail";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import { useTerm } from "@/lib/term/TermContext";
import { liveQueryOptions } from "@/lib/api/live";
import styles from "./components/records.module.css";

export default function PrincipalRecordsPage() {
  const { termReady } = useTerm();
  // Staff file anecdotal records all day; this desk stays live so the
  // principal sees new records without reloading.
  const { data, isPending, isError } = useQuery({
    ...liveQueryOptions,
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
    enabled: termReady,
  });
  const total = (data?.sections ?? []).reduce(
    (sum, s) => sum + s.students.reduce((a, st) => a + st.behavioral.length, 0),
    0
  );
  const isEmpty = !isPending && !isError && total === 0;
  return (
    <section className={styles.page} aria-busy={isPending || undefined}>
      {isEmpty ? (
        <PageEmptyCallout>
          No behavioral records filed for the active term yet. New records will
          appear here once filed.
        </PageEmptyCallout>
      ) : (
      <div className={styles.topRow}>
        <div className={styles.mainColumn}>
          <RecordsCharts />
          <RecordsHeatblocks />
        </div>

        <RecordsRail />
      </div>
      )}
    </section>
  );
}
