"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./case-page.module.css";
import skel from "./case-skeleton.module.css";

/* Detail loading state that mirrors the case file layout 1:1 — back
   button, header card (student name, LRN/grade/stage/eligibility lines,
   badge row, referred-by notes), then the card grid (full-span anecdotal
   file with folder + KPI tiles, recommendations, GC Form 03, evidence
   chain, parent meetings) — so skeleton → content swaps with minimal
   layout shift. Titles stay readable; only values shimmer. */
export function CoordinatorCaseSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading case file">
      <div aria-hidden="true">
        <Skeleton className={skel.backBtn} />
        <div className={styles.header} style={{ marginTop: "1rem" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Skeleton className={skel.name} />
            <Skeleton className={skel.line} />
            <Skeleton className={skel.lineShort} />
            <Skeleton className={skel.line} />
            <Skeleton className={skel.lineShort} />
            <div className={styles.badgeRow}>
              <Skeleton className={skel.badgeSm} />
              <Skeleton className={skel.badgeLg} />
              <Skeleton className={skel.badgeMd} />
            </div>
          </div>
          <div className={skel.headerNotes}>
            <Skeleton className={skel.note} />
            <Skeleton className={skel.noteShort} />
          </div>
        </div>

        <div className={styles.grid} style={{ marginTop: "1rem" }}>
          <div className={`${styles.card} ${styles.spanFull}`}>
            <p className={styles.cardTitle}>Anecdotal report</p>
            <div className={styles.fileLayout}>
              <div className={styles.fileSide}>
                <Skeleton className={skel.folder} />
                <Skeleton className={skel.hint} />
              </div>
              <div className={styles.kpiGrid}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={styles.kpi}>
                    <Skeleton className={skel.kpiLabel} />
                    <Skeleton className={skel.kpiValue} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>Recommendations</p>
            <Skeleton className={skel.label} />
            <Skeleton className={skel.text} />
            <Skeleton className={skel.textShort} />
            <Skeleton className={skel.label} />
            <Skeleton className={skel.text} />
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>GC Form 03 · Referral form</p>
            <div className={styles.fileLayout}>
              <div className={styles.fileSide}>
                <Skeleton className={skel.folder} />
                <Skeleton className={skel.hint} />
              </div>
              <div className={styles.kpiGrid}>
                <div className={styles.kpi}>
                  <Skeleton className={skel.kpiLabel} />
                  <Skeleton className={skel.kpiValue} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>Evidence chain</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className={skel.evidenceRow}>
                <Skeleton className={skel.dot} />
                <Skeleton className={skel.evidenceLabel} />
                <Skeleton className={skel.badgeSm} />
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>Parent meetings</p>
            {[0, 1].map((i) => (
              <div key={i} className={skel.meetingRow}>
                <div className={styles.badgeRow} style={{ marginTop: 0 }}>
                  <Skeleton className={skel.badgeMd} />
                  <Skeleton className={skel.badgeSm} />
                </div>
                <Skeleton className={skel.text} />
                <Skeleton className={skel.textShort} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
