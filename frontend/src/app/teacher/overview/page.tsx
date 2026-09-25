"use client";

import { CalendarClock, ClipboardCheck, Flag, Send } from "lucide-react";
import { TeacherOverviewHeader } from "./components/teacher-overview-header";
import { TeacherOverviewAdvisory } from "./components/teacher-overview-advisory";
import { TeacherOverviewActions } from "./components/teacher-overview-actions";
import { TeacherOverviewSkeleton } from "./components/teacher-overview-skeleton";
import { useTeacherOverview } from "./components/teacher-overview-data";
import styles from "./components/teacher-overview.module.css";

const QUICK_ACTIONS = [
  { title: "Take Attendance", description: "Record today's attendance", href: "/teacher/attendance", icon: CalendarClock },
  { title: "Enter Scores", description: "Log grades for your classes", href: "/teacher/grading", icon: ClipboardCheck },
  { title: "Flag Student", description: "Raise a concern for an advisee", href: "/teacher/grade-flags", icon: Flag },
  { title: "New Referral", description: "Refer from an anecdotal record", href: "/teacher/advisory/referrals", icon: Send },
];

export default function TeacherOverviewPage() {
  // Teacher-scoped key: cached data renders instantly when navigating back,
  // and one teacher's overview can never leak to another teacher's session.
  // Stale data (>30s) refetches silently in the background — the loaded UI
  // stays visible, so isPending below is only true on a genuine first load.
  const { data, isPending, isError } = useTeacherOverview();

  if (isPending) {
    return <TeacherOverviewSkeleton actions={QUICK_ACTIONS} />;
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
      <div className={styles.body}>
        <aside className={styles.sideCol}>
          <TeacherOverviewHeader
            teacherName={data.teacherName}
            advisorySection={data.advisorySection}
            classCount={data.kpi.classCount}
            studentCount={data.kpi.studentCount}
            atRiskFactors={data.atRiskFactors}
            atRiskStudents={data.atRiskStudents}
            classes={data.classes}
            rail
          />

          <TeacherOverviewActions actions={QUICK_ACTIONS} compact />
        </aside>

        <div className={styles.mainCol}>
          <TeacherOverviewAdvisory students={data.advisory.students} />
        </div>
      </div>
    </section>
  );
}
