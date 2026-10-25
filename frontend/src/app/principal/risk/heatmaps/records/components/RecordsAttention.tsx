"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import type { RecordStudent } from "../types";
import { fetchRecords } from "@/services/principal/records.service";
import styles from "./RecordsOverview.module.css";

const TOP_STUDENTS = 3;

/** Record load for one learner, used as the tie-breaker on equal counts. */
function highCount(s: RecordStudent) {
  return s.behavioral.filter((r) => r.severity === "High").length;
}

/**
 * "Needs attention" contents for the records desk — the three learners
 * carrying the heaviest record load this term, in the red accent. Rendered
 * inside its own rail flyout kanban board.
 */
export function RecordsAttentionContent() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
  });

  const ranked = React.useMemo(() => {
    const students = (data?.sections ?? [])
      .flatMap((s) => s.students)
      .filter((s) => s.behavioral.length > 0);
    return [...students]
      .sort((a, b) => {
        const d = b.behavioral.length - a.behavioral.length;
        return d !== 0 ? d : highCount(b) - highCount(a);
      })
      .slice(0, TOP_STUDENTS);
  }, [data]);

  if (isPending) {
    return (
      <div className={styles.attentionSkel} aria-hidden>
        {Array.from({ length: TOP_STUDENTS }).map((_, i) => (
          <Skeleton key={i} className={styles.attentionSkelRow} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className={styles.empty}>Could not load student records.</p>;
  }

  if (ranked.length === 0) {
    return (
      <PrincipalEmptyState
        icon={ShieldAlert}
        title="All clear this term"
        hint="No learner is carrying an anecdotal record yet. New records will surface here once filed."
      />
    );
  }

  return (
    <ol className={styles.attentionRows} aria-label="Students with the heaviest record load">
      {ranked.map((s, i) => (
        <li key={s.lrn} className={styles.attentionRow}>
          <span className={styles.attentionRank} aria-hidden>
            {i + 1}
          </span>
          <span className={styles.attentionWho}>
            <span className={styles.attentionTop}>
              <span className={styles.attentionName}>{s.name}</span>
              <Pill tone="red" label="Records on file">
                {s.behavioral.length}
              </Pill>
            </span>
            <span className={styles.attentionTags}>
              <Pill label="LRN" className="tabular-nums">
                {s.lrn}
              </Pill>
              <Pill tone="amber" label="Section">
                {s.section}
              </Pill>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
