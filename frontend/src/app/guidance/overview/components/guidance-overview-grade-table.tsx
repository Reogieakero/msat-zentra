"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { GuidanceEmptyState } from "../../components/GuidanceEmptyCard";
import type { GuidanceGradeAttentionRow } from "@/services/guidance/overview.types";
import styles from "./guidance-overview.module.css";

function levelBadge(level: GuidanceGradeAttentionRow["mostLevel"]) {
  if (level === "High") {
    return (
      <Pill tone="red" label="Most common risk level in this grade">
        High
      </Pill>
    );
  }
  if (level === "Moderate") {
    return (
      <Pill tone="amber" label="Most common risk level in this grade">
        Moderate
      </Pill>
    );
  }
  if (level === "Low") {
    return (
      <Pill tone="green" label="Most common risk level in this grade">
        Low
      </Pill>
    );
  }
  return <Pill label="No risk flags tripped in this grade">—</Pill>;
}

interface GuidanceOverviewGradeTableProps {
  rows: GuidanceGradeAttentionRow[];
}

/**
 * Grade attention board — the KanbanBoard shell (icon + title + count +
 * description) over one flat row per grade level: grade pill + name,
 * section-count and section pills, then the at-risk pill and most-level pill.
 * Every row links to the interventions queue.
 */
export function GuidanceOverviewGradeTable({
  rows,
}: GuidanceOverviewGradeTableProps) {
  const ranked = React.useMemo(
    () => [...rows].sort((a, b) => b.atRisk - a.atRisk),
    [rows],
  );
  const totalAtRisk = ranked.reduce((n, row) => n + row.atRisk, 0);
  const totalHigh = ranked.reduce((n, row) => n + row.high, 0);

  const interpretation = React.useMemo(() => {
    if (totalAtRisk === 0) {
      return "No students are currently flagged as at-risk in any grade level this term.";
    }
    const top = ranked[0];
    const hotspot =
      top.topSection !== "—" && top.topCount > 0
        ? `, concentrated in ${top.topSection} with ${top.topCount} students`
        : "";
    return `${totalAtRisk} are flagged at-risk, including ${totalHigh} high-risk. ${top.grade} needs the most attention with ${top.atRisk} flagged students${hotspot}.`;
  }, [ranked, totalAtRisk, totalHigh]);

  return (
    <KanbanBoard
      title="Grade levels needing attention"
      icon={
        <span className="text-primary" aria-hidden>
          <GraduationCap size={14} />
        </span>
      }
      count={<span className={styles.amberNumber}>{totalAtRisk}</span>}
      description="Live ranking — most at-risk students per grade this term."
      actions={
        <Link
          href="/guidance/interventions"
          className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          View all
        </Link>
      }
    >
      {ranked.length === 0 ? (
        <GuidanceEmptyState
          icon={GraduationCap}
          title="No grades to show"
          hint="Grade attention will appear here once students enroll."
        />
      ) : (
        <ul className={styles.caseList}>
          {ranked.map((row) => {
            const visibleSections = row.sectionsList.slice(0, 3);
            const hiddenSections = row.sectionsList.length - visibleSections.length;
            return (
              <li key={row.short} className={styles.caseRow}>
                <Link
                  href="/guidance/interventions"
                  className={styles.rowLink}
                  aria-label={`${row.grade}: ${row.atRisk} at-risk students — open interventions`}
                >
                  <div className={styles.caseInfo}>
                    <Pill
                      label="Grade level"
                      className="h-8 w-10 justify-center tabular-nums"
                    >
                      {row.short}
                    </Pill>
                    <p className={styles.cellMain}>{row.grade}</p>
                    <Pill label="Sections in this grade level">
                      {row.sections} section{row.sections === 1 ? "" : "s"}
                    </Pill>
                  </div>
                  <div className={styles.sectionGroup}>
                    {visibleSections.map((s) => (
                      <Pill key={s.name} label="At-risk students in this section">
                        {s.name}
                        <span
                          className="font-bold tabular-nums"
                          style={{ color: "var(--guidance-number)" }}
                        >
                          {s.atRisk}
                        </span>
                      </Pill>
                    ))}
                    {hiddenSections > 0 ? (
                      <Pill label="More sections not shown">+{hiddenSections}</Pill>
                    ) : null}
                  </div>
                  <div className={styles.cellActions}>
                    <Pill tone="amber" label="Students at risk in this grade level">
                      {row.atRisk} at risk
                    </Pill>
                    {levelBadge(row.mostLevel)}
                    <ChevronRight
                      size={15}
                      className="text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.interpretation}>
        <span className={styles.interpretationLabel}>What it means · </span>
        {interpretation}
      </p>
    </KanbanBoard>
  );
}
