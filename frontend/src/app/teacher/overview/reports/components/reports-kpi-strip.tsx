"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  Users,
} from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Pill } from "@/components/ui/pill";
import type { TeacherReportsPayload } from "@/services/teacher/reports.types";
import { formatGrade, formatPercent } from "./reports-format";
import { ReportsStatColumn } from "./reports-stat-column";
import styles from "./reports.module.css";

type Tone = "positive" | "warn" | "danger" | "muted";

function gradeTone(value: number | null): Tone | undefined {
  if (value == null) return "muted";
  if (value < 75) return "danger";
  if (value < 80) return "warn";
  return "positive";
}

function rateTone(value: number | null, cutoff = 0.8): Tone | undefined {
  if (value == null) return "muted";
  if (value < cutoff) return "danger";
  return "positive";
}

/**
 * Term KPIs as kanban stat columns — the same board chrome the principal,
 * coordinator, and registry overviews use (tinted column, KanbanBoardHeader,
 * number-first value card, mascot chip, pinned footer action).
 */
export function ReportsKpiStrip({ summary }: { summary: TeacherReportsPayload["summary"] }) {
  const incomplete = summary.assessments - summary.gradedAssessments;

  return (
    <section className={styles.statBoard} aria-label="Term report KPIs">
      <div className={styles.statGrid} style={{ ["--cols" as string]: 6 }}>
        <ReportsStatColumn
          icon={<BookOpen size={14} className="text-blue-500" />}
          title="Classes"
          value={String(summary.classes)}
          hint="Subject × section load"
          tooltip="Subject and section pairs you teach this term"
          valueTone={summary.classes === 0 ? "muted" : undefined}
          mascot={<StudentMascot name="Classes" character="cap" size={36} />}
          action={
            <Link className={styles.statBtn} href="/teacher/classes">
              Open classes
            </Link>
          }
        />
        <ReportsStatColumn
          icon={<Users size={14} className="text-emerald-600 dark:text-emerald-400" />}
          title="Learners"
          value={String(summary.learners)}
          hint="Unique learners in your classes"
          tooltip="Distinct learners enrolled across your classes"
          valueTone={summary.learners === 0 ? "muted" : undefined}
          mascot={<StudentMascot name="Learners" character="owl" size={36} />}
          action={
            <Link className={styles.statBtn} href="/teacher/overview/students">
              Open students
            </Link>
          }
        />
        <ReportsStatColumn
          icon={<GraduationCap size={14} className="text-violet-500" />}
          title="Class average"
          value={formatGrade(summary.transmutedAverage, 1)}
          hint={
            <span className={styles.chips}>
              <Pill tone="neutral" label="Computed average">
                Computed {formatGrade(summary.average, 1)}
              </Pill>
              <Pill
                tone={
                  summary.passRate == null
                    ? "neutral"
                    : summary.passRate >= 0.75
                      ? "green"
                      : summary.passRate > 0
                        ? "amber"
                        : "red"
                }
                label="Pass rate"
              >
                pass {formatPercent(summary.passRate)}
              </Pill>
            </span>
          }
          hintText={`Computed ${formatGrade(summary.average, 1)}, pass ${formatPercent(summary.passRate)}`}
          tooltip="DepEd transmuted average across your classes"
          valueTone={gradeTone(summary.transmutedAverage)}
          mascot={<StudentMascot name="Class average" character="scientist" size={36} />}
          action={
            <Link className={styles.statBtn} href="/teacher/grading">
              Open grading
            </Link>
          }
        />
        <ReportsStatColumn
          icon={<CalendarCheck size={14} className="text-teal-500" />}
          title="Attendance"
          value={formatPercent(summary.attendanceRate)}
          hint={`${summary.attendancePresent}/${summary.attendanceTotal} present this term`}
          tooltip="Present rate from per-subject attendance this term"
          valueTone={rateTone(summary.attendanceRate)}
          mascot={<StudentMascot name="Attendance" character="clockwork" size={36} />}
          action={
            <Link className={styles.statBtn} href="/teacher/attendance">
              Open attendance
            </Link>
          }
        />
        <ReportsStatColumn
          icon={<ClipboardList size={14} className="text-indigo-500" />}
          title="Assessments graded"
          value={`${summary.gradedAssessments}/${summary.assessments}`}
          hint={
            <span className={styles.chips}>
              <Pill
                tone={incomplete > 0 ? "amber" : "green"}
                label="Assessments not fully scored"
              >
                {incomplete} not fully scored
              </Pill>
            </span>
          }
          hintText={`${incomplete} not fully scored`}
          tooltip="Assessments fully scored out of all assessments"
          valueTone={incomplete > 0 ? "warn" : "positive"}
          mascot={<StudentMascot name="Assessments" character="postbot" size={36} />}
          action={
            <Link className={styles.statBtn} href="/teacher/grading">
              Finish grading
            </Link>
          }
        />
        <ReportsStatColumn
          icon={<AlertTriangle size={14} className="text-red-500" />}
          title="Learners at risk"
          value={String(summary.atRisk)}
          hint={
            <span className={styles.chips}>
              <Pill tone={summary.highRisk > 0 ? "red" : "green"} label="High risk learners">
                {summary.highRisk} high
              </Pill>
              <Pill tone={summary.openFlags > 0 ? "amber" : "neutral"} label="Open grade flags">
                {summary.openFlags} open flags
              </Pill>
            </span>
          }
          hintText={`${summary.highRisk} high, ${summary.openFlags} open flags`}
          tooltip="Learners flagged by the live risk engine this term"
          valueTone={summary.atRisk === 0 ? "positive" : "danger"}
          mascot={<StudentMascot name="Learners at risk" character="knight" size={36} />}
          action={
            <Link className={styles.statBtn} href="/teacher/overview/students">
              Review learners
            </Link>
          }
        />
      </div>
    </section>
  );
}
