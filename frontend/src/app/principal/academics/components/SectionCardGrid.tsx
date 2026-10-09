"use client";

import * as React from "react";
import { Users, Flame, Gauge, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SectionSummary } from "@/services/principal/academics";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
import styles from "./SectionCardGrid.module.css";

interface SectionCardGridProps {
  sections: SectionSummary[];
  loading: boolean;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
}

export function SectionCardGrid({
  sections,
  loading,
  selectedSectionId,
  onSelectSection,
}: SectionCardGridProps) {
  const ordered = React.useMemo(
    () =>
      [...(sections ?? [])].sort((a, b) => {
        const grade = Number((a.grade ?? "").replace(/\D/g, "")) - Number((b.grade ?? "").replace(/\D/g, ""));
        if (grade !== 0) return grade;
        if (a.grade !== b.grade) return a.grade < b.grade ? -1 : 1;
        return (a.section ?? "").localeCompare(b.section ?? "");
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
        <PrincipalEmptyCard
          icon={BookOpen}
          title="No sections on file"
          hint="No sections on file for the active term. Sections will appear here once created."
          centered
        />
      ) : (
        <div className={styles.grid} aria-label="Sections">
          {ordered.map((s) => {
            const active = s.sectionId === selectedSectionId;
            return (
              <button
                key={s.sectionId}
                type="button"
                className={`${styles.cardBtn} ${active ? styles.cardActive : ""}`}
                onClick={() => onSelectSection(active ? null : s.sectionId)}
                aria-pressed={active}
                title={active ? `Hide students of ${s.section}` : `Show students of ${s.section}`}
              >
                <span className={`${styles.cardHead} relative`}>
                  <span className={styles.sectionName}>{s.section}</span>
                  <Badge variant="secondary" className={styles.gradeBadge}>
                    {s.grade}
                  </Badge>
                </span>
                <span className={`${styles.stats} relative`}>
                  <span className={styles.stat}>
                    <span className={`${styles.statIconChip} ${styles.statIconChipStudents}`}>
                      <Users className={styles.statIcon} aria-hidden />
                    </span>
                    <span className={styles.statValue}>{s.students?.length ?? 0}</span>
                    <span className={styles.statLabel}>Students</span>
                  </span>
                  <span className={styles.stat}>
                    <span className={`${styles.statIconChip} ${styles.statIconChipAvg}`}>
                      <Gauge className={styles.statIcon} aria-hidden />
                    </span>
                    <span className={styles.statValue}>{s.avgTransmuted}</span>
                    <span className={styles.statLabel}>Avg grade</span>
                  </span>
                  <span className={styles.stat}>
                    <span className={`${styles.statIconChip} ${styles.statIconChipRisk}`}>
                      <Flame className={styles.statIcon} aria-hidden />
                    </span>
                    <span className={styles.statValue}>{s.atRiskCount}</span>
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
