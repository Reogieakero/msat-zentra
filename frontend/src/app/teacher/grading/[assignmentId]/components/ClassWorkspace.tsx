"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, HomeIcon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTopbarCrumb } from "@/app/teacher/layout";
import { Button } from "@/components/ui/button";
import { useRefreshAcademic } from "@/services/teacher/grading.service";
import type {
  ClassDetail,
  ComponentType,
} from "@/services/teacher/grading.types";
import { WorkspaceRail, type WorkspaceView } from "./WorkspaceRail";
import { AssessmentList } from "./AssessmentList";
import { AddAssessmentDialog } from "./AddAssessmentDialog";
import { ScoreGrid } from "./ScoreGrid";
import { FinalsCard } from "./FinalsCard";
import { WeightsDialog } from "./WeightsDialog";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./ClassWorkspace.module.css";

type Props = {
  detail: ClassDetail;
  queryKeyId: string;
  onMutated: () => void;
};

export function ClassWorkspace({ detail, queryKeyId, onMutated }: Props) {
  const { assignment, students } = detail;
  const refreshAcademic = useRefreshAcademic();
  const [weightsOpen, setWeightsOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [view] = React.useState<WorkspaceView>("scores");
  const [encodeCategory, setEncodeCategory] = React.useState<ComponentType>("WRITTEN_WORK");
  const [encodeAssessmentId, setEncodeAssessmentId] = React.useState("");

  const selectedAssessment = React.useMemo(
    () =>
      detail.components
        .flatMap((c) => c.assessments.map((a) => ({ ...a, type: c.type as ComponentType })))
        .find((a) => a.id === encodeAssessmentId) ?? null,
    [detail.components, encodeAssessmentId],
  );

  const crumb = React.useMemo(
    () => (
      <Breadcrumb aria-label="Gradebook pages" className="text-[13px]">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/teacher/grading" className="inline-flex items-center gap-1.5">
                <HomeIcon aria-hidden="true" size={16} />
                Gradebook
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator> / </BreadcrumbSeparator>
          <BreadcrumbItem>
            {selectedAssessment ? (
              <BreadcrumbLink asChild>
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setEncodeAssessmentId("");
                  }}
                >
                  {assignment.subjectName}
                </Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{assignment.subjectName}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {selectedAssessment ? (
            <>
              <BreadcrumbSeparator> / </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedAssessment.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
    ),
    [assignment.subjectName, selectedAssessment],
  );
  useTopbarCrumb(crumb);

  const weightsConfigured = detail.components.some((c) => (c.weight ?? 0) > 0);

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          {!weightsConfigured ? (
            <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-end pb-8">
              <div role="alert" className={`${assign.card} w-full max-w-md`}>
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex flex-col items-center gap-2 py-4 text-center">
                  <p className="font-semibold">Subject weights not set up yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Final grades cannot compute until the WW / PT / E shares are set.
                    Pick a DepEd preset or enter custom weights.
                  </p>
                  <Button size="sm" className="mt-1" onClick={() => setWeightsOpen(true)}>
                    Set up weights
                  </Button>
                </div>
              </div>
            </div>
          ) : !selectedAssessment ? (
          <div className="flex min-h-[50vh] flex-1 items-center justify-center">
          <AssessmentList
            students={students}
            components={detail.components}
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

        <aside className={styles.rail} aria-label="Class tools">
          <WorkspaceRail
            assignment={assignment}
            studentCount={students.length}
            assignmentId={assignment.id}
            components={detail.components}
            onOpenWeights={() => setWeightsOpen(true)}
            onAddAssessment={() => setAddOpen(true)}
          />
        </aside>
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
