"use client";

import * as React from "react";
import { InsightCallout } from "@/components/ui/insight-callout";
import { StudentCard } from "./StudentCard";
import type { SectionSummary } from "@/services/principal/academics";
import styles from "./SectionStudentsTable.module.css";

interface SectionStudentsTableProps {
  section: SectionSummary;
  /** Filter text owned by the page toolbar, so the search sits with the header. */
  query: string;
}

/** Plain roster for one section — each student is its own small kanban board. */
export function SectionStudentsTable({ section, query }: SectionStudentsTableProps) {
  const students = section.students ?? [];

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (st) =>
        st.name.toLowerCase().includes(needle) ||
        (st.lrn ?? "").toLowerCase().includes(needle),
    );
  }, [students, query]);

  if (students.length === 0) {
    // Empty roster reads as a plain insight callout — same shape as the empty
    // section board, no card shell.
    return (
      <div className={styles.emptyCallout} aria-label={`Students of ${section.section}`}>
        <InsightCallout role="status">
          No students enrolled in <strong>{section.section}</strong>. Enrolled
          students will appear here once added.
        </InsightCallout>
      </div>
    );
  }

  return (
    <section className={styles.wrap} aria-label={`Students of ${section.section}`}>
      {filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((st) => (
            <StudentCard key={st.studentId} student={st} />
          ))}
        </div>
      ) : (
        <div className={styles.noMatch}>
          <InsightCallout role="status" className={styles.noMatchCallout}>
            <strong>No students match your search.</strong> Try a different name
            or LRN — or clear the filter to see everyone.
          </InsightCallout>
        </div>
      )}
    </section>
  );
}
