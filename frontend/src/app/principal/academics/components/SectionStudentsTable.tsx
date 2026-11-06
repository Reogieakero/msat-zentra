"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
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
    return (
      <PrincipalEmptyCard
        icon={Users}
        title="No students enrolled"
        hint={`No students enrolled in ${section.section}. Enrolled students will appear here once added.`}
        label={`Students of ${section.section}`}
      />
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
        <p className={styles.empty}>No students match your search.</p>
      )}
    </section>
  );
}
