import { prisma } from "../../lib/prisma.js";
import type { OutcomeStatus, RiskLevel } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import {
  resolveActiveTermId,
  computeRiskFactors,
  levelFromFlags,
  type GradeMode,
} from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";

export type ApprovalStatusValue = "pending" | "approved" | "rejected" | "modified";
export type OutcomeStatusValue = "ongoing" | "resolved" | "unresolved";
export type RiskLevelValue = "Low" | "Moderate" | "High";

export interface InterventionLink {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignedStaffName: string | null;
  approvalStatus: ApprovalStatusValue;
  outcomeStatus: OutcomeStatusValue;
  outcomeNotes: string | null;
  priority: string | null;
  intakeNotes: string | null;
  sessions: InterventionSessionLink[];
  createdAt: string | null;
}

export interface InterventionSessionLink {
  id: string;
  sessionType: string;
  scheduledAt: Date;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
  attachmentsCount: number;
}

export interface SubjectGrade {
  subject: string;
  code: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  belowThreshold: boolean;
}

export interface RiskFactors {
  academic: boolean;
  attendance: boolean;
  behavioral: boolean;
}

export interface RiskSnapshotStudent {
  studentId: string;
  lrn: string;
  studentName: string;
  section: string;
  gradeLevel: string;
  riskLevel: string;
  riskCount: number;
  snapshotDate: string | null;
  factors: RiskFactors;
  subjectGrades: SubjectGrade[];
  intervention: InterventionLink | null;
}

export interface InterventionStudentsResult {
  students: RiskSnapshotStudent[];
  total: number;
  page: number;
  pageSize: number;
  highModerate: number;
}

export interface StudentFilters {
  riskLevel?: RiskLevelValue;
  hasIntervention?: boolean;
  factor?: "Academic" | "Attendance" | "Behavioral";
  // "final" computes the academic factor from transmuted grades; "raw" from the
  // raw computed average. Drives both the academic factor flag and filtering.
  gradeMode?: GradeMode;
  // Guidance queue only: also include students whose live risk dropped to Low
  // but who still carry an ongoing intervention, so the case can be
  // discontinued explicitly instead of silently vanishing from the queue.
  includeRecovered?: boolean;
  // Guidance queue only: enumerate the full live enrollment (profiles +
  // roster, no account required) instead of starting from engine
  // snapshots, so at-risk students the engine hasn't snapshotted yet
  // still appear. Principal endpoints keep snapshot behavior.
  fullCohort?: boolean;
  page?: number;
  pageSize?: number;
}

type InterventionRow = {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  approvalStatus: ApprovalStatusValue;
  outcomeStatus: OutcomeStatusValue;
  outcomeNotes: string | null;
  priority: string | null;
  intakeNotes: string | null;
  counselingSessions: {
    id: string;
    sessionType: string;
    scheduledAt: Date;
    venue: string | null;
    status: string;
    sessionNotes: string | null;
    outcome: string | null;
    cancelReason: string | null;
    createdAt: Date;
    completedAt: Date | null;
    attachments: { id: string }[];
  }[];
  assignedAt: Date | null;
  assignee: { fullName: string } | null;
};

function toInterventionLink(iv: InterventionRow | undefined): InterventionLink | null {
  return iv
    ? {
        id: iv.id,
        recommendedAction: iv.recommendedAction,
        assignedTo: iv.assignedTo,
        assignedStaffName: iv.assignee?.fullName ?? null,
        approvalStatus: iv.approvalStatus,
        outcomeStatus: iv.outcomeStatus,
        outcomeNotes: iv.outcomeNotes,
        priority: iv.priority,
        intakeNotes: iv.intakeNotes,
        sessions: iv.counselingSessions.map((s) => ({
          id: s.id,
          sessionType: s.sessionType,
          scheduledAt: s.scheduledAt,
          venue: s.venue,
          status: s.status,
          sessionNotes: s.sessionNotes,
          outcome: s.outcome,
          cancelReason: s.cancelReason,
          createdAt: s.createdAt,
          completedAt: s.completedAt,
          attachmentsCount: s.attachments.length,
        })),
        createdAt: iv.assignedAt ? iv.assignedAt.toISOString() : null,
      }
    : null;
}

