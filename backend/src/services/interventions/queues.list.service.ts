import { prisma } from "../../lib/prisma.js";
import { sessionCancelledByRole } from "../../lib/sessionActors.js";
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

    const recovered =
      s.riskLevel === "Low" && s.intervention?.outcomeStatus === "ongoing";
    if (levelFilter !== "All" && s.riskLevel !== levelFilter && !recovered) return false;
    if (factorKey && !s.factors[factorKey as keyof typeof s.factors]) return false;
    if (mineOnly && s.intervention?.assignedTo !== me) return false;

    const out = s.intervention?.outcomeStatus ?? null;
    if (outcomeFilter === "all") {

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
