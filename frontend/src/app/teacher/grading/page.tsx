"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTeacherOverview } from "../overview/components/teacher-overview-data";
import { GradebookKpis } from "./components/GradebookKpis";
import { GradebookCards } from "./components/GradebookCards";
import styles from "./components/gradebook.module.css";

export default function TeacherGradebookPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["teacher-overview"],
    queryFn: fetchTeacherOverview,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading gradebook">
        <div className={styles.header}>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className={styles.skelGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={styles.skelCard} />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Gradebook</h1>
          <p className={styles.subtitle}>Your assigned classes for the active term.</p>
        </div>
        <p className={styles.error}>Could not load your gradebook. Check your connection and try again.</p>
      </section>
    );
  }

  const totalAssessed = data.subjectClasses.standings.reduce((s, r) => s + r.assessed, 0);
  const totalStudents = data.subjectClasses.standings.reduce((s, r) => s + r.students, 0);
  const overallPct = totalStudents > 0 ? Math.round((totalAssessed / totalStudents) * 100) : 0;

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Gradebook</h1>
        <p className={styles.subtitle}>
          Your assigned classes, assessments, and class standings for the active term.
        </p>
      </div>

      <GradebookKpis kpi={data.kpi} assessedPct={overallPct} />
      <GradebookCards
        classes={data.classes}
        assessments={data.subjectClasses.assessments}
        standings={data.subjectClasses.standings}
      />
    </section>
  );
}
