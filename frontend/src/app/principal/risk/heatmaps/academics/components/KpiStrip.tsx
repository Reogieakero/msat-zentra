"use client";

import * as React from "react";
import { ChevronDown, Clock, TriangleAlert, Users } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { AwaitingGradesBoard } from "./AwaitingGradesBoard";
import type { UngradedStudent } from "./types";
import styles from "./academics.module.css";

/** Decorative sprite pinned per metric — same treatment as the attendance strip. */
const MASCOTS = ["owl", "knight", "clockwork"] as const;

export function KpiStrip({
  below,
  gradedTotal,
  riskySections,
  sectionCount,
  ungraded,
  ungradedStudents,
  sharedTotal,
  isPending,
}: {
  below: number;
  gradedTotal: number;
  riskySections: number;
  sectionCount: number;
  /** Adviser-shared learners with no grade record yet this term. */
  ungraded: number;
  /** Those same learners, listed when the stat is tapped. */
  ungradedStudents: UngradedStudent[];
  /** All adviser-shared learners in scope. */
  sharedTotal: number;
  isPending: boolean;
}) {
  const [showUngraded, setShowUngraded] = React.useState(false);
  const belowPct =
    gradedTotal > 0 ? Math.round((below / gradedTotal) * 100) : 0;

  if (!isPending && sectionCount === 0 && gradedTotal === 0 && ungraded === 0)
    return null;

  return (
    <>
      <div
        className={styles.kpiGrid}
        aria-busy={isPending || undefined}
        aria-label="Academic overview"
      >
      {isPending ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className={styles.kpiSkel} />
        ))
      ) : (
        <>
          <KanbanBoard
            className={styles.board}
            title="Students below 75"
            icon={
              <span className={styles.icon} aria-hidden="true">
                <TriangleAlert size={14} />
              </span>
            }
            ariaLabel="Students below 75"
          >
            <div className={styles.stat}>
              <span className={styles.statTop}>
                <span className={styles.statNumber}>
                  {below.toLocaleString()}
                </span>
                <span className={styles.statMascot} aria-hidden="true">
                  <StudentMascot
                    name="Students below 75"
                    character={MASCOTS[0]}
                    size={36}
                  />
                </span>
              </span>
              <span className={styles.statHint}>Learners under the passing mark</span>
              <div className={styles.kpiPills}>
                <Pill tone="amber" label="Share of graded learners">
                  {belowPct}% of {gradedTotal.toLocaleString()} graded
                </Pill>
                <Pill tone="amber" label="Scope">
                  Live grades
                </Pill>
              </div>
            </div>
          </KanbanBoard>

          <KanbanBoard
            className={styles.board}
            title="Sections at risk"
            icon={
              <span className={styles.icon} aria-hidden="true">
                <Users size={14} />
              </span>
            }
            ariaLabel="Sections at risk"
          >
            <div className={styles.stat}>
              <span className={styles.statTop}>
                <span className={styles.statNumber}>
                  {riskySections.toLocaleString()}
                </span>
                <span className={styles.statMascot} aria-hidden="true">
                  <StudentMascot
                    name="Sections at risk"
                    character={MASCOTS[1]}
                    size={36}
                  />
                </span>
              </span>
              <span className={styles.statHint}>Sections averaging below 75</span>
              <div className={styles.kpiPills}>
                <Pill tone="amber" label="Sections in scope">
                  Of {sectionCount.toLocaleString()} sections
                </Pill>
                <Pill tone="amber" label="Scope">
                  Live grades
                </Pill>
              </div>
            </div>
          </KanbanBoard>

          <KanbanBoard
            className={styles.board}
            title="Awaiting grades"
            icon={
              <span className={styles.icon} aria-hidden="true">
                <Clock size={14} />
              </span>
            }
            ariaLabel="Shared students without grade records"
          >
            <button
              type="button"
              className={`${styles.stat} ${styles.statButton}`}
              onClick={() => setShowUngraded((open) => !open)}
              aria-expanded={showUngraded}
              aria-controls="awaiting-grades-table"
            >
              <span className={styles.statTop}>
                <span className={styles.statNumber}>
                  {ungraded.toLocaleString()}
                </span>
                <span className={styles.statMascot} aria-hidden="true">
                  <StudentMascot
                    name="Awaiting grades"
                    character={MASCOTS[2]}
                    size={36}
                  />
                </span>
              </span>
              <span className={styles.statHint}>Shared learners with no grade record</span>
              <div className={styles.kpiPills}>
                <Pill tone="amber" label="Shared learners in scope">
                  Of {sharedTotal.toLocaleString()} shared
                </Pill>
                <Pill tone="green" label="Data source">
                  Adviser-shared
                </Pill>
                <Pill tone="blue" label="Open the list">
                  {showUngraded ? "Hide list" : "Tap to view"}
                  <ChevronDown
                    size={11}
                    aria-hidden
                    style={{
                      transform: showUngraded ? "rotate(180deg)" : undefined,
                      transition: "transform 160ms ease",
                    }}
                  />
                </Pill>
              </div>
            </button>
          </KanbanBoard>
        </>
      )}
      </div>

      {!isPending && showUngraded && ungradedStudents.length > 0 ? (
        <div id="awaiting-grades-table">
          <AwaitingGradesBoard
            students={ungradedStudents}
            onClose={() => setShowUngraded(false)}
          />
        </div>
      ) : null}
    </>
  );
}
