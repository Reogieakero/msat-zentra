import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { sessionCancelledByRole } from "../../lib/sessionActors.js";
import {
  evaluateRisk,
  evaluateRosterRisk,
} from "../risk.js";
import type { TermScopeInput } from "../../lib/termScope.js";
import { getInterventionStudents } from "../../modules/risk/interventions.service.js";
import { GRADE_LABELS } from "../../modules/interventions/interventions.repository.js";
import type { InterventionContext } from "./intervention.types.js";

export interface QueueQuery {
  level: string;
  factor: "Academic" | "Attendance" | "Behavioral" | null;
  mineOnly: boolean;
  outcome: string;
  q: string;
  page: number;
  pageSize: number;
}

// Guidance at-risk engine queue: LIVE high-risk students for the active term,
// each carrying the risk factors that tripped plus their current follow-up
// (if the engine — or guidance — already opened one). Defaults to High;
// Moderate/All and per-factor views are one filter away. Everything is
// recomputed from current grades, attendance, and behavior filings — stored
// snapshot levels are never trusted directly.
export async function listQueue(ctx: InterventionContext, query: QueueQuery, termScope?: TermScopeInput) {
  const me = ctx.userId;
  const { levelFilter, factorFilter, mineOnly, outcomeFilter, q, page, pageSize } = {
    levelFilter: query.level,
    factorFilter: query.factor,
    mineOnly: query.mineOnly,
    outcomeFilter: query.outcome,
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
  };

  // One full-cohort engine read; every view below filters the LIVE values
  // in memory so counts and pages always agree with each other.
  // fullCohort enumerates the live enrollment (profiles + roster, no
  // account required) instead of starting from engine snapshots, so
  // at-risk students the engine hasn't flagged yet still appear.
  // includeRecovered keeps students whose risk cleared but whose
  // follow-up is still open, so the case can be discontinued on the
  // desk instead of silently vanishing from the queue.
  const cohort = await getInterventionStudents(
    { page: 1, pageSize: 1000, includeRecovered: true, fullCohort: true },
    termScope ?? undefined,
  );

  const factorKey =
    factorFilter === "Academic"
      ? "academic"
      : factorFilter === "Attendance"
        ? "attendance"
        : factorFilter === "Behavioral"
          ? "behavioral"
          : null;

  const matches = (s: (typeof cohort.students)[number]) => {
    // Recovered students (live Low, follow-up still open) stay visible
    // under every level view — they are actionable discontinue items,
    // not at-risk cases, so the level filter never hides them.
    const recovered =
      s.riskLevel === "Low" && s.intervention?.outcomeStatus === "ongoing";
    if (levelFilter !== "All" && s.riskLevel !== levelFilter && !recovered) return false;
    if (factorKey && !s.factors[factorKey as keyof typeof s.factors]) return false;
    if (mineOnly && s.intervention?.assignedTo !== me) return false;
    // Default queue hides closed follow-ups (resolved or not resolved) —
    // finished work leaves the list; the filter brings it back.
    const out = s.intervention?.outcomeStatus ?? null;
    if (outcomeFilter === "all") {
      // show everything
    } else if (outcomeFilter) {
      if (!out || out !== outcomeFilter) return false;
    } else if (out === "resolved" || out === "unresolved") {
      return false;
    }
    if (
      q &&
      !`${s.studentName} ${s.lrn} ${s.section} ${s.intervention?.recommendedAction ?? ""} ${s.intervention?.assignedStaffName ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  };

  const levelRank = (level: string) =>
    level === "High" ? 0 : level === "Moderate" ? 1 : 2;
  const listed = cohort.students
    .filter(matches)
    .sort(
      (a, b) =>
        levelRank(a.riskLevel) - levelRank(b.riskLevel) ||
        b.riskCount - a.riskCount ||
        a.studentName.localeCompare(b.studentName)
    );

  const total = listed.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = listed.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Read-only context only: how many adviser-referred guidance cases this
  // student has (open vs closed). Never mixed into the engine follow-up —
  // no shared sessions, statuses, or actions cross the pipelines.
  const OPEN_REFERRAL = new Set([
    "pending",
    "in_progress",
    "escalated",
    "info_requested",
    "follow_up",
  ]);
  const refByKey = new Map<string, { open: number; closed: number }>();
  if (slice.length > 0) {
    const profileIds = slice
      .map((s) => s.studentId)
      .filter((id) => !id.startsWith("roster:"));
    const rosterIds = slice
      .map((s) => s.studentId)
      .filter((id) => id.startsWith("roster:"))
      .map((id) => id.slice("roster:".length));
    const refRows = await prisma.referral.findMany({
      where: {
        referredToRole: "guidance_counselor",
        OR: [
          ...(profileIds.length ? [{ studentId: { in: profileIds } }] : []),
          ...(rosterIds.length ? [{ rosterId: { in: rosterIds } }] : []),
        ],
      },
      select: { studentId: true, rosterId: true, status: true },
    });
    for (const r of refRows) {
      const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
      if (!key) continue;
      const entry = refByKey.get(key) ?? { open: 0, closed: 0 };
      if (OPEN_REFERRAL.has(r.status)) entry.open += 1;
      else entry.closed += 1;
      refByKey.set(key, entry);
    }
  }

  const students = slice.map((s) => ({
    studentKey: s.studentId,
    lrn: s.lrn,
    student: s.studentName,
    section: s.section,
    grade: GRADE_LABELS[s.gradeLevel] ?? "",
    riskLevel: s.riskLevel,
    riskCount: s.riskCount,
    // Engine detection moment for the active term (RiskSnapshot date).
    // Null only for legacy rows — the table falls back to the follow-up
    // opened date, then to a dateless engine-flag label.
    detectedAt: s.snapshotDate ?? null,
    factors: s.factors,
    referralContext: refByKey.get(s.studentId) ?? { open: 0, closed: 0 },
    intervention: s.intervention
      ? {
          id: s.intervention.id,
          recommendedAction: s.intervention.recommendedAction,
          assigneeId: s.intervention.assignedTo ?? "",
          assignee: s.intervention.assignedStaffName ?? "",
          approvalStatus: s.intervention.approvalStatus,
          outcomeStatus: s.intervention.outcomeStatus,
          outcomeNotes: s.intervention.outcomeNotes ?? "",
          priority: s.intervention.priority ?? "",
          intakeNotes: s.intervention.intakeNotes ?? "",
          // Opened date for queue date columns (null for legacy rows).
          createdAt: s.intervention.createdAt,
          sessions: s.intervention.sessions.map((sess) => ({
            id: sess.id,
            sessionType: sess.sessionType,
            scheduledAt: sess.scheduledAt.toISOString(),
            date: sess.scheduledAt.toISOString().slice(0, 10),
            venue: sess.venue ?? "",
            status: sess.status,
            sessionNotes: sess.sessionNotes ?? "",
            outcome: sess.outcome ?? "",
            cancelReason: sess.cancelReason ?? "",
            createdAt: sess.createdAt.toISOString(),
            completedAt: sess.completedAt ? sess.completedAt.toISOString() : "",
            attachmentsCount: sess.attachmentsCount ?? 0,
          })),
          completedSessions: s.intervention.sessions.filter(
            (sess) => sess.status === "completed"
          ).length,
        }
      : null,
  }));

  // Who cancelled each session (desk cancel vs adviser contexts) —
  // latest session_cancelled audit wins; never-cancelled stay null.
  const cancelledByRole = await sessionCancelledByRole(
    slice.flatMap((s) => (s.intervention?.sessions ?? []).map((sess) => sess.id))
  );
  for (const st of students) {
    const sessions = st.intervention?.sessions as
      | { id: string; cancelledByRole?: string | null }[]
      | undefined;
    if (sessions) {
      for (const sess of sessions) {
        sess.cancelledByRole = cancelledByRole.get(sess.id) ?? null;
      }
    }
  }

  // Tile stats stay UNFILTERED; `total` is the filtered pager count.
  const unfilteredTotal = cohort.students.length;
  return {
    summary: {
      high: cohort.students.filter((s) => s.riskLevel === "High").length,
      moderate: cohort.students.filter((s) => s.riskLevel === "Moderate").length,
      waitingReview: cohort.students.filter(
        (s) => s.intervention?.approvalStatus === "pending"
      ).length,
      ongoing: cohort.students.filter(
        (s) => s.intervention?.outcomeStatus === "ongoing"
      ).length,
      resolved: cohort.students.filter(
        (s) =>
          s.intervention?.outcomeStatus === "resolved" ||
          s.intervention?.outcomeStatus === "unresolved"
      ).length,
      mine: cohort.students.filter((s) => s.intervention?.assignedTo === me).length,
      total: unfilteredTotal,
    },
    students,
    page: safePage,
    pageSize,
    total,
    totalPages,
    unfilteredTotal,
  };
}

// Staff directory for intervention assignment — the people guidance can hand
// a follow-up to (advisers, subject teachers, nurse, ADM coordinator, fellow
// counselors). Status-only directory: id, name, role. No student data.
export async function listStaff() {
  const staff = await prisma.user.findMany({
    where: {
      status: "active",
      role: {
        in: [
          "adviser",
          "subject_teacher",
          "nurse",
          "adm_coordinator",
          "guidance_counselor",
        ],
      },
    },
    select: { id: true, fullName: true, role: true },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });
  return { staff };
}

export interface EngineQuery {
  studentId: string | null;
  rosterId: string | null;
  termId: string | null;
}

// Live engine breakdown for one student — powers the See-details risk
// panel (factors with real values, live vs stored vs flagged levels).
// Read-only; never writes snapshots or interventions.
export async function getEngineBreakdown(query: EngineQuery) {
  const { studentId, rosterId, termId } = query;
  if ((studentId && rosterId) || (!studentId && !rosterId)) {
    throw new AppError(400, "INVALID_ACTION", "Pick exactly one student");
  }
  if (!termId) throw new AppError(400, "NO_ACTIVE_TERM", "No active term to evaluate");
  const live = studentId
    ? await evaluateRisk(studentId, termId)
    : await evaluateRosterRisk(rosterId!, termId);

  const gradeWhere = studentId ? { studentId, termId } : { rosterId: rosterId!, termId };
  const attWhere = studentId ? { studentId, termId } : { rosterId: rosterId!, termId };
  const [grades, attendance, anecdotals, snapshot, flagged] = await Promise.all([
    prisma.finalGrade.findMany({
      where: gradeWhere,
      select: {
        computedAverage: true,
        transmutedGrade: true,
        subject: { select: { name: true, code: true } },
      },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.attendanceRecord.findMany({
      where: attWhere,
      select: {
        status: true,
        subjectId: true,
        subject: { select: { name: true, code: true } },
      },
    }),
    prisma.anecdotalRecord.findMany({
      where: studentId ? { studentId, termId } : { rosterId: rosterId!, termId },
      select: { category: true, observationDatetime: true },
      orderBy: { observationDatetime: "desc" },
      take: 5,
    }),
    prisma.riskSnapshot.findFirst({
      where: studentId ? { studentId, termId } : { rosterId: rosterId!, termId },
      orderBy: { snapshotDate: "desc" },
      select: { riskLevel: true, riskCount: true, snapshotDate: true },
    }),
    prisma.intervention.findFirst({
      where: studentId ? { studentId } : { rosterId: rosterId! },
      orderBy: { id: "desc" },
      select: { riskLevelAtFlag: true },
    }),
  ]);

  const present = attendance.filter((a) => a.status === "present").length;
  const subjectEra = attendance.some((a) => a.subjectId !== null);
  const rate = attendance.length > 0 ? present / attendance.length : null;
  // Raw percentage average across ALL final-grade subjects (display
  // basis; the engine flag itself runs on transmuted grades).
  const raws = grades
    .map((g) => g.computedAverage)
    .filter((v): v is number => typeof v === "number");
  const rawAverage =
    raws.length > 0 ? raws.reduce((s, v) => s + v, 0) / raws.length : null;
  // Transmuted mean — the number the Low/Clear badge actually answers
  // to. Shown beside the raw average so the badge reads coherently
  // (raw 67% routinely transmutes above the 75 line).
  const transmutes = grades
    .map((g) => g.transmutedGrade)
    .filter((v): v is number => typeof v === "number");
  const transmutedAverage =
    transmutes.length > 0
      ? transmutes.reduce((s, v) => s + v, 0) / transmutes.length
      : null;
  // Per-subject attendance (subject-era rows) + a General bucket for
  // legacy AM/PM rows without a subject.
  const bySubjectMap = new Map<
    string,
    { code: string; name: string; present: number; total: number }
  >();
  let generalPresent = 0;
  let generalTotal = 0;
  for (const a of attendance) {
    if (!a.subjectId) {
      generalTotal += 1;
      if (a.status === "present") generalPresent += 1;
      continue;
    }
    const key = a.subjectId;
    const entry = bySubjectMap.get(key) ?? {
      code: a.subject?.code ?? "",
      name: a.subject?.name ?? "Subject",
      present: 0,
      total: 0,
    };
    entry.total += 1;
    if (a.status === "present") entry.present += 1;
    bySubjectMap.set(key, entry);
  }
  const bySubject = [...bySubjectMap.values()]
    .map((s) => ({
      ...s,
      rate: s.total > 0 ? s.present / s.total : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    live: {
      level: live.result.riskLevel,
      count: live.result.riskCount,
      academic: live.academicFlag,
      attendance: live.attendanceFlag,
      behavioral: live.behavioralFlag,
    },
    academic: {
      average: rawAverage,
      transmutedAverage,
      subjectCount: grades.length,
      threshold: 75,
      subjects: grades.map((g) => ({
        code: g.subject?.code ?? "",
        name: g.subject?.name ?? "Subject",
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
        below: (g.transmutedGrade ?? g.computedAverage ?? 100) < 75,
      })),
    },
    attendance: {
      rate,
      present,
      total: attendance.length,
      subjectEra,
      threshold: 0.8,
      bySubject,
      general:
        generalTotal > 0
          ? {
              present: generalPresent,
              total: generalTotal,
              rate: generalPresent / generalTotal,
            }
          : null,
    },
    behavioral: {
      count: anecdotals.length,
      recent: anecdotals.map((a) => ({
        category: a.category,
        date: a.observationDatetime.toISOString().slice(0, 10),
      })),
    },
    stored: snapshot
      ? {
          level: snapshot.riskLevel,
          count: snapshot.riskCount,
          date: snapshot.snapshotDate.toISOString().slice(0, 10),
        }
      : null,
    flagged: flagged ? { level: flagged.riskLevelAtFlag } : null,
  };
}
