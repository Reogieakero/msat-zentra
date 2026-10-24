"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarClock,
  FilePenLine,
  KanbanSquare,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { riskDotColor } from "@/lib/risk/status";
import type {
  AdviseeRow,
  AdviseeRiskFlag,
} from "@/services/teacher/advisory.types";
import type { StudentAcademic } from "@/services/teacher/adviseeAcademic.types";
import type { StudentAttendance } from "@/services/teacher/adviseeAttendance.types";
import { fetchStudentAcademic } from "@/services/teacher/adviseeAcademic.service";
import { fetchStudentAttendance } from "@/services/teacher/adviseeAttendance.service";
import styles from "./advisory-insight-board.module.css";

const FACTOR_BADGE: Record<AdviseeRiskFlag, { label: string; variant: "amber" | "green" | "blue" }> = {
  academic: { label: "Academic", variant: "amber" },
  attendance: { label: "Attendance", variant: "green" },
  behavioral: { label: "Behavioral", variant: "blue" },
};

interface AnecdotalRecordItem {
  id: string;
  observationDatetime: string;
  category: string;
  confidentialityLevel: string;
  mine?: boolean;
  followupCount?: number;
}

interface AnecdotalResponse {
  student: { studentId: string; name: string; lrn: string; section: string };
  records: AnecdotalRecordItem[];
}

async function fetchAdviseeAnecdotal(studentId: string): Promise<AnecdotalResponse> {
  const { data } = await apiClient.get<AnecdotalResponse>(
    `/api/teacher/advisory/students/${encodeURIComponent(studentId)}/anecdotal`,
  );
  return data;
}

