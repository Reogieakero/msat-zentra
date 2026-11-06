"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./case-page.module.css";
import skel from "./case-skeleton.module.css";

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

        <div className={styles.wizardLayout} style={{ marginTop: "1rem" }}>
          <div className={styles.wizardMain}>
            <div className={styles.tabBar} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  className={skel.badgeLg}
                  style={{ height: "2rem" }}
                />
              ))}
            </div>
            <div className={styles.instructCard} aria-hidden="true">
              <Skeleton className={skel.label} />
              <Skeleton className={skel.text} />
              <Skeleton className={skel.textShort} />
            </div>
            <div className={styles.card}>
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
            <div className={styles.stepFooter} aria-hidden="true">
              <Skeleton className={skel.badgeMd} />
              <Skeleton className={skel.badgeSm} />
              <Skeleton className={skel.badgeMd} />
            </div>
          </div>
          <div className={styles.wizardSide}>
            <div className={styles.checklistCard} aria-hidden="true">
              <p className={styles.cardTitle}>Eligibility checklist</p>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={skel.evidenceRow}>
                  <Skeleton className={skel.dot} />
                  <Skeleton className={skel.evidenceLabel} />
                  <Skeleton className={skel.badgeSm} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
