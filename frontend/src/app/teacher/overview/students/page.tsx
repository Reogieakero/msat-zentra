"use client";
import * as React from "react";
import { BookOpen, Info, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { ClassPick } from "@/services/teacher/studentList.types";
import { useStudentRail } from "./components/use-student-rail";
import { StudentTable } from "./components/student-table";
import { SectionCards } from "./components/section-cards";
import styles from "./components/student-list.module.css";
export default function TeacherStudentListPage() {
  const {
    setPicked,
    roster,
    rail,
    activePick,
    selectedClass,
    selectedAdvisory,
    classes,
    advisorySections,
    rows,
    liveCountByKey,
  } = useStudentRail();
  const [cardsVisible, setCardsVisible] = React.useState(true);
  const handleSelect = React.useCallback(
    (pick: ClassPick) => {
      setPicked(pick);
      // Vanish the kanban cards and reveal the data table.
      setCardsVisible(false);
    },
    [setPicked],
  );
  const handleShowCards = React.useCallback(() => {
    // Vanish the data table and bring the kanban cards back.
    setCardsVisible(true);
  }, []);
  if (roster.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading student list">
        <div className={styles.mainCol}>
          <div className={styles.sectionCardGrid} aria-hidden>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5" aria-hidden>
            <div className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-7 w-36 shrink-0 sm:w-44" />
            </div>
            <div className="flex flex-col">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex items-center gap-2 border-t border-border px-3 py-2 first:border-t-0">
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  if (!roster.data) {
    return (
      <section className={styles.page}>
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
          <div className="w-full max-w-md rounded-xl border border-border p-2.5">
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
  const studentCount = rows.length;
  const countLabel = `${studentCount} student${studentCount === 1 ? "" : "s"}`;
  const headerTitle = roster.data?.advisorySection ? (
    <>
      This is your advisory section{" "}
      <span className="font-bold text-foreground">{roster.data.advisorySection.name}</span>{" "}
      with <span className="font-bold text-foreground">{countLabel}</span>
    </>
  ) : (
    <>
      This is your{" "}
      <span className="font-bold text-foreground">
        {roster.data?.class?.subjectName ?? selectedClass?.subject}
      </span>{" "}
      section{" "}
      <span className="font-bold text-foreground">
        {roster.data?.class?.sectionName ?? selectedClass?.section}
      </span>{" "}
      with <span className="font-bold text-foreground">{countLabel}</span>
    </>
  );
  const emptyName =
    roster.data?.class?.sectionName ??
    roster.data?.advisorySection?.name ??
    selectedClass?.section ??
    selectedAdvisory?.name ??
    "";
  return (
    <section className={styles.page}>
      <div className={styles.mainCol}>
        <div className="flex min-w-0 items-start justify-end gap-3">
          <div className="flex shrink-0 justify-end pt-1">
            {!cardsVisible && activePick ? (
              <div
                className="transform-gpu transition-all delay-150 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"
                aria-hidden={cardsVisible || !activePick}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleShowCards}
                  aria-label="Show section cards"
                >
                  <LayoutGrid aria-hidden />
                  Show cards
                </Button>
              </div>
            ) : cardsVisible ? (
              <div
                role="note"
                aria-label="How to view students"
                className="flex w-full max-w-[220px] items-start gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-2 text-[11px] leading-snug text-blue-900 sm:max-w-[260px] dark:text-blue-200"
              >
                <Info size={13} aria-hidden className="mt-px shrink-0 text-blue-500" />
                <p className="min-w-0">
                  Click a subject or advisory card to view its student list.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={`grid transform-gpu transition-[grid-template-rows,opacity,transform] delay-0 duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
            cardsVisible
              ? "grid-rows-[1fr] translate-y-0 opacity-100"
              : "pointer-events-none grid-rows-[0fr] -translate-y-3 opacity-0"
          }`}
          aria-hidden={!cardsVisible}
          inert={!cardsVisible ? true : undefined}
        >
          <div className="min-h-0 overflow-hidden">
            <SectionCards
              advisorySections={advisorySections}
              classes={classes}
              activePick={activePick}
              activeStudentCount={rows.length}
              liveCountByKey={liveCountByKey}
              onSelect={handleSelect}
            />
          </div>
        </div>
        {activePick ? (
          <div
            className={`grid transform-gpu transition-[grid-template-rows,opacity,transform] delay-150 duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
              !cardsVisible
                ? "grid-rows-[1fr] translate-y-0 opacity-100"
                : "pointer-events-none grid-rows-[0fr] translate-y-3 opacity-0"
            }`}
            aria-hidden={cardsVisible}
            inert={cardsVisible ? true : undefined}
          >
            <div className="min-h-0 overflow-hidden">
              <StudentTable
                key={`${activePick.kind}:${activePick.id}`}
                headerTitle={headerTitle}
                rows={rows}
                rosterPending={roster.isPending}
                rosterError={roster.isError}
                emptySectionName={emptyName}
                showAnecdotal={roster.data?.anecdotalVisible ?? false}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
