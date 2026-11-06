"use client";

import {
  CalendarDays,
  CalendarClock,
  GraduationCap,
  Signal,
  UserRound,
} from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Pill } from "@/components/ui/pill";
import { useTerm } from "@/lib/term/TermContext";
import type { TeacherReportsPayload } from "@/services/teacher/reports.types";
import { formatDate, formatRange, termStatus } from "./reports-format";
import { ReportsStatColumn } from "./reports-stat-column";
import styles from "./reports.module.css";

/**
 * Report scope as a kanban stat board (same column chrome as the other role
 * overviews). The term is the global teacher scope: switching it here changes
 * the term every teacher page reads, not just this report.
 */
export function ReportsScopeBar({ data }: { data: TeacherReportsPayload }) {
  const { activeTerm } = useTerm();
  const term = data.term;
  const status = term ? termStatus(term.startDate, term.endDate) : null;
  const teacher = data.teacher;

  const schoolYear = term?.schoolYearName ?? activeTerm?.schoolYearName ?? "School year";
  const teacherHint = `${teacher.code ? `Code ${teacher.code}` : "No linked code"}, ${
    teacher.isMasterTeacher ? "Master teacher" : "Subject teacher"
  }`;
  const advisoryHint = teacher.advisorySection
    ? `${teacher.advisorySection.gradeLevel}, Adviser`
    : "No advisory section this term";

  return (
    <section className={styles.statBoard} aria-label="Report scope">
      <div className={styles.statGrid} style={{ ["--cols" as string]: 5 }}>
        <ReportsStatColumn
          icon={<CalendarDays size={14} />}
          title="Term"
          value={term ? `Term ${term.termNumber}` : "No term"}
          hint={schoolYear}
          tooltip="Active term this report covers"
          valueTone={term ? undefined : "muted"}
          mascot={<StudentMascot name="Term" character="clockwork" size={36} />}
        />
        <ReportsStatColumn
          icon={<Signal size={14} />}
          title="Status"
          value={status ?? "—"}
          hint={term ? formatRange(term.startDate, term.endDate) : "Choose a term to scope this report"}
          tooltip="Where the term sits against today's date"
          valueTone={status === "Ongoing" ? "positive" : status === "Upcoming" ? "warn" : "muted"}
          mascot={<StudentMascot name="Status" character="lantern" size={36} />}
        />
        <ReportsStatColumn
          icon={<UserRound size={14} />}
          title="Teacher"
          value={teacher.name || "—"}
          hint={
            <span className={styles.chips}>
              <Pill tone="neutral" label="Teacher code">
                {teacher.code ? `Code ${teacher.code}` : "No linked code"}
              </Pill>
              <Pill tone={teacher.isMasterTeacher ? "blue" : "neutral"} label="Staff role">
                {teacher.isMasterTeacher ? "Master teacher" : "Subject teacher"}
              </Pill>
            </span>
          }
          hintText={teacherHint}
          tooltip="Signed-in teacher this report was generated for"
          valueSize="text"
          mascot={<StudentMascot name={teacher.name || "Teacher"} character="knight" size={36} />}
        />
        <ReportsStatColumn
          icon={<GraduationCap size={14} />}
          title="Advisory"
          value={teacher.advisorySection?.name ?? "—"}
          hint={
            teacher.advisorySection ? (
              <span className={styles.chips}>
                <Pill tone="neutral" label="Grade level">
                  {teacher.advisorySection.gradeLevel}
                </Pill>
                <Pill tone="violet" label="Role">
                  Adviser
                </Pill>
              </span>
            ) : (
              "No advisory section this term"
            )
          }
          hintText={advisoryHint}
          tooltip="Advisory section assigned to you this term"
          valueSize="text"
          valueTone={teacher.advisorySection ? undefined : "muted"}
          mascot={<StudentMascot name="Advisory" character="cap" size={36} />}
        />
        <ReportsStatColumn
          icon={<CalendarClock size={14} />}
          title="Snapshot"
          value={formatDate(data.generatedAt)}
          hint="Report generated for this term"
          tooltip="Date these numbers were generated"
          valueSize="text"
          mascot={<StudentMascot name="Snapshot" character="owl" size={36} />}
        />
      </div>
    </section>
  );
}
