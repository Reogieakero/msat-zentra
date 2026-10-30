"use client";

import * as React from "react";
import { ArrowLeft, Scale, SearchIcon } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Pill } from "@/components/ui/pill";
import { gradeLabel } from "@/services/teacher/grading.compute";
import { compareSurnameFirst } from "@/lib/names";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import kanbanStyles from "@/app/teacher/schedule/components/subject-kanban.module.css";
import { Button } from "@/components/ui/button";
import { useRefreshAcademic } from "@/services/teacher/grading.service";
import type {
  ClassDetail,
  ComponentType,
} from "@/services/teacher/grading.types";
import { WorkspaceGutter, type WorkspaceView } from "./WorkspaceGutter";
import { SubjectRail } from "./SubjectRail";
import { AssessmentList } from "./AssessmentList";
import { ScoreGrid } from "./ScoreGrid";
import { FinalsCard } from "./FinalsCard";
import { WeightsBoard } from "./WeightsBoard";
import styles from "./ClassWorkspace.module.css";

type Props = {
  detail: ClassDetail;
  queryKeyId: string;
  onMutated: () => void;
};

export function ClassWorkspace({ detail, queryKeyId, onMutated }: Props) {
  const { assignment } = detail;
  // Alphabetical by surname (then given name) so every list on this page —
  // score table, encode view, finals — reads like the advisory roster.
  const students = React.useMemo(
    () => [...detail.students].sort((a, b) => compareSurnameFirst(a.name, b.name)),
    [detail.students],
  );
  const refreshAcademic = useRefreshAcademic();
  const [weightsOpen, setWeightsOpen] = React.useState(false);
  const [view] = React.useState<WorkspaceView>("scores");
  const [encodeCategory, setEncodeCategory] = React.useState<ComponentType>("WRITTEN_WORK");
  const [encodeAssessmentId, setEncodeAssessmentId] = React.useState("");
  const [assessmentQuery, setAssessmentQuery] = React.useState("");

  const selectedAssessment = React.useMemo(
    () =>
      detail.components
        .flatMap((c) => c.assessments.map((a) => ({ ...a, type: c.type as ComponentType })))
        .find((a) => a.id === encodeAssessmentId) ?? null,
    [detail.components, encodeAssessmentId],
  );

  const weightsConfigured = detail.components.some((c) => (c.weight ?? 0) > 0);
  const unlockCount = students.filter(
    (s) => s.final != null && s.final.lockStatus === "unlocked" && s.final.computedAverage != null,
  ).length;
  const subjectLabel = `${assignment.subjectName} (${assignment.subjectCode}) — ${assignment.sectionName}`;

  return (
    <section className={styles.page}>
      <div
        className={styles.layout}
        style={weightsConfigured ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <div className={styles.main}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SubjectRail currentId={queryKeyId} />
            </div>
            {weightsConfigured && !selectedAssessment ? (
              <InputGroup className="max-w-40 shrink-0 rounded-[16px]">
                <InputGroupInput
                  placeholder="Search assessments..."
                  value={assessmentQuery}
                  onChange={(event) => setAssessmentQuery(event.target.value)}
                  aria-label="Search assessments"
                />
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
              </InputGroup>
            ) : null}
          </div>
          {!weightsConfigured ? (
            <div className={emptyStyles.emptyWrap}>
              <div
                key={weightsOpen ? "weights-edit" : "weights-empty"}
                className={`${kanbanStyles.column} ${styles.weightsSwap} mx-auto w-full max-w-md`}
              >
                {weightsOpen ? (
                  <WeightsBoard
                    detail={detail}
                    onCancel={() => setWeightsOpen(false)}
                    onSaved={() => {
                      setWeightsOpen(false);
                      onMutated();
                      refreshAcademic();
                    }}
                  />
                ) : (
                <KanbanBoard
                  title="Subject weights"
                  icon={
                    <span className="text-amber-500" aria-hidden>
                      <Scale size={14} />
                    </span>
                  }
                  actions={
                    <span className="flex items-center gap-1.5">
                      <Pill tone="amber" label="Section">{assignment.sectionName}</Pill>
                      <Pill tone="amber" label="Grade level">Grade {gradeLabel(assignment.gradeLevel)}</Pill>
                    </span>
                  }
                  description="Final grades cannot compute until the WW / PT / E shares are set."
                  footer={
                    <div className="flex justify-end px-1 pb-1">
                      <Button
                        size="sm"
                        className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                        onClick={() => setWeightsOpen(true)}
                      >
                        Set up weights
                      </Button>
                    </div>
                  }
                >
                  <p className="px-1 text-xs text-muted-foreground">
                    Pick a DepEd preset or enter custom weights.
                  </p>
                </KanbanBoard>
                )}
              </div>
            </div>
          ) : !selectedAssessment ? (
          <div className="min-w-0 flex-1">
          <AssessmentList
            students={students}
            components={detail.components}
            query={assessmentQuery}
            onSelect={(c, id) => {
              setEncodeCategory(c);
              setEncodeAssessmentId(id);
            }}
            onDeleted={(id) => {
              if (id === encodeAssessmentId) setEncodeAssessmentId("");
              onMutated();
            }}
          />
          </div>
          ) : (
          <>
          <div>
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setEncodeAssessmentId("")}>
              <ArrowLeft size={16} aria-hidden />
              Assessments
            </Button>
          </div>
          <div className={view === "scores" ? undefined : styles.viewHidden}>
            <ScoreGrid
              queryKeyId={queryKeyId}
              sectionName={assignment.sectionName}
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
          </>
          )}
        </div>

        {weightsConfigured ? (
        <aside className="self-start lg:sticky lg:top-16" aria-label="Class tools">
          <WorkspaceGutter
            assignment={assignment}
            detail={detail}
            studentCount={students.length}
            assignmentId={assignment.id}
            components={detail.components}
            unlockCount={unlockCount}
            subjectLabel={subjectLabel}
            termLabel={`Term ${assignment.termNumber}, ${assignment.schoolYear}`}
            onWeightsSaved={() => {
              onMutated();
              refreshAcademic();
            }}
          />
        </aside>
        ) : null}
      </div>

    </section>
  );
}
