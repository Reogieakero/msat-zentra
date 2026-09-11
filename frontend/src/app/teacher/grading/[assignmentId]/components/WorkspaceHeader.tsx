"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { gradeLabel, type ClassAssignment } from "../../components/grading-data";
import styles from "./WorkspaceHeader.module.css";

type Props = {
  assignment: ClassAssignment;
  studentCount: number;
  onOpenWeights: () => void;
  onAddAssessment: () => void;
};

export function WorkspaceHeader({ assignment, studentCount, onOpenWeights, onAddAssessment }: Props) {
  return (
    <div className={styles.headerRow}>
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
      <div className={styles.actions}>
        <Button variant="outline" onClick={onOpenWeights}>
          Weights
        </Button>
        <Button onClick={onAddAssessment}>Add assessment</Button>
        <Button variant="outline" asChild>
          <a href={`/record/${assignment.id}`} target="_blank" rel="noopener noreferrer">
            Class record
          </a>
        </Button>
      </div>
    </div>
  );
}