function generalAverageOf(row: AdviseeRow): number | null {
  const values = (row.liveGrades ?? [])
    .map((g) => g.average)
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function AdvisoryInsightBoard({
  student,
  bare = false,
}: {
  student: AdviseeRow | null;
  bare?: boolean;
}) {
  const studentId = student?.studentId ?? null;
  const isRoster = studentId?.startsWith("roster:") ?? false;

  const attendanceQuery = useQuery<StudentAttendance>({
    queryKey: ["advisee-attendance", studentId],
    queryFn: () => fetchStudentAttendance(studentId as string),
    enabled: !!studentId,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const academicQuery = useQuery<StudentAcademic>({
    queryKey: ["advisee-academic", studentId],
    queryFn: () => fetchStudentAcademic(studentId as string),
    enabled: !!studentId,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const anecdotalQuery = useQuery<AnecdotalResponse>({
    queryKey: ["advisee-anecdotal", studentId],
    queryFn: () => fetchAdviseeAnecdotal(studentId as string),
    enabled: !!studentId && !isRoster,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const liveAttendanceRate =
    attendanceQuery.data?.summary.rate ?? student?.attendanceRate ?? 1;
  const liveGeneralAverage = React.useMemo(() => {
    const fromAcademic = academicQuery.data?.summary.average ?? null;
    if (typeof fromAcademic === "number" && Number.isFinite(fromAcademic))
      return fromAcademic;
    return student ? generalAverageOf(student) : null;
  }, [academicQuery.data, student]);

  const liveGrades = React.useMemo(() => {
    const codeBySubject = new Map(
      (student?.liveGrades ?? []).map((g) => [g.subject, g.code] as const),
    );
    const base = academicQuery.data
      ? academicQuery.data.grades
          .filter((g) => g.computedAverage !== null && !g.hiddenByTeacher)
          .map((g) => ({ subject: g.subject, average: g.computedAverage as number }))
      : (student?.liveGrades ?? []).map((g) => ({
          subject: g.subject,
          average: g.average,
        }));
    return base
      .map((g) => ({
        ...g,
        code:
          codeBySubject.get(g.subject) ??
          g.subject
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w[0])
            .join("")
            .toUpperCase(),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [academicQuery.data, student]);

  const anecdotalRecords: AnecdotalRecordItem[] = React.useMemo(
    () => anecdotalQuery.data?.records ?? [],
    [anecdotalQuery.data],
  );
  const anecdotalCount = isRoster
    ? (student?.anecdotalCount ?? 0)
    : (anecdotalQuery.data?.records.length ?? student?.anecdotalCount ?? 0);

  if (!student) {
    return (
      <div className={`${styles.board} ${bare ? styles.bare : ""}`} aria-label="Student insight">
        <header className={styles.boardHead}>
          <span className={styles.boardIcon} aria-hidden>
            <KanbanSquare size={18} />
          </span>
          <div className="min-w-0">
            <h2 className={styles.boardTitle}>Student insight</h2>
            <p className={styles.boardSub}>Select a row on the left to inspect</p>
          </div>
        </header>
        <p className={styles.empty}>No student selected.</p>
      </div>
    );
  }

  const loading =
    attendanceQuery.isPending || academicQuery.isPending || (!isRoster && anecdotalQuery.isPending);
  const hiddenGrades = academicQuery.data?.hiddenCount ?? 0;
  const attendanceRestricted = attendanceQuery.data?.restricted ?? false;
  const subjectSummary = attendanceQuery.data?.subjectSummary ?? null;
  const attendancePct = subjectSummary
    ? Math.round(subjectSummary.rate * 100)
    : Math.round(liveAttendanceRate * 100);
  const attRisk = subjectSummary
    ? subjectSummary.isRisk
    : (attendanceQuery.data?.summary.isRisk ?? false);
  const activeFlags = (student.flags ?? []).filter((f) => f in FACTOR_BADGE);

  return (
    <div className={`${styles.board} ${bare ? styles.bare : ""}`} aria-label={`Insight for ${student.name}`}>
      <header className={styles.boardHead}>
        <span className={styles.boardIcon} aria-hidden>
          <KanbanSquare size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={styles.boardTitle}>Student insight</h2>
          <span className="mt-1 flex max-w-full flex-wrap items-center gap-1">
            <span className={styles.headPill}>Attendance</span>
            <span className={styles.headPill}>Grades</span>
            <span className={styles.headPill}>Anecdotal</span>
          </span>
        </div>
      </header>

      {loading ? (
        <div className={styles.skel} aria-busy="true" aria-label="Loading insight">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <section className={styles.plainSection} aria-label="Risk and records">
          <header className={styles.laneHead}>
            <span
              className={styles.laneDot}
              style={{ background: riskDotColor(student.riskLevel) }}
              aria-hidden
            />
            <h3 className={styles.laneTitle}>Risk &amp; records</h3>
            <span className={styles.laneCount}>4</span>
          </header>
          <ul className={styles.cardGrid} key={student.studentId}>
            <li className="min-w-0">
              <section className={styles.lane} aria-label={`Risk factors lane for ${student.name}`}>
                <header className={styles.colHead}>
                  <span className={styles.colIcon} aria-hidden>
                    <ShieldAlert size={18} />
                  </span>
                  <h4 className={styles.colTitle}>Risk factors</h4>
                  <span
                    className={`${styles.kPill} ${
                      student.riskLevel === "High"
                        ? styles.kPillRed
                        : student.riskLevel === "Low"
                          ? styles.kPillGreen
                          : ""
                    }`}
                  >
                    {student.riskLevel}
                  </span>
                </header>
                {activeFlags.length === 0 ? (
                  <p className={styles.empty}>All clear — no active factors.</p>
                ) : (
                  <ul className={styles.laneBody}>
                    <li
                      className={styles.kCard}
                      aria-label={`Risk factors for ${student.name}`}
                    >
                      <p className={styles.kLabel}>Active factors</p>
                      <span className="flex flex-wrap items-center gap-1">
                        {activeFlags.map((f) => (
                          <Badge key={f} variant={FACTOR_BADGE[f].variant}>
                            {FACTOR_BADGE[f].label}
                          </Badge>
                        ))}
                      </span>
                    </li>
                  </ul>
                )}
              </section>
            </li>

            <li className="min-w-0">
              <section className={styles.lane} aria-label={`Attendance lane for ${student.name}`}>
                <header className={styles.colHead}>
                  <span className={styles.colIcon} aria-hidden>
                    <CalendarClock size={18} />
                  </span>
                  <h4 className={styles.colTitle}>Attendance</h4>
                  <span
                    className={
                      attRisk
                        ? `${styles.kPill} ${styles.kPillRed}`
                        : styles.kPill
                    }
                  >
                    {attRisk ? "At risk" : "On track"}
                  </span>
                  {attendanceQuery.isFetching ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-[16px] border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                      aria-live="polite"
                    >
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                      Updating
                    </span>
                  ) : null}
                </header>
                <ul className={styles.laneBody}>
                  <li
                    className={styles.kCard}
                    aria-label={`Attendance for ${student.name}`}
                  >
                    {attendanceRestricted ? (
                      <p className={styles.cardMeta}>Some marks hidden — subject teacher sharing is OFF.</p>
                    ) : null}
                    <p className={styles.kLabel}>
                      Present rate
                    </p>
                    <div className={styles.kBottom}>
                      <p className={styles.kTitle}>
                        {subjectSummary
                          ? `${subjectSummary.present} of ${subjectSummary.total} subject marks · ${subjectSummary.bySubject.length} subjects`
                          : attendanceQuery.data
                            ? `${attendanceQuery.data.summary.present} of ${attendanceQuery.data.summary.total} sessions`
                            : "Snapshot from roster"}
                      </p>
                      <p className={styles.kBig}>
                        {attendancePct}
                        <span className={styles.kUnit}>%</span>
                      </p>
                    </div>
                  </li>
                </ul>
              </section>
            </li>

            <li className="min-w-0">
              <section className={styles.lane} aria-label={`Live academics lane for ${student.name}`}>
                <header className={styles.colHead}>
                  <span className={styles.colIcon} aria-hidden>
                    <BookOpen size={18} />
                  </span>
                  <h4 className={styles.colTitle}>Live academics</h4>
                  <span className={styles.colCount}>{liveGrades.length}</span>
                </header>
                {hiddenGrades > 0 ? (
                  <p className={styles.cardMeta}>
                    {hiddenGrades} subject{hiddenGrades === 1 ? "" : "s"} hidden — teacher sharing is OFF.
                  </p>
                ) : null}
                {liveGrades.length === 0 ? (
                  <p className={styles.empty}>No live scores shared by subject teachers yet.</p>
                ) : (
                  <ul className={styles.laneBody}>
                    {liveGrades.slice(0, 5).map((g) => (
                      <li
                        key={g.subject}
                        className={styles.kCard}
                        aria-label={`${g.subject} live average ${g.average.toFixed(1)}`}
                      >
                        <div className={styles.kTop}>
                          <span className={styles.kPill}>{g.code}</span>
                          <span className={styles.kCircle} aria-hidden>
                            <BookOpen size={14} />
                          </span>
                        </div>
                        <p className={styles.kLabel}>Subject</p>
                        <div className={styles.kBottom}>
                          <p className={styles.kTitle} title={g.subject}>
                            {g.subject}
                          </p>
                          <p className={styles.kBig}>
                            {g.average.toFixed(1)}
                            <span className={styles.kUnit}>avg</span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {liveGrades.length > 5 ? (
                  <p className={styles.cardMeta}>
                    +{liveGrades.length - 5} more subject{liveGrades.length - 5 === 1 ? "" : "s"}
                  </p>
                ) : null}
              </section>
            </li>

            <li className="min-w-0">
              <section className={styles.lane} aria-label={`Anecdotal lane for ${student.name}`}>
                <header className={styles.colHead}>
                  <span className={styles.colIcon} aria-hidden>
                    <FilePenLine size={18} />
                  </span>
                  <h4 className={styles.colTitle}>Anecdotal</h4>
                  <span className={styles.colCount}>{anecdotalCount}</span>
                </header>
                {isRoster || anecdotalRecords.length === 0 ? (
                  <p className={styles.empty}>
                    {isRoster
                      ? "Roster-only file — category only, never the private write-up."
                      : "No anecdotal records this term."}
                  </p>
                ) : (
                  <ul className={styles.laneBody}>
                    {Array.from(new Set(anecdotalRecords.map((r) => String(r.category))))
                      .slice(0, 4)
                      .map((c) => {
                        const count = anecdotalRecords.filter(
                          (r) => String(r.category) === c,
                        ).length;
                        return (
                          <li
                            key={c}
                            className={styles.kCard}
                            aria-label={`${c} anecdotal records for ${student.name}`}
                          >
                            <div className={styles.kTop}>
                              <span className={styles.kPill}>{c}</span>
                              <span className={styles.kCircle} aria-hidden>
                                <FilePenLine size={14} />
                              </span>
                            </div>
                            <p className={styles.kLabel}>Records filed</p>
                            <div className={styles.kBottom}>
                              <p className={styles.kTitle}>{c}</p>
                              <p className={styles.kBig}>
                                {count}
                                <span className={styles.kUnit}>filed</span>
                              </p>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </section>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
