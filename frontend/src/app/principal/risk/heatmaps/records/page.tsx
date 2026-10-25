"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { fetchRecords } from "@/services/principal/records.service";
import { RecordsHeatblocks } from "./components/RecordsHeatblocks";
import { RecordsRail } from "./components/RecordsRail";
import { PrincipalEmptyCard } from "../../../components/PrincipalEmptyCard";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/records.module.css";

export default function PrincipalRecordsPage() {
  const { termReady } = useTerm();
  const { data, isPending, isError } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
        <PrincipalEmptyCard
          icon={FileText}
          title="No records this term"
          hint="No behavioral records filed for the active term. New records will appear here once filed."
          centered
        />
      ) : (
      <div className={styles.topRow}>
        <RecordsHeatblocks />

        <RecordsRail />
      </div>
      )}
    </section>
  );
}
