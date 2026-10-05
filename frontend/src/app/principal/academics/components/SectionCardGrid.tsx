"use client";

import * as React from "react";
import { Users, Flame, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SectionSummary } from "../academics-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./SectionCardGrid.module.css";

interface SectionCardGridProps {
  sections: SectionSummary[];
  loading: boolean;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
}

/* Section card grid — the primary navigation for the academics desk.
   Cards are ordered by grade level (Grade 7 → 12), then section name,
   so grades never look scrambled. Clicking a card selects it (click
   again to deselect); the students table renders only for the selected
   section. */
export function SectionCardGrid({
  sections,
  loading,
  selectedSectionId,
  onSelectSection,
}: SectionCardGridProps) {
  const ordered = React.useMemo(
    () =>
      [...sections].sort((a, b) => {
        const grade = Number(a.grade.replace(/\D/g, "")) - Number(b.grade.replace(/\D/g, ""));
        if (grade !== 0) return grade;
        if (a.grade !== b.grade) return a.grade < b.grade ? -1 : 1;
        return a.section.localeCompare(b.section);
      }),
    [sections],
  );

  return (
    <div className={styles.wrap}>
      {loading && sections.length === 0 ? (
        <div className={styles.grid} aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className={styles.empty}>No sections on file.</p>
      ) : (
        <div className={styles.grid} aria-label="Sections">
          {ordered.map((s) => {
            const active = s.sectionId === selectedSectionId;
            return (
              <button
                key={s.sectionId}
                type="button"
                className={`${assign.card} ${styles.cardBtn} ${active ? styles.cardActive : ""}`}
                onClick={() => onSelectSection(active ? null : s.sectionId)}
                aria-pressed={active}
                title={active ? `Hide students of ${s.section}` : `Show students of ${s.section}`}
              >
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <span className={`${styles.cardHead} relative`}>
                  <span className={styles.sectionName}>{s.section}</span>
                  <Badge variant="secondary" className={styles.gradeBadge}>
                    {s.grade}
                  </Badge>
                </span>
                <span className={`${styles.stats} relative`}>
                  <span className={styles.stat}>
                    <span className={styles.statTop}>
                      <Users className={styles.statIcon} aria-hidden />
                      <span className={styles.statValue}>{s.students.length}</span>
                    </span>
                    <span className={styles.statLabel}>Students</span>
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statTop}>
                      <Gauge className={styles.statIcon} aria-hidden />
                      <span className={styles.statValue}>{s.avgTransmuted}</span>
                    </span>
                    <span className={styles.statLabel}>Avg grade</span>
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statTop}>
                      <Flame className={styles.statIcon} aria-hidden />
                      <span className={styles.statValue}>{s.atRiskCount}</span>
                    </span>
                    <span className={styles.statLabel}>At risk</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
