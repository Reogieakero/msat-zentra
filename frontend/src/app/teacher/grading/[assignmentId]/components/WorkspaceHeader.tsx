"use client";

import * as React from "react";
import { gradeLabel, type ClassAssignment } from "../../components/grading-data";
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
