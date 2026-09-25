"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useRefreshAcademic, type ClassDetail, type ComponentType } from "../../components/grading-data";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSidebar, type WorkspaceView } from "./WorkspaceSidebar";
import { AddAssessmentDialog } from "./AddAssessmentDialog";
import { ScoreGrid } from "./ScoreGrid";
import { FinalsCard } from "./FinalsCard";
import { WeightsDialog } from "./WeightsDialog";
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
  const [view, setView] = React.useState<WorkspaceView>("scores");
  const [encodeCategory, setEncodeCategory] = React.useState<ComponentType>("WRITTEN_WORK");
  const [encodeAssessmentId, setEncodeAssessmentId] = React.useState("");

  const handleEncodeSelect = (category: ComponentType, assessmentId: string) => {
    setEncodeCategory(category);
    setEncodeAssessmentId(assessmentId);
  };

  const openAssessment = (category: ComponentType, assessmentId: string) => {
    handleEncodeSelect(category, assessmentId);
    setView("scores");
  };

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <Link href="/teacher/grading" className={styles.back}>
          <ChevronLeft className={styles.backIcon} />
          Back to Gradebook
        </Link>

        <WorkspaceHeader assignment={assignment} studentCount={students.length} />
      </div>

      <div className={styles.layout}>
        <WorkspaceSidebar
          assignmentId={assignment.id}
          components={detail.components}
          studentCount={students.length}
          view={view}
          onSelectView={setView}
          onOpenAssessment={openAssessment}
          onOpenWeights={() => setWeightsOpen(true)}
          onAddAssessment={() => setAddOpen(true)}
        />

        <div className={styles.main}>
          <div className={view === "scores" ? undefined : styles.viewHidden}>
            <ScoreGrid
              students={students}
              components={detail.components}
              category={encodeCategory}
              selectedId={encodeAssessmentId}
              onChanged={onMutated}
            />
          </div>

          <div className={view === "finals" ? undefined : styles.viewHidden}>
            <FinalsCard
              assignmentId={assignment.id}
              students={students}
              onChanged={onMutated}
            />
          </div>
        </div>
      </div>

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

    </section>
  );
}
