"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  COMPONENT_NAMES,
  COMPONENT_ORDER,
  type ClassDetail,
  type ClassStudent,
  type ComponentType,
} from "../../../grading/components/grading-data";
import styles from "./StudentGradesSheet.module.css";

const DOT: Record<ComponentType, string> = {
  WRITTEN_WORK: styles.dotWW,
  PERFORMANCE_TASK: styles.dotPT,
  QUARTERLY_EXAM: styles.dotQE,
};

const SHORT: Record<ComponentType, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

interface AssessmentGrade {
  key: string;
  sectionName: string;
  type: ComponentType;
  title: string;
  dateGiven: string;
  maxScore: number;
  raw: number | null;
}

interface StudentGradesSheetProps {
  student: ClassStudent;
  details: ClassDetail[];
  onClose: () => void;
}

export function StudentGradesSheet({ student, details, onClose }: StudentGradesSheetProps) {
  const grades: AssessmentGrade[] = React.useMemo(
    () =>
      details.flatMap((d) =>
        d.components.flatMap((c) =>
          c.assessments.map((a) => ({
            key: `${d.assignment.id}-${a.id}`,
            sectionName: d.assignment.sectionName,
            type: c.type,
            title: a.title,
            dateGiven: a.dateGiven,
            maxScore: a.maxScore,
            raw: a.scores[student.id] ?? null,
          }))
        )
      ),
    [details, student.id]
  );

  const multiSection = new Set(grades.map((g) => g.sectionName)).size > 1;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className={styles.sheet}>
        <SheetHeader className={styles.sheetHead}>
          <SheetTitle>{student.name}</SheetTitle>
          <SheetDescription>{student.lrn}</SheetDescription>
        </SheetHeader>

        <div className={styles.body}>
          {grades.length === 0 ? (
            <p className={styles.empty}>No assessments recorded yet.</p>
          ) : (
            COMPONENT_ORDER.map((t) => {
              const list = grades.filter((g) => g.type === t);
              if (list.length === 0) return null;
              return (
                <section key={t} className={styles.group}>
                  <h3 className={styles.groupTitle}>
                    {SHORT[t]} {COMPONENT_NAMES[t]}
                    <span className={styles.groupCount}>{list.length}</span>
                  </h3>
                  <ul className={styles.list}>
                    {list.map((g) => (
                      <li key={g.key} className={styles.row}>
                        <span className={`${styles.dot} ${DOT[g.type]}`} aria-hidden />
                        <span className={styles.rowText}>
                          <span className={styles.rowTitle}>{g.title}</span>
                          <span className={styles.rowMeta}>
                            {multiSection ? `${g.sectionName}, given ` : "Given "}
                            {g.dateGiven}
                          </span>
                        </span>
                        <span className={styles.rowScore}>
                          <span className={styles.rowScoreValue}>
                            {g.raw == null ? "—" : g.raw}
                            <span className={styles.rowScoreMax}>/{g.maxScore}</span>
                          </span>
                          <span className={styles.rowScorePct}>
                            {g.raw == null || g.maxScore <= 0
                              ? "—"
                              : `${((g.raw / g.maxScore) * 100).toFixed(1)}%`}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
