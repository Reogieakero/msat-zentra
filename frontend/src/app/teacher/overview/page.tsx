"use client";

import * as React from "react";
import { useSession } from "@/lib/auth/useSession";
import { TeacherOverviewHeader } from "./components/teacher-overview-header";
import { TeacherOverviewClasses } from "./components/teacher-overview-classes";
import { TeacherOverviewAdvisory } from "./components/teacher-overview-advisory";
import { TeacherOverviewActions } from "./components/teacher-overview-actions";
import { TeacherOverviewActivity } from "./components/teacher-overview-activity";
import { MOCK_TEACHER_OVERVIEW } from "./components/teacher-overview-data";
import styles from "./components/teacher-overview.module.css";

export default function TeacherOverviewPage() {
  const session = useSession();
  const isAdviser = session?.role === "adviser";
  const data = MOCK_TEACHER_OVERVIEW;

  const adviserActions = [
    { title: "Add Anecdotal", description: "Write a new behavior or incident report for an advisee." },
    { title: "Entry Grade", description: "Open your advisory gradebook to encode or review scores." },
  ];

  return (
    <section className={styles.page}>
      <TeacherOverviewHeader />

      <hr className={styles.divider} />

      <TeacherOverviewClasses classes={data.classes} />

      {isAdviser && (
        <>
          <hr className={styles.divider} />
          <div className={styles.advisorySplit}>
            <TeacherOverviewAdvisory
              students={data.advisory.students}
              referrals={data.advisory.referrals}
              admCases={data.advisory.admCases}
            />
            <TeacherOverviewActions actions={adviserActions} />
          </div>
        </>
      )}

      <hr className={styles.divider} />

      <TeacherOverviewActivity activity={data.recentActivity} />
    </section>
  );
}