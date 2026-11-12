"use client";
import * as React from "react";
import { Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCallout } from "@/components/ui/insight-callout";
import type { ClassPick } from "@/services/teacher/studentList.types";
import { useStudentRail } from "./components/use-student-rail";
import { StudentTable } from "./components/student-table";
import { SectionCards } from "./components/section-cards";
import { useBreadcrumbExtra } from "@/components/nav/BreadcrumbExtra";
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
  const showCards = React.useCallback(() => setCardsVisible(true), []);
  // Append the picked section to the shell breadcrumb while it is active.
  const sectionCrumb = activePick
    ? (selectedAdvisory?.name ??
      (selectedClass ? `${selectedClass.subject} · ${selectedClass.section}` : null))
    : null;
  useBreadcrumbExtra(sectionCrumb, showCards);
  const handleSelect = React.useCallback(
    (pick: ClassPick) => {
      setPicked(pick);
      // Vanish the kanban cards and reveal the data table.
      setCardsVisible(false);
    },
    [setPicked],
  );
  if (roster.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading student list">
        <div className={styles.mainCol}>
          {/* Section/advisory cards: same grid and card anatomy as SectionCards. */}
          <ul className={styles.sectionCardGrid} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className={styles.sectionCard}>
                <span className={styles.sectionCardHead}>
                  <span className={styles.sectionCardHeading}>
                    <Skeleton className="h-4 w-3/4 rounded" />
                    <span className={styles.sectionCardMetaRow}>
                      <Skeleton className="h-4 w-16 rounded-full" />
                      <Skeleton className="h-4 w-12 rounded-full" />
                    </span>
                  </span>
                  <Skeleton className={styles.sectionCardIcon} />
                </span>
                <span className={styles.sectionCardPanel}>
                  <span className={styles.sectionCardStat}>
                    <Skeleton className={styles.sectionCardStatIcon} />
                    <Skeleton className="h-4 w-10 rounded-full" />
                    <Skeleton className="h-3 w-14 rounded" />
                  </span>
                </span>
              </li>
            ))}
          </ul>
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
          <InsightCallout role="status" className="w-fit max-w-xl text-center">
            <strong>No students to list yet.</strong> Your advised sections and
            linked subject × section cards will appear here once a section is
            assigned to you and your teacher code is linked on Classes.
          </InsightCallout>
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
      <div className={`${styles.mainCol}${cardsVisible ? "" : ` ${styles.mainColCompact}`}`}>
        <div
          className={`grid transform-gpu transition-[grid-template-rows,opacity,transform] delay-0 duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
            cardsVisible
              ? "grid-rows-[1fr] translate-y-0 opacity-100"
              : "pointer-events-none grid-rows-[0fr] -translate-y-3 opacity-0"
          }`}
          aria-hidden={!cardsVisible}
          inert={!cardsVisible ? true : undefined}
        >
          <div className="min-h-0 overflow-hidden -mt-2 pt-2">
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

      {cardsVisible ? (
        <div
          role="note"
          aria-label="How to view students"
          className="fixed bottom-4 right-4 z-30 flex w-[min(260px,calc(100vw-2rem))] items-start gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-2 text-[11px] leading-snug text-blue-900 shadow-lg backdrop-blur-sm dark:text-blue-200"
        >
          <Info size={13} aria-hidden className="mt-px shrink-0 text-blue-500" />
          <p className="min-w-0">
            Click a subject or advisory card to view its student list.
          </p>
        </div>
      ) : null}
    </section>
  );
}
