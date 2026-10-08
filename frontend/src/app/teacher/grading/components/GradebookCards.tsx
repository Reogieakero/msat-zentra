"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  ClassAverageRow,
  SubjectAssessmentRow,
  TeacherClassRow,
} from "@/services/teacher/overview.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./GradebookCards.module.css";

type Props = {
  classes: TeacherClassRow[];
  assessments: SubjectAssessmentRow[];
  standings: ClassAverageRow[];
};

function subjectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

export function GradebookCards({ classes, assessments, standings }: Props) {
  if (classes.length === 0) {
    return (
      <p className={styles.empty}>
        No classes assigned yet — ask your registrar to assign your subjects and sections first.
      </p>
    );
  }

  return (
    <div className={assign.grid} role="group" aria-label="Gradebook subjects">
      {classes.map((c) => {
        const assessmentCount = assessments.filter(
          (a) => a.subject === c.subject && a.section === c.section
        ).length;
        const standing =
          standings.find((s) => s.subject === c.subject && s.section === c.section) ?? null;
        const pct =
          standing && standing.students > 0
            ? Math.round((standing.assessed / standing.students) * 100)
            : 0;
        return (
          <article key={c.id} className={assign.card} aria-label={`${c.subject} · ${c.section}`}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <span className={assign.cardHead}>
              <span className={assign.avatar} aria-hidden="true">
                {subjectInitials(c.subject)}
              </span>
              <span className={assign.cardTitleBlock}>
                <span className={assign.fieldLabel}>Subject</span>
                <span className={assign.itemName} title={c.subject}>
                  {c.subject}
                </span>
              </span>
              <span className={assign.claimMark}>
                <span className={assign.claimLabel}>
                  {c.section} · {c.gradeLevel}
                </span>
              </span>
            </span>
            <span className={assign.teacherBlock}>
              <span className={assign.fieldLabel}>Students</span>
              <span className={assign.itemTeacher}>{c.studentCount}</span>
            </span>
            <span className={assign.teacherBlock}>
              <span className={assign.fieldLabel}>Assessments</span>
              <span className={assign.itemTeacher}>{assessmentCount}</span>
            </span>
            <span className="relative">
              <span
                className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${standing?.assessed ?? 0} of ${standing?.students ?? c.studentCount} assessed`}
              >
                <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </span>
              <span className={assign.itemTerm}>
                {standing?.assessed ?? 0} of {standing?.students ?? c.studentCount} assessed
              </span>
            </span>
            <span className={`${assign.cardActions} justify-end`}>
              <Button asChild size="sm">
                <Link href={`/teacher/grading/${c.id}`}>Open workspace</Link>
              </Button>
            </span>
          </article>
        );
      })}
    </div>
  );
}
