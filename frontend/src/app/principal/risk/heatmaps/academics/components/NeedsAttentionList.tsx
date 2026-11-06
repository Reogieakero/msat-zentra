"use client";

import { ShieldAlert } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import type { AttentionItem } from "./types";
import styles from "./academics.module.css";

export function NeedsAttentionList({
  items,
  isPending,
  isNoData,
}: {
  items: AttentionItem[];
  isPending: boolean;
  isNoData?: boolean;
}) {
  const isEmpty = !isPending && items.length === 0;
  // Nothing needs attention: render nothing (no "All clear" card).
  if (isEmpty && !isNoData) return null;

  if (isPending) {
    return (
      <div className={styles.attentionGrid} aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.attentionCard}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <PrincipalEmptyState
        icon={ShieldAlert}
        title="No graded records"
        hint="No graded records for the active term. Grades will appear here once finalized."
      />
    );
  }

  return (
    <section className={styles.attentionSection} aria-label="Needs attention">
      <div className={styles.attentionSectionHead}>
        <span className={styles.attentionTitle}>
          <ShieldAlert size={14} aria-hidden="true" />
          Needs Attention
          <span className={styles.attentionCount}>{items.length}</span>
        </span>
        <span className={styles.attentionDesc}>
          Lowest section–subject averages below 75 for the active term.
        </span>
      </div>
      <div
        className={styles.attentionGrid}
        role="list"
        aria-label="Section-subject averages below 75"
      >
        {items.map((item) => (
          <article
            key={`${item.sectionId}::${item.subject}`}
            role="listitem"
            className={styles.attentionCard}
          >
            <div className={styles.attentionHead}>
              <span className={styles.attentionSectionName}>{item.section}</span>
              <Pill tone={item.avg < 75 ? "red" : "green"} label="Average">
                {item.avg}
              </Pill>
            </div>
            <span className={styles.attentionSubject}>{item.subject}</span>
            <div className={styles.attentionMeta}>
              <Pill tone="red" label="Below 75">
                {item.below} below 75
              </Pill>
              <Pill tone="amber" label="Graded">
                {item.graded} graded
              </Pill>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
