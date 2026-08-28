"use client";

import * as React from "react";
import { type SectionSummary } from "../academics-data";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./AverageGradeByLevel.module.css";
import shared from "../academics.module.css";

interface Props {
  sections: SectionSummary[];
  subjects: string[];
  activeGrade: string;
  activeSectionId: string | null;
  loading?: boolean;
}

export function AverageGradeByLevel({
  sections,
  subjects,
  activeGrade,
  activeSectionId,
  loading,
}: Props) {
  const rows = React.useMemo(() => {
    const scoped = sections.filter((s) => s.grade === activeGrade);
    const subjMap = new Map<string, number[]>();
    for (const s of scoped) {
      if (activeSectionId && s.sectionId !== activeSectionId) continue;
      for (const st of s.students) {
        for (const sub of st.subjects) {
          const arr = subjMap.get(sub.subject) ?? [];
          arr.push(sub.transmutedGrade);
          subjMap.set(sub.subject, arr);
        }
      }
    }

    return subjects.map((subj) => {
      const vals = subjMap.get(subj) ?? [];
      const average =
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : 0;
      return { subject: subj, average, count: vals.length };
    });
  }, [sections, subjects, activeGrade, activeSectionId]);

  if (loading) {
    return (
      <div className={styles.avgLevel}>
        <div className={styles.avgLevelSubs}>
          {(subjects.length > 0 ? subjects : Array.from({ length: 9 }, (_, i) => i)).map(
            (subj, i) => (
              <div key={typeof subj === "string" ? subj : i} className={styles.avgLevelRow}>
                <Skeleton className={styles.avgLevelSubjSkeleton} />
                <Skeleton className={styles.avgLevelTrack} />
                <Skeleton className={styles.avgLevelValSkeleton} />
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className={shared.empty}>No finalized grades for this term.</p>;
  }

  return (
    <div className={styles.avgLevel}>
      <p className={styles.avgLevelScope}>
        {activeGrade.replace("Grade ", "Grade ")}
        {activeSectionId
          ? ` · ${sections.find((s) => s.sectionId === activeSectionId)?.section ?? ""}`
          : " · All sections"}
      </p>
      <div className={styles.avgLevelSubs}>
        {rows.map((s) => (
          <div key={s.subject} className={styles.avgLevelRow}>
            <span className={styles.avgLevelSubj}>{s.subject}</span>
            <div className={styles.avgLevelTrack}>
              <div
                className={styles.avgLevelFill}
                style={{ width: `${s.average}%` }}
              />
            </div>
            <span className={`${styles.avgLevelVal} ${shared.mono}`}>
              {s.average.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
