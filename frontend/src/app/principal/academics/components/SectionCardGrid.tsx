"use client";

import * as React from "react";
import { Users, Flame, Gauge, BookOpen, ShieldAlert, ShieldCheck } from "lucide-react";
import { Pill } from "@/components/ui/pill";
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
        // Each card is its own mini kanban board: header row (section + grade)
        // over an inner panel holding the metric lane.
        <div className={styles.grid} aria-label="Sections">
          {ordered.map((s) => {
            const active = s.sectionId === selectedSectionId;
            const avg = Number(s.avgTransmuted);
            const avgTone = !Number.isFinite(avg)
              ? "neutral"
              : avg < 75
                ? "red"
                : avg < 80
                  ? "amber"
                  : "green";
            return (
              <button
                key={s.sectionId}
                type="button"
                className={`${styles.cardBtn} ${active ? styles.cardActive : ""}`}
                onClick={() => onSelectSection(active ? null : s.sectionId)}
                aria-pressed={active}
                title={active ? `Hide students of ${s.section}` : `Show students of ${s.section}`}
              >
                <span className={styles.cardHead}>
                  <span className={styles.cardHeading}>
                    <span className={styles.sectionName}>{s.section}</span>
                    <Pill tone="neutral" label="Grade level" className={styles.gradeBadge}>
                      {s.grade}
                    </Pill>
                  </span>
                  <Pill
                    tone={s.shared === true ? "green" : "amber"}
                    label="Data source"
                    className={styles.sourceBadge}
                  >
                    {s.shared === true ? (
                      <ShieldCheck size={11} aria-hidden />
                    ) : (
                      <ShieldAlert size={11} aria-hidden />
                    )}
                    {s.shared === true ? "Adviser shared" : "Not shared"}
                  </Pill>
                </span>
                <span className={styles.cardPanel}>
                  {/* Only an explicit `shared: true` unlocks metrics — an old
                      cached payload without the flag stays gated. */}
                  {s.shared !== true ? (
                    <span className={styles.unshared}>
                      <ShieldAlert className={styles.unsharedIcon} aria-hidden />
                      Adviser hasn&apos;t shared student data
                    </span>
                  ) : (
                    <>
                      <span className={styles.stat}>
                        <span className={`${styles.statIconChip} ${styles.statIconChipStudents}`}>
                          <Users className={styles.statIcon} aria-hidden />
                        </span>
                        <Pill tone="blue" label="Students" className={`${styles.statPill} tabular-nums`}>
                          {s.students?.length ?? 0}
                        </Pill>
                        <span className={styles.statLabel}>Students</span>
                      </span>
                      <span className={styles.stat}>
                        <span className={`${styles.statIconChip} ${styles.statIconChipAvg}`}>
                          <Gauge className={styles.statIcon} aria-hidden />
                        </span>
                        <Pill tone={avgTone} label="Average transmuted grade" className={`${styles.statPill} tabular-nums`}>
                          {s.avgTransmuted}
                        </Pill>
                        <span className={styles.statLabel}>Avg grade</span>
                      </span>
                      <span className={styles.stat}>
                        <span className={`${styles.statIconChip} ${styles.statIconChipRisk}`}>
                          <Flame className={styles.statIcon} aria-hidden />
                        </span>
                        <Pill
                          tone={s.atRiskCount > 0 ? "red" : "neutral"}
                          label="Students at risk"
                          className={`${styles.statPill} tabular-nums`}
                        >
                          {s.atRiskCount}
                        </Pill>
                        <span className={styles.statLabel}>At risk</span>
                      </span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
