"use client";
import * as React from "react";
import { BookOpen } from "lucide-react";
import { useTopbarCrumb } from "@/app/teacher/layout";
import { Skeleton } from "@/components/ui/skeleton";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { ClassPick } from "@/services/teacher/studentList.types";
import { useStudentRail } from "./components/use-student-rail";
import { StudentTable } from "./components/student-table";
import { SectionRail } from "./components/section-rail";
import styles from "./components/student-list.module.css";
export default function TeacherStudentListPage() {
  const crumb = React.useMemo(
    () => (
      <span className="text-sm">
        <span className="text-muted-foreground">Overview</span>
        <span className="text-muted-foreground"> / </span>
        <span className="font-medium">Student List</span>
      </span>
    ),
    [],
  );
  useTopbarCrumb(crumb);
  const {
    setPicked,
    roster,
    rail,
    activePick,
    selectedClass,
    selectedAdvisory,
    sectionQuery,
    setSectionQuery,
    railGroups,
    railEmpty,
    activeRailValue,
    rows,
  } = useStudentRail();
  const handleSelect = React.useCallback(
    (pick: ClassPick) => {
      setPicked(pick);
    },
    [setPicked],
  );
  if (roster.isPending) {
    return (
      <section className={`${styles.page} ${styles.pageRail}`} aria-busy="true" aria-label="Loading student list">
        <div className={styles.body}>
          <div className={styles.mainCol}>
            <div className={styles.heading} aria-hidden>
              <Skeleton className="h-7 w-36" />
              <Skeleton className="mt-1 h-4 w-72" />
            </div>
            <div className={`${assign.card} ${styles.tableCard}`} aria-hidden>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="mt-1 h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-40 shrink-0" />
              </div>
              <div className="relative overflow-x-auto rounded-md border">
                <div className="flex bg-muted/50" aria-hidden>
                  <Skeleton className="m-2 h-4 flex-1 rounded" />
                  <Skeleton className="m-2 h-4 flex-1 rounded" />
                  <Skeleton className="m-2 h-4 flex-1 rounded" />
                </div>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="flex items-center gap-2 border-t px-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <div className="flex flex-1 gap-1.5">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-28 rounded-full" />
                    </div>
                    <div className="flex flex-1 gap-1.5">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative flex items-center justify-end space-x-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
          <aside className={styles.sideCol} aria-label="Sections" aria-hidden>
            <Skeleton className="h-9 w-full shrink-0" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={assign.card}>
                <Skeleton className="relative h-5 w-3/4" />
                <Skeleton className="relative mt-1 h-3 w-1/2" />
              </div>
            ))}
          </aside>
        </div>
      </section>
    );
  }
  if (!roster.data) {
    return (
      <section className={styles.page}>
        <div className={styles.heading}>
          <h1>Student List</h1>
          <p>Your handled subjects with their students, attendance, and grades.</p>
        </div>
        <p role="alert" className={styles.empty}>
          Could not load your student list.
        </p>
      </section>
    );
  }
  if (rail.length === 0) {
    return (
      <section className={styles.page} aria-label="Student List">
        <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center">
          <div className={`${assign.card} w-full max-w-md`}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex flex-col items-center gap-2 py-6 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                aria-hidden="true"
              >
                <BookOpen size={24} className="text-muted-foreground" />
              </span>
              <p className="font-medium">No students to list yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Your advised sections and handled subject × section cards will
                appear here once sections are assigned to you this term.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }
  const headerTitle = roster.data?.advisorySection ? (
    <>
      {roster.data.advisorySection.name} · Advisory
    </>
  ) : (
    <>
      {roster.data?.class?.subjectName ?? selectedClass?.subject} ·{" "}
      {roster.data?.class?.sectionName ?? selectedClass?.section}
    </>
  );
  const headerDesc = roster.data
    ? `${roster.data.students.length} student${roster.data.students.length === 1 ? "" : "s"} · ` +
      (roster.data.advisorySection
        ? "attendance + general average"
        : "attendance + academic grade for this subject")
    : "Loading students…";
  const emptyName =
    roster.data?.class?.sectionName ??
    roster.data?.advisorySection?.name ??
    selectedClass?.section ??
    selectedAdvisory?.name ??
    "";
  return (
    <section className={`${styles.page} ${styles.pageRail}`}>
      <div className={styles.body}>
        <div className={styles.mainCol}>
          <div className={styles.heading}>
            <h1>Student List</h1>
            <p>
              Pick a section card on the right to see its students with
              attendance percentage and academic grade.
            </p>
          </div>
          <StudentTable
            headerTitle={headerTitle}
            headerDesc={headerDesc}
            rows={rows}
            rosterPending={roster.isPending}
            rosterError={roster.isError}
            emptySectionName={emptyName}
            activePickKey={activePick ? `${activePick.kind}:${activePick.id}` : ""}
          />
        </div>
        <SectionRail
          sectionQuery={sectionQuery}
          onSectionQuery={setSectionQuery}
          railGroups={railGroups}
          railEmpty={railEmpty}
          activeRailValue={activeRailValue}
          onSelect={handleSelect}
        />
      </div>
    </section>
  );
}
