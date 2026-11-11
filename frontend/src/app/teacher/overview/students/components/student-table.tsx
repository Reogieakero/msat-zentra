"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, CalendarClock, ClipboardList, SearchIcon, Users } from "lucide-react";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill, type PillTone } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import type { StudentListRow } from "@/services/teacher/studentList.types";
import styles from "./student-list.module.css";

function attendanceTone(pct: number | null): PillTone {
  if (pct === null) return "neutral";
  if (pct >= 90) return "green";
  if (pct >= 80) return "amber";
  return "red";
}

function gradeTone(grade: number | null): PillTone {
  if (grade === null) return "neutral";
  if (grade >= 90) return "green";
  if (grade >= 75) return "blue";
  return "red";
}

/** One student as its own mini kanban board — same card language as the
 *  principal academics roster, with the teacher's attendance/grade metrics
 *  shown inline instead of behind a hover card. */
function StudentCard({ row, showAnecdotal }: { row: StudentListRow; showAnecdotal: boolean }) {
  const pct = row.attendancePercentage;
  const grade = row.academicGrade;
  const hasMeetups = row.attendanceTotal > 0;
  return (
    <article className={styles.studentCard} aria-label={`${row.name}, ${row.lrn}`}>
      <header className={styles.studentCardHead}>
        <StudentMascot
          name={row.name}
          seed={row.lrn}
          character={row.mascot ?? undefined}
          size={32}
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <p className={styles.studentCardName} title={row.name}>
            {row.name}
          </p>
          <Pill
            tone="neutral"
            label="LRN"
            className={`${styles.studentCardLrn} tabular-nums`}
          >
            {row.lrn}
          </Pill>
        </div>
      </header>
      <div className={styles.studentCardBody}>
        <div
          className={`${styles.studentCardStats}${showAnecdotal ? "" : ` ${styles.studentCardStatsTwo}`}`}
        >
          <div className={styles.studentCardStat}>
            <span className={styles.sectionCardStatIcon} aria-hidden>
              <CalendarClock />
            </span>
            <Pill
              tone={attendanceTone(pct)}
              label="Attendance"
              className="tabular-nums"
            >
              {pct === null ? "—" : `${pct}%`}
            </Pill>
            <span
              className={styles.studentCardStatLabel}
              title={
                hasMeetups
                  ? `${row.attendancePresent} of ${row.attendanceTotal} meetups present`
                  : "No attendance meetups yet"
              }
            >
              {hasMeetups ? `${row.attendancePresent}/${row.attendanceTotal}` : "No meetups"}
            </span>
          </div>
          <div className={styles.studentCardStat}>
            <span className={styles.sectionCardStatIcon} aria-hidden>
              <BookOpen />
            </span>
            <Pill tone={gradeTone(grade)} label="Academic grade" className="tabular-nums">
              {grade === null ? "—" : grade}
            </Pill>
            <span className={styles.studentCardStatLabel}>
              {row.computedAverage !== null
                ? `Avg ${Math.round(row.computedAverage * 10) / 10}`
                : "No average"}
            </span>
          </div>
          {showAnecdotal ? (
            <div className={styles.studentCardStat}>
              <span className={styles.sectionCardStatIcon} aria-hidden>
                <ClipboardList />
              </span>
              <Pill
                tone={row.anecdotalCount > 0 ? "amber" : "neutral"}
                label="Anecdotal"
                className="tabular-nums"
              >
                {row.anecdotalCount}
              </Pill>
              <span className={styles.studentCardStatLabel}>Anecdotal</span>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function StudentTable({
  headerTitle,
  rows,
  rosterPending,
  rosterError,
  emptySectionName,
  showAnecdotal,
}: {
  headerTitle: React.ReactNode;
  rows: StudentListRow[];
  rosterPending: boolean;
  rosterError: boolean;
  emptySectionName: string;
  showAnecdotal: boolean;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.lrn.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const reduceMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
    >
    <section aria-label="Student list" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <Users size={14} aria-hidden className="shrink-0 text-blue-500" />
          <span className="min-w-0">{headerTitle}</span>
        </p>
        <InputGroup className="w-36 shrink-0 rounded-[16px] sm:w-44">
          <InputGroupInput
            placeholder="Filter students..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            aria-label="Filter students"
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
      </div>
      {rosterPending ? (
        <p className="flex min-h-24 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">
          Loading students…
        </p>
      ) : rosterError ? (
        <p role="alert" className="flex min-h-24 items-center justify-center px-1 py-8 text-center text-xs text-destructive">
          Could not load students for this class.
        </p>
      ) : rows.length === 0 ? (
        <div className="flex w-full justify-center px-1 py-6">
          <InsightCallout role="status" className="w-full max-w-xl text-left">
            <strong>No students in this section yet.</strong>{" "}
            {emptySectionName
              ? `${emptySectionName} has no enrolled learners this term.`
              : "Enrolled learners will appear here once the roster is finalized."}
          </InsightCallout>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex w-full justify-center px-1 py-6">
          <InsightCallout role="status" className="w-full max-w-xl text-left">
            <strong>No students match your search.</strong> Try a different name
            or LRN — or clear the filter to see everyone.
          </InsightCallout>
        </div>
      ) : (
        <div className={styles.studentCardGrid} aria-label="Student list">
          {filtered.map((row) => (
            <StudentCard key={row.studentId} row={row} showAnecdotal={showAnecdotal} />
          ))}
        </div>
      )}
    </section>
    </motion.div>
  );
}
