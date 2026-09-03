"use client";

import * as React from "react";
import { BookOpen, Columns3 } from "lucide-react";
import styles from "./configure-section.module.css";

type Props = {
  onAddSubject: () => void;
  onAddSection: () => void;
};

export function ConfigureSection({ onAddSubject, onAddSection }: Props) {
  return (
    <div className={styles.grid}>
      <button type="button" className={styles.card} onClick={onAddSubject}>
        <span className={styles.iconWrap}>
          <BookOpen className={styles.icon} />
        </span>
        <span className={styles.cardBody}>
          <span className={styles.cardTitle}>Add Subject</span>
          <span className={styles.cardHint}>Create a subject for grades 7–10</span>
        </span>
      </button>

      <button type="button" className={styles.card} onClick={onAddSection}>
        <span className={styles.iconWrap}>
          <Columns3 className={styles.icon} />
        </span>
        <span className={styles.cardBody}>
          <span className={styles.cardTitle}>Add Section</span>
          <span className={styles.cardHint}>Create a class section with an adviser</span>
        </span>
      </button>
    </div>
  );
}
