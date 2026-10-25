"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GRADES } from "./sections-kanban";
import styles from "./sections-kanban.module.css";

const SKELETON_CARDS = 2;

export function AssignSkeleton() {
  return (
    <div role="status" aria-label="Loading sections" aria-busy="true">
      <div className={styles.skelShell} aria-hidden="true">
        <div className={styles.skelHeaderRow}>
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelPill} />
        </div>
        <div className={styles.lanes}>
          {GRADES.map((g) => (
            <div key={g} className={styles.skelLane}>
              <div className={styles.skelLaneHead}>
                <Skeleton className={styles.skelLaneTitle} />
                <Skeleton className={styles.skelCount} />
              </div>
              {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
                <div key={i} className={styles.skelCard}>
                  <div className={styles.cardTop}>
                    <Skeleton className={styles.skelAvatar} />
                    <Skeleton className={styles.skelName} />
                  </div>
                  <Skeleton className={styles.skelTeacher} />
                  <div className={styles.cardActions}>
                    <Skeleton className={styles.skelAction} />
                    <Skeleton className={styles.skelAction} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