// Principal: list of at-risk students from RiskSnapshot (engine-flagged) for the
// active term, scoped to the principal's school year. Each student carries their
// latest Intervention (if any) so the principal can decide/assign/track.
// Enlisted students without accounts merge in on equal footing (matched by LRN
// so nobody appears twice after registering).
export async function getInterventionStudents(
  filters: StudentFilters
): Promise<InterventionStudentsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

  const termId = await resolveActiveTermId();
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const schoolYearId = schoolYear?.id;

  if (!termId) {
    return { students: [], total: 0, page, pageSize, highModerate: 0 };
  }

  // Full-cohort mode (guidance queue): enumerate the live enrollment
  // instead of starting from engine snapshots.
  if (filters.fullCohort) {
    return getLiveCohortStudents(termId, schoolYearId, filters, page, pageSize);
  }

  // Build the student-scoped filter without clobbering `student` across the
  // three optional conditions (school year + has/none intervention).
  const studentWhere: Record<string, unknown> = {};
  if (schoolYearId) studentWhere.section = { schoolYearId };
  if (filters.hasIntervention === true) studentWhere.interventions = { some: {} };
  if (filters.hasIntervention === false) studentWhere.interventions = { none: {} };

  // Recovered students (Low snapshot, ongoing intervention) join the queue
  // only when asked and only when no single-level filter is active — the
  // principal views never set the flag, so their counts never change.
  const includeRecovered = filters.includeRecovered === true && !filters.riskLevel;
  const levelClause = includeRecovered
    ? {
        OR: [
          { riskLevel: { in: ["High", "Moderate"] as RiskLevel[] } },
          {
            riskLevel: "Low" as RiskLevel,
            student: {
              is: { interventions: { some: { outcomeStatus: "ongoing" as OutcomeStatus } } },
            },
          },
        ],
      }
    : { riskLevel: filters.riskLevel ? filters.riskLevel : ({ in: ["High", "Moderate"] as RiskLevel[] }) };
  const where = {
    termId,
    ...levelClause,
    ...(Object.keys(studentWhere).length ? { student: studentWhere } : {}),
  };

  // Roster twin of the filter above (roster relation instead of profile).
  const rosterWhere: Record<string, unknown> = {};
  if (schoolYearId) rosterWhere.section = { schoolYearId };
  if (filters.hasIntervention === true) rosterWhere.interventions = { some: {} };
  if (filters.hasIntervention === false) rosterWhere.interventions = { none: {} };

  const rosterLevelClause = includeRecovered
    ? {
        OR: [
          { riskLevel: { in: ["High", "Moderate"] as RiskLevel[] } },
          {
            riskLevel: "Low" as RiskLevel,
            roster: {
              is: { interventions: { some: { outcomeStatus: "ongoing" as OutcomeStatus } } },
            },
          },
        ],
      }
    : { riskLevel: filters.riskLevel ? filters.riskLevel : ({ in: ["High", "Moderate"] as RiskLevel[] }) };
  const rosterSnapWhere = {
    termId,
    ...rosterLevelClause,
    ...(Object.keys(rosterWhere).length ? { roster: rosterWhere } : {}),
    // Only snapshots actually keyed to a roster entry (never profile rows).
    rosterId: { not: null },
  };

  // Fetch the full at-risk cohort for the scope (small: ≤ a few hundred). We
  // compute the per-factor breakdown live from the engine rule so the principal
  // can filter by factor and inspect the academic subject grades. Pagination is
  // applied in memory after factor/filter computation to keep counts correct.
  const [snaps, rosterSnaps] = await Promise.all([
    prisma.riskSnapshot.findMany({
      where,
      orderBy: [{ riskLevel: "desc" }, { riskCount: "desc" }, { student: { lrn: "asc" } }],
      select: {
        id: true,
        riskLevel: true,
        riskCount: true,
        snapshotDate: true,
        student: {
          select: {
            userId: true,
            lrn: true,
            gradeLevel: true,
            section: { select: { id: true, name: true, _count: { select: { students: true } } } },
            user: { select: { fullName: true } },
            finalGrades: {
              where: { termId },
              select: {
                computedAverage: true,
                transmutedGrade: true,
                subject: { select: { name: true, code: true } },
              },
            },
            attendanceRecords: { where: { termId }, select: { status: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
            interventions: {
              orderBy: { id: "desc" },
              take: 1,
              select: {
                id: true,
                recommendedAction: true,
                assignedTo: true,
                approvalStatus: true,
                outcomeStatus: true,
                outcomeNotes: true,
                priority: true,
                intakeNotes: true,
                counselingSessions: {
                  orderBy: { scheduledAt: "asc" },
                  select: {
                    id: true,
                    sessionType: true,
                    scheduledAt: true,
                    venue: true,
                    status: true,
                    sessionNotes: true,
                    outcome: true,
                    cancelReason: true,
                    createdAt: true,
                    completedAt: true,
                    attachments: { select: { id: true } },
                  },
                },
                assignedAt: true,
                assignee: { select: { fullName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.riskSnapshot.findMany({
      where: rosterSnapWhere,
      orderBy: [{ riskLevel: "desc" }, { riskCount: "desc" }],
      select: {
        id: true,
        riskLevel: true,
        riskCount: true,
        snapshotDate: true,
        rosterId: true,
        roster: {
          select: {
            id: true,
            lrn: true,
            fullName: true,
            gradeLevel: true,
            section: { select: { id: true, name: true } },
            finalGrades: {
              where: { termId },
              select: {
                computedAverage: true,
                transmutedGrade: true,
                subject: { select: { name: true, code: true } },
              },
            },
            attendanceRecords: { where: { termId }, select: { status: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
            interventions: {
              orderBy: { id: "desc" },
              take: 1,
              select: {
                id: true,
                recommendedAction: true,
                assignedTo: true,
                approvalStatus: true,
                outcomeStatus: true,
                outcomeNotes: true,
                priority: true,
                intakeNotes: true,
                counselingSessions: {
                  orderBy: { scheduledAt: "asc" },
                  select: {
                    id: true,
                    sessionType: true,
                    scheduledAt: true,
                    venue: true,
                    status: true,
                    sessionNotes: true,
                    outcome: true,
                    cancelReason: true,
                    createdAt: true,
                    completedAt: true,
                    attachments: { select: { id: true } },
                  },
                },
                assignedAt: true,
                assignee: { select: { fullName: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  // A student can have more than one RiskSnapshot row for a term (engine
  // re-runs append new snapshots). Collapse to one row per student (matched by
  // LRN so profile + roster rows for the same learner merge, profile wins),
  // keeping the most recent snapshot, so the principal sees each at-risk
  // student once.
  type SnapRow = {
    snapshotDate: Date | null;
    studentId: string;
    lrn: string;
    studentName: string;
    section: string;
    sectionId: string;
    enrolledFallback: number;
    gradeLevel: string;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null; subject: { name: string; code: string } }[];
    attendanceRecords: { status: string }[];
    anecdotalCount: number;
    intervention: InterventionLink | null;
  };
  const byStudent = new Map<string, { date: number; row: SnapRow; profile: boolean }>();
  const consider = (lrn: string, date: Date | null, row: SnapRow, profile: boolean) => {
    const prev = byStudent.get(lrn);
    const when = date?.getTime() ?? 0;
    // Latest snapshot wins; profiles win ties so a registered student never
    // renders under a `roster:` key.
    if (!prev || when > prev.date || (when === prev.date && profile && !prev.profile)) {
      byStudent.set(lrn, { date: when, row, profile });
    }
  };
  for (const s of snaps) {
    const st = s.student;
    // Roster-keyed snapshots are covered by the roster query below.
    if (!st) continue;
    consider(st.lrn, s.snapshotDate, {
      snapshotDate: s.snapshotDate,
      studentId: st.userId,
      lrn: st.lrn,
      studentName: st.user.fullName,
      section: st.section?.name ?? "—",
      sectionId: st.section?.id ?? "",
      enrolledFallback: st.section?._count.students ?? 0,
      gradeLevel: st.gradeLevel,
      finalGrades: st.finalGrades,
      attendanceRecords: st.attendanceRecords,
      anecdotalCount: st.anecdotalRecords.length,
      intervention: toInterventionLink(st.interventions[0]),
    }, true);
  }
  for (const s of rosterSnaps) {
    const r = s.roster;
    if (!r) continue;
    consider(r.lrn, s.snapshotDate, {
      snapshotDate: s.snapshotDate,
      studentId: `roster:${r.id}`,
      lrn: r.lrn,
      studentName: r.fullName,
      section: r.section?.name ?? "—",
      sectionId: r.section?.id ?? "",
      enrolledFallback: 0,
      gradeLevel: r.gradeLevel,
      finalGrades: r.finalGrades,
      attendanceRecords: r.attendanceRecords,
      anecdotalCount: r.anecdotalRecords.length,
      intervention: toInterventionLink(r.interventions[0]),
    }, false);
  }
  const deduped = [...byStudent.values()].map((v) => v.row);

  const sectionIds = Array.from(new Set(deduped.map((r) => r.sectionId).filter(Boolean)));
  const headcounts = await sectionHeadcounts(sectionIds);

  const highModerate = deduped.length;

  const mapped: RiskSnapshotStudent[] = deduped.map((st) => {
    const enrolled = headcounts.get(st.sectionId) ?? st.enrolledFallback;
    const flags = computeRiskFactors({
      finalGrades: st.finalGrades.map((g) => ({
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
      })),
      gradeMode: filters.gradeMode ?? "final",
      attendance: st.attendanceRecords.map((a) => ({ status: a.status })),
      anecdotalCount: st.anecdotalCount,
      enrolled,
    });
    const level = levelFromFlags(flags);

    const subjectGrades: SubjectGrade[] = st.finalGrades.map((g) => ({
      subject: g.subject.name,
      code: g.subject.code,
      computedAverage: g.computedAverage,
      transmutedGrade: g.transmutedGrade,
      belowThreshold: (g.transmutedGrade ?? 100) < 75,
    }));

    return {
      studentId: st.studentId,
      lrn: st.lrn,
      studentName: st.studentName,
      section: st.section,
      gradeLevel: st.gradeLevel,
      riskLevel: level,
      riskCount:
        (flags.academicFlag ? 1 : 0) +
        (flags.attendanceFlag ? 1 : 0) +
        (flags.behavioralFlag ? 1 : 0),
      snapshotDate: st.snapshotDate ? st.snapshotDate.toISOString() : null,
      factors: {
        academic: flags.academicFlag,
        attendance: flags.attendanceFlag,
        behavioral: flags.behavioralFlag,
      },
      subjectGrades,
      intervention: st.intervention,
    };
  });

  // Factor filter (Academic / Attendance / Behavioral) applied in memory.
  const filtered = filters.factor
    ? mapped.filter((m) => m.factors[filters.factor!.toLowerCase() as keyof RiskFactors])
    : mapped;

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const students = filtered.slice(start, start + pageSize);

  return { students, total, page, pageSize, highModerate };
}

// Full-cohort enumeration for the guidance queue: every enrolled learner
// (account profiles AND roster-only students — no account required) is
// evaluated live, so at-risk students the engine hasn't snapshotted yet
// still appear. Mirrors the overview's enrollment scope and flag math;
// snapshot dates are joined in when rows exist (null otherwise, and the
// tables fall back to the follow-up opened date).
async function getLiveCohortStudents(
  termId: string,
  schoolYearId: string | undefined,
  filters: StudentFilters,
  page: number,
  pageSize: number
): Promise<InterventionStudentsResult> {
  const includeRecovered = filters.includeRecovered === true && !filters.riskLevel;
  const gradeMode = filters.gradeMode ?? "final";

  const [profiles, rosters, profileSnapDates, rosterSnapDates] = await Promise.all([
    prisma.studentProfile.findMany({
      where: schoolYearId ? { section: { schoolYearId } } : undefined,
      select: {
        userId: true,
        lrn: true,
        gradeLevel: true,
        section: { select: { id: true, name: true, _count: { select: { students: true } } } },
        user: { select: { fullName: true } },
        finalGrades: {
          where: { termId },
          select: {
            computedAverage: true,
            transmutedGrade: true,
            subject: { select: { name: true, code: true } },
          },
        },
        attendanceRecords: { where: { termId }, select: { status: true } },
        anecdotalRecords: { where: { termId }, select: { id: true } },
        interventions: {
          orderBy: { id: "desc" },
          take: 1,
          select: {
            id: true,
            recommendedAction: true,
            assignedTo: true,
            approvalStatus: true,
            outcomeStatus: true,
            outcomeNotes: true,
            priority: true,
            intakeNotes: true,
            counselingSessions: {
              orderBy: { scheduledAt: "asc" },
              select: {
                id: true,
                sessionType: true,
                scheduledAt: true,
                venue: true,
                status: true,
                sessionNotes: true,
                outcome: true,
                cancelReason: true,
                createdAt: true,
                completedAt: true,
                attachments: { select: { id: true } },
              },
            },
            assignedAt: true,
            assignee: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.studentRoster.findMany({
      where: schoolYearId ? { schoolYearId } : undefined,
      select: {
        id: true,
        lrn: true,
        fullName: true,
        gradeLevel: true,
        sectionId: true,
        section: { select: { id: true, name: true } },
        finalGrades: {
          where: { termId },
          select: {
            computedAverage: true,
            transmutedGrade: true,
            subject: { select: { name: true, code: true } },
          },
        },
        attendanceRecords: { where: { termId }, select: { status: true } },
        anecdotalRecords: { where: { termId }, select: { id: true } },
        interventions: {
          orderBy: { id: "desc" },
          take: 1,
          select: {
            id: true,
            recommendedAction: true,
            assignedTo: true,
            approvalStatus: true,
            outcomeStatus: true,
            outcomeNotes: true,
            priority: true,
            intakeNotes: true,
            counselingSessions: {
              orderBy: { scheduledAt: "asc" },
              select: {
                id: true,
                sessionType: true,
                scheduledAt: true,
                venue: true,
                status: true,
                sessionNotes: true,
                outcome: true,
                cancelReason: true,
                createdAt: true,
                completedAt: true,
                attachments: { select: { id: true } },
              },
            },
            assignedAt: true,
            assignee: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.riskSnapshot.groupBy({
      by: ["studentId"],
      where: { termId, NOT: { studentId: null } },
      _max: { snapshotDate: true },
    }),
    prisma.riskSnapshot.groupBy({
      by: ["rosterId"],
      where: { termId, NOT: { rosterId: null } },
      _max: { snapshotDate: true },
    }),
  ]);

  const snapByStudent = new Map(
    profileSnapDates.map((g) => [g.studentId as string, g._max.snapshotDate] as const)
  );
  const snapByRoster = new Map(
    rosterSnapDates.map((g) => [g.rosterId as string, g._max.snapshotDate] as const)
  );

  const sectionIds = Array.from(
    new Set([
      ...profiles.map((p) => p.section?.id).filter((id): id is string => Boolean(id)),
      ...rosters.map((r) => r.sectionId).filter(Boolean),
    ])
  );
  const headcounts = await sectionHeadcounts(sectionIds);

  type LiveInput = {
    studentId: string;
    lrn: string;
    studentName: string;
    section: string;
    sectionId: string;
    enrolledFallback: number;
    gradeLevel: string;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null; subject: { name: string; code: string } }[];
    attendanceRecords: { status: string }[];
    anecdotalCount: number;
    intervention: InterventionRow | undefined;
    snapshotDate: Date | null;
  };

  const toStudent = (st: LiveInput): RiskSnapshotStudent | null => {
    const enrolled = headcounts.get(st.sectionId) ?? st.enrolledFallback;
    const flags = computeRiskFactors({
      finalGrades: st.finalGrades.map((g) => ({
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
      })),
      gradeMode,
      attendance: st.attendanceRecords.map((a) => ({ status: a.status })),
      anecdotalCount: st.anecdotalCount,
      enrolled,
    });
    const level = levelFromFlags(flags);
    const intervention = toInterventionLink(st.intervention);
    // Keep live High/Moderate plus recovered students (risk cleared, case
    // still open) so they can be discontinued instead of vanishing.
    const recovered = level === "Low" && intervention?.outcomeStatus === "ongoing";
    if (!includeRecovered && level !== "High" && level !== "Moderate") return null;
    if (includeRecovered && level !== "High" && level !== "Moderate" && !recovered) return null;
    if (filters.riskLevel && level !== filters.riskLevel) return null;
    if (filters.hasIntervention === true && !intervention) return null;
    if (filters.hasIntervention === false && intervention) return null;

    const subjectGrades: SubjectGrade[] = st.finalGrades.map((g) => ({
      subject: g.subject.name,
      code: g.subject.code,
      computedAverage: g.computedAverage,
      transmutedGrade: g.transmutedGrade,
      belowThreshold: (g.transmutedGrade ?? 100) < 75,
    }));

    return {
      studentId: st.studentId,
      lrn: st.lrn,
      studentName: st.studentName,
      section: st.section,
      gradeLevel: st.gradeLevel,
      riskLevel: level,
      riskCount:
        (flags.academicFlag ? 1 : 0) +
        (flags.attendanceFlag ? 1 : 0) +
        (flags.behavioralFlag ? 1 : 0),
      snapshotDate: st.snapshotDate ? st.snapshotDate.toISOString() : null,
      factors: {
        academic: flags.academicFlag,
        attendance: flags.attendanceFlag,
        behavioral: flags.behavioralFlag,
      },
      subjectGrades,
      intervention,
    };
  };

  // Registered profiles win LRN ties so one learner never renders twice.
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const kept: RiskSnapshotStudent[] = [];
  for (const p of profiles) {
    const row = toStudent({
      studentId: p.userId,
      lrn: p.lrn,
      studentName: p.user.fullName,
      section: p.section?.name ?? "—",
      sectionId: p.section?.id ?? "",
      enrolledFallback: p.section?._count.students ?? 0,
      gradeLevel: p.gradeLevel,
      finalGrades: p.finalGrades,
      attendanceRecords: p.attendanceRecords,
      anecdotalCount: p.anecdotalRecords.length,
      intervention: p.interventions[0],
      snapshotDate: snapByStudent.get(p.userId) ?? null,
    });
    if (row) kept.push(row);
  }
  for (const r of rosters) {
    if (registeredLrns.has(r.lrn)) continue;
    const row = toStudent({
      studentId: `roster:${r.id}`,
      lrn: r.lrn,
      studentName: r.fullName,
      section: r.section?.name ?? "—",
      sectionId: r.sectionId ?? r.section?.id ?? "",
      enrolledFallback: 0,
      gradeLevel: r.gradeLevel,
      finalGrades: r.finalGrades,
      attendanceRecords: r.attendanceRecords,
      anecdotalCount: r.anecdotalRecords.length,
      intervention: r.interventions[0],
      snapshotDate: snapByRoster.get(r.id) ?? null,
    });
    if (row) kept.push(row);
  }

  const levelRank = (level: string) =>
    level === "High" ? 0 : level === "Moderate" ? 1 : 2;
  kept.sort(
    (a, b) =>
      levelRank(a.riskLevel) - levelRank(b.riskLevel) ||
      b.riskCount - a.riskCount ||
      a.studentName.localeCompare(b.studentName)
  );

  const highModerate = kept.length;

  // Factor filter (Academic / Attendance / Behavioral) applied in memory.
  const filtered = filters.factor
    ? kept.filter((m) => m.factors[filters.factor!.toLowerCase() as keyof RiskFactors])
    : kept;

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const students = filtered.slice(start, start + pageSize);

  return { students, total, page, pageSize, highModerate };
}
