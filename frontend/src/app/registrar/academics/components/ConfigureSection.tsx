import * as React from "react";
import { ArrowLeftRight, BookOpen, Columns3 } from "lucide-react";
import styles from "./configure-section.module.css";

type Props = {
  onAddSubject: () => void;
  onAddSection: () => void;
  onAssignSubjects: () => void;
  orientation?: "horizontal" | "vertical";
};

export function ConfigureSection({ onAddSubject, onAddSection, onAssignSubjects, orientation = "horizontal" }: Props) {
  return (
    <div className={`${styles.grid} ${orientation === "vertical" ? styles.gridVertical : ""}`}>
      <button type="button" className={styles.card} onClick={onAddSubject}>
        <span className={styles.iconWrap}>
          <BookOpen className={styles.icon} />
        </span>
        <span className={styles.cardBody}>
          <span className={styles.cardTitle}>Add Subject</span>
          <span className={styles.cardHint}>Create a subject for grades 11–12</span>
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

      <button type="button" className={styles.card} onClick={onAssignSubjects}>
        <span className={styles.iconWrap}>
          <ArrowLeftRight className={styles.icon} />
        </span>
        <span className={styles.cardBody}>
          <span className={styles.cardTitle}>Assign Subjects</span>
          <span className={styles.cardHint}>Assign subjects + teachers to a section</span>
        </span>
      </button>
    </div>
  );
}
