"use client";

import { gradeLabel } from "@/services/teacher/grading.compute";
import type { ClassAssignment } from "@/services/teacher/grading.types";
import styles from "./WorkspaceHeader.module.css";

type Props = {
  assignment: ClassAssignment;
  studentCount: number;
};

export function WorkspaceHeader({ assignment, studentCount }: Props) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>
        {assignment.subjectName} ({assignment.subjectCode})
      </h1>
      <p className={styles.subtitle}>
        {assignment.sectionName} · Grade {gradeLabel(assignment.gradeLevel)} · Term{" "}
        {assignment.termNumber} · {assignment.schoolYear} · {studentCount} student
        {studentCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
