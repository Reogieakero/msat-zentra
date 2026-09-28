"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ClipboardCheck, Flag, Send } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useLinksLayout } from "@/lib/links-layout";
import type { DayConfig } from "@/app/teacher/schedule/components/schedule-time";
import {
  TeacherOverviewHeader,
  TeacherOverviewRisk,
  TeacherOverviewUpNext,
} from "./components/teacher-overview-header";
import { TeacherOverviewActions } from "./components/teacher-overview-actions";
import { TeacherOverviewAnecdotes } from "./components/teacher-overview-anecdotes";
import { TeacherOverviewAttendanceTable } from "./components/teacher-overview-attendance-table";
import { TeacherOverviewRiskTable } from "./components/teacher-overview-risk-table";
import { TeacherOverviewSkeleton } from "./components/teacher-overview-skeleton";
import { useTeacherOverview } from "./components/teacher-overview-data";
import styles from "./components/teacher-overview.module.css";

interface LinkedSlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
}

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
  // Rail pins 16px below the chrome: 4rem under the lone topbar in sidebar
  // mode, 7rem under the topbar + tab bar in navbar mode.
  const [linksLayout] = useLinksLayout();
  const mySlotsQuery = useQuery({
    queryKey: ["teacher-my-slots"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: LinkedSlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
  });
  const configQuery = useQuery({
    queryKey: ["teacher-schedule-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
      );
      return data;
    },
  });

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
        <div className={styles.mainCol}>
          <TeacherOverviewActions actions={QUICK_ACTIONS} />

          <TeacherOverviewRiskTable students={data.advisory.students} />

          {data.advisorySection ? (
            <TeacherOverviewAttendanceTable sectionId={data.advisorySection.id} />
          ) : null}

          <TeacherOverviewAnecdotes />
        </div>

        <aside
          className={styles.sideCol}
          style={linksLayout === "sidebar" ? { top: "4rem" } : undefined}
        >
          <TeacherOverviewHeader
            teacherName={data.teacherName}
            advisorySection={data.advisorySection}
            classCount={data.kpi.classCount}
            studentCount={data.kpi.studentCount}
          />

          <TeacherOverviewUpNext
            slots={mySlotsQuery.data?.slots ?? []}
            config={configQuery.data?.config ?? null}
          />

          <TeacherOverviewRisk
            atRiskFactors={data.atRiskFactors}
            atRiskStudents={data.atRiskStudents}
            studentCount={data.advisory.students.length}
          />
        </aside>
      </div>
    </section>
  );
}
