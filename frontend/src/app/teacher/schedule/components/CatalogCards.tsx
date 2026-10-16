"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookPlus, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type { ScheduleSubject } from "../page";
import { AddTeacherDialog } from "./add-teacher-dialog";
import { AddSubjectDialog } from "./add-subject-dialog";
import { SubjectListDialog } from "./subject-list-dialog";
import { TeacherListDialog } from "./teacher-list-dialog";
export { AddTeacherDialog } from "./add-teacher-dialog";
export { AddSubjectDialog } from "./add-subject-dialog";
type Teacher = { id: string; name: string; code: string | null; linked: boolean };
interface Props {
  layout?: "grid" | "rail";
  subjects?: ScheduleSubject[];
  teachers?: Teacher[];
  subjectsPending?: boolean;
  subjectsError?: boolean;
  teachersPending?: boolean;
  teachersError?: boolean;
}
export function CatalogCards({
  layout = "grid",
  subjects: subjectsProp,
  teachers: teachersProp,
  subjectsPending: subjectsPendingProp,
  subjectsError: subjectsErrorProp,
  teachersPending: teachersPendingProp,
  teachersError: teachersErrorProp,
}: Props) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [teacherListOpen, setTeacherListOpen] = useState(false);
  const subjectsQuery = useQuery<{ subjects: ScheduleSubject[] }>({
    queryKey: ["teacher-schedule-subjects", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ subjects: ScheduleSubject[] }>(
        "/api/teacher/schedule/subjects",
      );
      return data;
    },
    enabled: subjectsProp === undefined,
  });
  const teachersQuery = useQuery<{ teachers: Teacher[] }>({
    queryKey: ["teacher-schedule-teachers", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teachers: Teacher[] }>(
        "/api/teacher/schedule/teachers",
      );
      return data;
    },
    enabled: teachersProp === undefined,
  });
  const subjects = subjectsProp ?? subjectsQuery.data?.subjects ?? [];
  const teacherNames = teachersProp ?? teachersQuery.data?.teachers ?? [];
  const subjectsPending = subjectsPendingProp ?? subjectsQuery.isPending;
  const subjectsLoadError = subjectsErrorProp ?? subjectsQuery.isError;
  const teachersPending = teachersPendingProp ?? teachersQuery.isPending;
  const teachersLoadError = teachersErrorProp ?? teachersQuery.isError;
  return (
    <>
      <div className={layout === "rail" ? "flex flex-col gap-3" : "grid items-stretch gap-3 sm:grid-cols-2"}>
        <KanbanBoard
          title="Add Subject"
          icon={
            <span className="text-amber-500" aria-hidden>
              <BookPlus size={14} />
            </span>
          }
          count={<span className="text-amber-600 dark:text-amber-500">{subjects.length}</span>}
          description="Create one or more subjects for grades 7–10. Usable immediately."
          className="h-full"
          footer={
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setListOpen(true)}>
                See all
              </Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => setSubjectOpen(true)}>
                Add subject
              </Button>
            </div>
          }
        >
          <p className="flex-1 px-1 text-xs text-muted-foreground">
            {subjectsPending
              ? "Loading subjects…"
              : subjectsLoadError
                ? "Could not load subjects."
                : `${subjects.length} subject${subjects.length === 1 ? "" : "s"} in catalog.`}
          </p>
        </KanbanBoard>
        <KanbanBoard
          title="Add Teachers"
          icon={
            <span className="text-amber-500" aria-hidden>
              <UserPlus size={14} />
            </span>
          }
          count={<span className="text-amber-600 dark:text-amber-500">{teacherNames.length}</span>}
          description="Type a name once, pick it forever. Just a name list."
          className="h-full"
          footer={
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setTeacherListOpen(true)}>
                See all
              </Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={() => setTeacherOpen(true)}>
                Add teacher
              </Button>
            </div>
          }
        >
          <p className="flex-1 px-1 text-xs text-muted-foreground">
            {teachersPending
              ? "Loading teachers…"
              : teachersLoadError
                ? "Could not load teachers."
                : `${teacherNames.length} teacher${teacherNames.length === 1 ? "" : "s"} in catalog.`}
          </p>
        </KanbanBoard>
      </div>
      {subjectOpen ? (
        <AddSubjectDialog
          onClose={() => setSubjectOpen(false)}
          subjects={subjects}
          teachers={teacherNames}
        />
      ) : null}
      {teacherOpen ? (
        <AddTeacherDialog onClose={() => setTeacherOpen(false)} teachers={teacherNames} />
      ) : null}
      {listOpen ? (
        <SubjectListDialog
          subjects={subjects}
          pending={subjectsPending}
          loadError={subjectsLoadError}
          onClose={() => setListOpen(false)}
        />
      ) : null}
      {teacherListOpen ? (
        <TeacherListDialog
          teachers={teacherNames}
          pending={teachersPending}
          loadError={teachersLoadError}
          onClose={() => setTeacherListOpen(false)}
        />
      ) : null}
    </>
  );
}
