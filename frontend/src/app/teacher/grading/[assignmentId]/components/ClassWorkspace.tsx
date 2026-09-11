"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRefreshAcademic, type ClassDetail } from "../../components/grading-data";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { AddAssessmentDialog } from "./AddAssessmentDialog";
import { ScoreGrid } from "./ScoreGrid";
import { FinalsCard } from "./FinalsCard";
import { WeightsDialog } from "./WeightsDialog";
import { SolutionDialog } from "./SolutionDialog";
import styles from "./ClassWorkspace.module.css";

type Props = {
  detail: ClassDetail;
  onMutated: () => void;
};

export function ClassWorkspace({ detail, onMutated }: Props) {
  const { assignment, students } = detail;
  const refreshAcademic = useRefreshAcademic();
  const [weightsOpen, setWeightsOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [solutionStudentId, setSolutionStudentId] = React.useState<string | null>(null);

  return (
    <section className={styles.page}>
      <Link href="/teacher/grading" className={styles.back}>
        <ArrowLeft className={styles.backIcon} />
        Back to Gradebook
      </Link>

      <WorkspaceHeader
        assignment={assignment}
        studentCount={students.length}
        onOpenWeights={() => setWeightsOpen(true)}
        onAddAssessment={() => setAddOpen(true)}
      />

      <ScoreGrid
        students={students}
        components={detail.components}
        onChanged={onMutated}
      />

      <FinalsCard
        students={students}
        onChanged={onMutated}
        onShowSolution={setSolutionStudentId}
      />

      {weightsOpen ? (
        <WeightsDialog
          detail={detail}
          onClose={() => setWeightsOpen(false)}
          onSaved={() => {
            setWeightsOpen(false);
            onMutated();
            refreshAcademic();
          }}
        />
      ) : null}

      {addOpen ? (
        <AddAssessmentDialog
          assignmentId={assignment.id}
          defaultType="WRITTEN_WORK"
          components={detail.components}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            onMutated();
            refreshAcademic();
          }}
        />
      ) : null}

      {solutionStudentId ? (
        <SolutionDialog
          detail={detail}
          studentId={solutionStudentId}
          onClose={() => setSolutionStudentId(null)}
        />
      ) : null}
    </section>
  );
}
