"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TeacherOverviewHeader } from "./components/teacher-overview-header";
import { TeacherOverviewClasses } from "./components/teacher-overview-classes";
import { TeacherOverviewActivity } from "./components/teacher-overview-activity";
import { TeacherOverviewAdvisory } from "./components/teacher-overview-advisory";
import { TeacherOverviewActions } from "./components/teacher-overview-actions";
import { fetchTeacherOverview } from "./components/teacher-overview-data";
import styles from "./components/teacher-overview.module.css";

export default function TeacherOverviewPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["teacher-overview"],
    queryFn: fetchTeacherOverview,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelHeader}>
          <div className={styles.skelAvatar}>
            <Skeleton className={styles.skelAvatarInner} />
          </div>
          <div className={styles.skelIdentity}>
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelSubtitle} />
            <div className={styles.skelChips}>
              <Skeleton className={styles.skelChip} />
              <Skeleton className={styles.skelChip} />
              <Skeleton className={styles.skelChip} />
            </div>
          </div>
        </div>

        <hr className={styles.divider} />

        <div className={styles.body}>
          <div className={styles.mainCol}>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <div className={styles.skelCardList}>
                <Skeleton className={styles.skelRow} />
                <Skeleton className={styles.skelRow} />
                <Skeleton className={styles.skelRow} />
              </div>
            </div>
          </div>

          <aside className={styles.sideCol}>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <div className={styles.skelCardList}>
                <Skeleton className={styles.skelRow} />
                <Skeleton className={styles.skelRow} />
                <Skeleton className={styles.skelRow} />
              </div>
            </div>
          </aside>
        </div>

        <hr className={styles.divider} />

        <div className={styles.skelCard}>
          <Skeleton className={styles.skelCardTitle} />
          <div className={styles.skelCardList}>
            <Skeleton className={styles.skelRow} />
            <Skeleton className={styles.skelRow} />
            <Skeleton className={styles.skelRow} />
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load your overview.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <TeacherOverviewHeader
        teacherName={data.teacherName}
        advisorySection={data.advisorySection}
        classCount={data.kpi.classCount}
        studentCount={data.kpi.studentCount}
        atRiskFactors={data.atRiskFactors}
      />

      <hr className={styles.divider} />

      <div className={styles.body}>
        <div className={styles.mainCol}>
          <TeacherOverviewClasses classes={data.classes} />
        </div>

        <aside className={styles.sideCol}>
          <TeacherOverviewActions
            actions={[
              { title: "Enter Scores", description: "Log grades for your classes" },
              { title: "Take Attendance", description: "Record today's attendance" },
              { title: "Flag Student", description: "Raise a concern for an advisee" },
            ]}
          />
        </aside>
      </div>

      <hr className={styles.divider} />

      <div className={styles.advisoryBlock}>
        <TeacherOverviewAdvisory students={data.advisory.students} />
        <TeacherOverviewActivity activity={data.recentActivity} />
      </div>
    </section>
  );
}
