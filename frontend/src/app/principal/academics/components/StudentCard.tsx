"use client";

import * as React from "react";
import {
  CalendarDays,
  ClipboardList,
  Gauge,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useTerm } from "@/lib/term/TermContext";
import { useStudentHoverStats } from "@/services/principal/studentStats.service";
import type { StudentRow } from "@/services/principal/academics";
import styles from "./SectionStudentsTable.module.css";

/**
 * One student as its own mini kanban board. Hovering (or focusing) it opens a
 * live-stats board for the active term; when the adviser has not connected
 * data sharing the card says so instead of showing numbers.
 */
export function StudentCard({ student }: { student: StudentRow }) {
  return (
    <HoverCard openDelay={140} closeDelay={90}>
      <HoverCardTrigger asChild>
        <article className={styles.board} tabIndex={0}>
          <header className={styles.boardHead}>
            <StudentMascot
              name={student.name}
              seed={student.lrn}
              character={student.mascot ?? undefined}
              size={40}
            />
            <p className={styles.cellMain}>{student.name}</p>
          </header>
          <div className={styles.boardBody}>
            <Pill tone="neutral" label="LRN" className={`${styles.lrnPill} tabular-nums`}>
              {student.lrn}
            </Pill>
          </div>
        </article>
      </HoverCardTrigger>
      <HoverCardContent align="start" side="bottom" className={`${styles.hoverContent} w-80 p-0`}>
        <StudentStatsBoard student={student} />
      </HoverCardContent>
    </HoverCard>
  );
}

function StudentStatsBoard({ student }: { student: StudentRow }) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.termId ?? "none"}:${activeTerm?.schoolYearId ?? "none"}`;
  const { data, isPending, isError } = useStudentHoverStats(student.studentId, termKey);

  const connection = data?.connected ?? false;
  const avg = data?.generalAverage ?? null;
  const avgTone = avg === null ? "neutral" : avg < 75 ? "red" : avg < 80 ? "amber" : "green";
  const pct = data?.attendance.pct ?? null;
  const attendanceTone = pct === null ? "neutral" : pct < 80 ? "red" : pct < 90 ? "amber" : "green";

  return (
    <div className={styles.hoverBoard} aria-live="polite">
      <header className={styles.hoverHead}>
        <StudentMascot
          name={student.name}
          seed={student.lrn}
          character={student.mascot ?? undefined}
          size={28}
        />
        <div className={styles.hoverTitleBlock}>
          <p className={styles.hoverName}>{student.name}</p>
          <p className={styles.hoverLrn}>{student.lrn}</p>
        </div>
      </header>

      <div className={styles.hoverMeta}>
        <Pill tone="amber" label="Term">
          {data?.termLabel ?? "Active term"}
        </Pill>
        {data ? (
          <Pill tone="neutral" label="School year">
            {data.schoolYear}
          </Pill>
        ) : null}
      </div>

      {isPending ? (
        <div className={styles.hoverLoading} aria-label="Loading live student stats">
          <span className={styles.hoverSkeleton} />
          <span className={styles.hoverSkeleton} />
        </div>
      ) : isError ? (
        <p className={styles.hoverWarnText}>Couldn&apos;t load live student stats.</p>
      ) : !connection ? (
        <div className={styles.hoverWarn}>
          <ShieldAlert size={15} className={styles.hoverWarnIcon} aria-hidden />
          <div className={styles.hoverWarnBody}>
            <p className={styles.hoverWarnTitle}>Adviser hasn&apos;t shared student data</p>
            <p className={styles.hoverWarnText}>
              Attendance, anecdotal records and averages appear once the class adviser
              turns on data sharing in Settings.
            </p>
          </div>
        </div>
      ) : (
        <>
          <span className={styles.hoverLive}>
            <ShieldCheck size={12} aria-hidden />
            Live · adviser sharing on
          </span>
          <div className={styles.hoverStats}>
            <div className={styles.hoverStat}>
              <span className={`${styles.statIconChip} ${styles.statIconChipStudents}`}>
                <CalendarDays className={styles.statIcon} aria-hidden />
              </span>
              <Pill tone={attendanceTone} className="tabular-nums">
                {pct === null ? "—" : `${pct}%`}
              </Pill>
              <span className={styles.hoverStatLabel}>
                {data.attendance.total > 0
                  ? `${data.attendance.present}/${data.attendance.total} present`
                  : "No attendance yet"}
              </span>
            </div>
            <div className={styles.hoverStat}>
              <span className={`${styles.statIconChip} ${styles.statIconChipRisk}`}>
                <ClipboardList className={styles.statIcon} aria-hidden />
              </span>
              <Pill tone="neutral" className="tabular-nums">
                {data.anecdoteCount}
              </Pill>
              <span className={styles.hoverStatLabel}>Anecdotal records</span>
            </div>
            <div className={styles.hoverStat}>
              <span className={`${styles.statIconChip} ${styles.statIconChipAvg}`}>
                <Gauge className={styles.statIcon} aria-hidden />
              </span>
              <Pill tone={avgTone} className="tabular-nums">
                {avg === null ? "—" : avg.toFixed(1)}
              </Pill>
              <span className={styles.hoverStatLabel}>
                {data.gradedSubjects > 0
                  ? `Average · ${data.gradedSubjects} subject${data.gradedSubjects === 1 ? "" : "s"}`
                  : "No grades yet"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
