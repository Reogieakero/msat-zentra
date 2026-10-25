"use client";

import * as React from "react";
import { SearchIcon, Users } from "lucide-react";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
import { Pill } from "@/components/ui/pill";
import { StudentCard } from "./StudentCard";
import type { SectionSummary } from "@/services/principal/academics";
import styles from "./SectionStudentsTable.module.css";

interface SectionStudentsTableProps {
  section: SectionSummary;
}

/** Plain roster for one section — each student is its own small kanban board. */
export function SectionStudentsTable({ section }: SectionStudentsTableProps) {
  const [query, setQuery] = React.useState("");

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
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>
          <Users size={14} aria-hidden="true" />
          <span className={styles.toolbarName}>{section.section}</span>
          <Pill tone="amber" label="Grade level">
            {section.grade}
          </Pill>
          <span className={styles.toolbarCount}>{students.length}</span>
        </span>
        <InputGroup className="max-w-40 shrink-0">
          <InputGroupInput
            placeholder="Filter students..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter students"
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
      </div>

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
