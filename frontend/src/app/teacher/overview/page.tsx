"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarClock, ClipboardCheck, Flag, Send } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import type { DayConfig } from "@/app/teacher/schedule/components/schedule-time";
import {
  TeacherOverviewHeader,
  TeacherOverviewRisk,
  TeacherOverviewUpNext,
} from "./components/teacher-overview-header";
import { TeacherOverviewActions } from "./components/teacher-overview-actions";
import { TeacherOverviewAnecdotes } from "./components/teacher-overview-anecdotes";
import { TeacherOverviewAttendanceTable } from "./components/teacher-overview-attendance-table";
import { TeacherOverviewClassStudents } from "./components/teacher-overview-class-students";
import { TeacherOverviewRiskTable } from "./components/teacher-overview-risk-table";
import { TeacherOverviewSkeleton } from "./components/teacher-overview-skeleton";
import {
  fetchTeacherOverviewGradebook,
  teacherOverviewGradebookKey,
  useTeacherOverview,
} from "@/services/teacher/overview.service";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/teacher-overview.module.css";

interface LinkedSlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
}

const ADVISER_QUICK_ACTIONS = [
  { title: "Take Attendance", description: "Record today's attendance", href: "/teacher/attendance", icon: CalendarClock },
  { title: "Enter Scores", description: "Log grades for your classes", href: "/teacher/grading", icon: ClipboardCheck },
  { title: "New Referral", description: "Refer from an anecdotal record", href: "/teacher/advisory/referrals", icon: Send },
];

const CLASS_QUICK_ACTIONS = [
  { title: "Take Attendance", description: "Record today's attendance", href: "/teacher/attendance", icon: CalendarClock },
  { title: "Enter Scores", description: "Log grades for your classes", href: "/teacher/grading", icon: ClipboardCheck },
  { title: "Flag Student", description: "Raise a concern for a student", href: "/teacher/grade-flags", icon: Flag },
  { title: "My Classes", description: "Open your class timetable", href: "/teacher/classes", icon: BookOpen },
];

export default function TeacherOverviewPage() {

  const { data, isPending, isError } = useTeacherOverview();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const queryClient = useQueryClient();
  const session = useSession();
  const prefetchTeacherId = session?.sub ?? null;
  React.useEffect(() => {
    if (!prefetchTeacherId) return;
    const run = () => {
      void queryClient.prefetchQuery({
        queryKey: teacherOverviewGradebookKey(prefetchTeacherId, termKey),
        queryFn: fetchTeacherOverviewGradebook,
        staleTime: 30_000,
      });
    };
    if (typeof window !== "undefined") {
      const idleWindow = window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof idleWindow.requestIdleCallback === "function") {
        const id = idleWindow.requestIdleCallback(run);
        return () => idleWindow.cancelIdleCallback?.(id);
      }
    }
  }, [queryClient, prefetchTeacherId, termKey]);

  const mySlotsQuery = useQuery({
    queryKey: ["teacher-my-slots", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: LinkedSlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
  });
  const configQuery = useQuery({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
      );
      return data;
    },
  });

  if (isPending) {
    return <TeacherOverviewSkeleton actions={ADVISER_QUICK_ACTIONS} />;
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load your overview.</p>
      </section>
    );
  }

  const isAdviser = !!data.advisorySection;
  const quickActions = isAdviser ? ADVISER_QUICK_ACTIONS : CLASS_QUICK_ACTIONS;
  const classStudents = data.classStudents ?? [];
  const studentCount = isAdviser ? data.advisory.students.length : classStudents.length;
  const atRiskFactors = isAdviser
    ? data.atRiskFactors
    : {
        academic: classStudents.filter((s) => s.flags.includes("academic")).length,
        attendance: classStudents.filter((s) => s.flags.includes("attendance")).length,
        behavioral: 0,
      };
  const atRiskStudents = isAdviser
    ? data.atRiskStudents
    : classStudents.filter((s) => s.riskLevel !== "Low").length;

  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <div className={styles.mainCol}>
          <TeacherOverviewActions actions={quickActions} />

          {isAdviser ? (
            <TeacherOverviewRiskTable students={data.advisory.students} />
          ) : (
            <TeacherOverviewClassStudents students={classStudents} />
          )}

          {data.advisorySection ? (
            <TeacherOverviewAttendanceTable sectionId={data.advisorySection.id} />
          ) : null}

          {isAdviser ? <TeacherOverviewAnecdotes /> : null}
        </div>

        <aside className={styles.sideCol} style={{ top: "4rem" }}>
          <TeacherOverviewHeader
            teacherName={data.teacherName}
            advisorySection={data.advisorySection}
            classCount={data.kpi.classCount}
            studentCount={studentCount}
          />

          <TeacherOverviewUpNext
            slots={mySlotsQuery.data?.slots ?? []}
            config={configQuery.data?.config ?? null}
          />

          <TeacherOverviewRisk
            atRiskFactors={atRiskFactors}
            atRiskStudents={atRiskStudents}
            studentCount={studentCount}
            populationLabel={isAdviser ? "advisees" : "students"}
            hideBehavioral={!isAdviser}
          />
        </aside>
      </div>
    </section>
  );
}
