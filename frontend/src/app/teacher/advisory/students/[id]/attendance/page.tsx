"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AttendanceCalendar } from "./components/AttendanceCalendar";
import { fetchStudentAttendance } from "./components/attendance-data";
import styles from "./components/attendance.module.css";

export default function StudentAttendancePage() {
  const params = useParams<{ id: string }>();
  const studentId = decodeURIComponent(params.id);
  const attendanceQuery = useQuery({
    queryKey: ["advisee-attendance", studentId],
    queryFn: () => fetchStudentAttendance(studentId),
    retry: false,
  });
  const student = attendanceQuery.data?.student ?? null;
  const termStart = attendanceQuery.data?.termStart ?? null;

  return (
    <section className={styles.page}>
      <Link href="/teacher/advisory/students" className={styles.backLink}>
        <ChevronLeft aria-hidden />
        Advisees
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>
          {attendanceQuery.isPending ? "Attendance" : (student?.name ?? "Attendance")}
        </h1>
        <p className={styles.subtitle}>
          {student ? `${student.lrn} · ${student.section}` : "Daily AM/PM attendance for this term."}
          {termStart
            ? ` · every school day since ${new Date(termStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : ""}
        </p>
      </div>
      <hr className={styles.divider} />

      <div className={styles.body}>
        {attendanceQuery.isError ? (
          <p className={styles.error}>
            These records are unavailable — the student may not be in your advisory.
          </p>
        ) : (
          <AttendanceCalendar
            summary={attendanceQuery.data?.summary ?? null}
            days={attendanceQuery.data?.days ?? []}
            loading={attendanceQuery.isPending}
          />
        )}
      </div>
    </section>
  );
}
