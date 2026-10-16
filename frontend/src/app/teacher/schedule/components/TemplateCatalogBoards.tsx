"use client";
import { useState } from "react";
import { BookPlus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type { ScheduleSubject } from "../page";
import type { CatalogTeacher } from "./use-schedule-catalog";
import { SubjectCatalogKanban } from "./subject-catalog-kanban";
import { TeacherCatalogKanban } from "./teacher-catalog-kanban";

interface Props {
  subjects: ScheduleSubject[];
  teachers: CatalogTeacher[];
  subjectsPending?: boolean;
  teachersPending?: boolean;
  subjectsError?: boolean;
  teachersError?: boolean;
  /** When controlled by the template page, expanding hides the section picker. */
  subjectsExpanded?: boolean;
  onSubjectsExpandedChange?: (expanded: boolean) => void;
  /** Inline add-subject flow: expand the kanban and open its add form. Falls back to local expand when omitted. */
  onAddSubject?: () => void;
  /** When controlled by the template page, expanding hides the section picker. */
  teachersExpanded?: boolean;
  onTeachersExpandedChange?: (expanded: boolean) => void;
  /** Inline add-teacher flow: expand the kanban and open its add form. Falls back to local expand when omitted. */
  onAddTeacher?: () => void;
}

export function TemplateCatalogBoards({
  subjects,
  teachers,
  subjectsPending,
  teachersPending,
  subjectsError,
  teachersError,
  subjectsExpanded,
  onSubjectsExpandedChange,
  onAddSubject,
  teachersExpanded,
  onTeachersExpandedChange,
  onAddTeacher,
}: Props) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [kanbanAddOpen, setKanbanAddOpen] = useState(false);
  const [internalTeacherExpanded, setInternalTeacherExpanded] = useState(false);
  const [teacherAddOpen, setTeacherAddOpen] = useState(false);

  const expanded = subjectsExpanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    setInternalExpanded(next);
    onSubjectsExpandedChange?.(next);
  };

  // Teacher expansion is page-controlled (full-width view under the header),
  // same as subjects — local state is only a fallback.
  const teacherExpanded = teachersExpanded ?? internalTeacherExpanded;
  const setTeacherExpanded = (next: boolean) => {
    setInternalTeacherExpanded(next);
    onTeachersExpandedChange?.(next);
  };

  const closeTeacherView = () => {
    setTeacherExpanded(false);
    setTeacherAddOpen(false);
  };

  const openTeacherList = () => {
    setKanbanAddOpen(false);
    setExpanded(false);
    setTeacherAddOpen(false);
    setTeacherExpanded(true);
  };

  const openTeacherAdd = () => {
    if (onAddTeacher) {
      onAddTeacher();
      return;
    }
    setKanbanAddOpen(false);
    setExpanded(false);
    setTeacherAddOpen(true);
    setTeacherExpanded(true);
  };

  const openSubjectList = () => {
    closeTeacherView();
    setExpanded(true);
  };

  const handleAddSubject = () => {
    closeTeacherView();
    if (onAddSubject) {
      onAddSubject();
      return;
    }
    setKanbanAddOpen(true);
    setExpanded(true);
  };

  return (
    <>
      {expanded ? (
        <SubjectCatalogKanban
          subjects={subjects}
          pending={subjectsPending}
          loadError={subjectsError}
          onBack={() => {
            setExpanded(false);
            setKanbanAddOpen(false);
          }}
          addOpen={kanbanAddOpen}
          onAddOpenChange={setKanbanAddOpen}
        />
      ) : teacherExpanded ? (
        <TeacherCatalogKanban
          teachers={teachers}
          pending={teachersPending}
          loadError={teachersError}
          onBack={closeTeacherView}
          addOpen={teacherAddOpen}
          onAddOpenChange={setTeacherAddOpen}
        />
      ) : (
      <div className="grid items-stretch gap-4 md:grid-cols-2">
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
              <Button variant="outline" className="h-6 px-2 text-xs" onClick={openSubjectList}>
                See all
              </Button>
              <Button className="h-6 px-2 text-xs" onClick={handleAddSubject}>
                Add subject
              </Button>
            </div>
          }
        >
          <p className="flex-1 px-1 text-xs text-muted-foreground">
            {subjectsPending ? "Loading subjects…" : subjectsError ? "Could not load subjects." : `${subjects.length} subject${subjects.length === 1 ? "" : "s"} in catalog.`}
          </p>
        </KanbanBoard>
        <KanbanBoard
          title="Add Teachers"
          icon={
            <span className="text-amber-500" aria-hidden>
              <UserPlus size={14} />
            </span>
          }
          count={<span className="text-amber-600 dark:text-amber-500">{teachers.length}</span>}
          description="Type a name once, pick it forever. Just a name list."
          className="h-full"
          footer={
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button variant="outline" className="h-6 px-2 text-xs" onClick={openTeacherList}>
                See all
              </Button>
              <Button className="h-6 px-2 text-xs" onClick={openTeacherAdd}>
                Add teacher
              </Button>
            </div>
          }
        >
          <p className="flex-1 px-1 text-xs text-muted-foreground">
            {teachersPending ? "Loading teachers…" : teachersError ? "Could not load teachers." : `${teachers.length} teacher${teachers.length === 1 ? "" : "s"} in catalog.`}
          </p>
        </KanbanBoard>
      </div>
      )}
    </>
  );
}
