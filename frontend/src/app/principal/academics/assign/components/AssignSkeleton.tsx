"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./sections-kanban.module.css";

const SKELETON_CARDS = 8;

export function AssignSkeleton() {
  return (
    <div
      className={styles.skelShell}
      role="status"
      aria-label="Loading sections"
      aria-busy="true"
    >
      <div className={styles.toolbar} aria-hidden="true">
        <div className={styles.toolbarText}>
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelDescription} />
        </div>
        <Skeleton className={styles.skelFilter} />
        <div className={styles.toolbarEnd}>
          <Skeleton className={styles.skelButton} />
        </div>
      </div>
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHead}>
              <Skeleton className={styles.skelAvatar} />
              <div className={styles.cardId}>
                <Skeleton className={styles.skelName} />
                <Skeleton className={styles.skelTeacher} />
              </div>
              <Skeleton className={styles.skelPill} />
            </div>
            <div className={styles.metaRow}>
              <Skeleton className={styles.skelPill} />
            </div>
            <div className={styles.cardActions}>
              <Skeleton className={styles.skelAction} />
              <Skeleton className={styles.skelAction} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
