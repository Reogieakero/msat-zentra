"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookPlus, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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
      <div className={layout === "rail" ? "flex flex-col gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
              aria-hidden="true"
            >
              <BookPlus size={20} className="text-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Add Subject</h3>
              <p className="text-xs text-muted-foreground">
                Create one or more subjects for grades 7–10. Usable immediately.
              </p>
            </div>
          </div>
          <div className="relative mt-auto flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setListOpen(true)}>
              See all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSubjectOpen(true)}>
              Add subject
            </Button>
          </div>
        </div>
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
              aria-hidden="true"
            >
              <UserPlus size={20} className="text-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Add Teachers</h3>
              <p className="text-xs text-muted-foreground">
                Type a name once, pick it forever. Just a name list.
              </p>
            </div>
          </div>
          <div className="relative mt-auto flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setTeacherListOpen(true)}>
              See all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTeacherOpen(true)}>
              Add teacher
            </Button>
          </div>
        </div>
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
