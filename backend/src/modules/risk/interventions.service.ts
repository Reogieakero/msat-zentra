import { prisma } from "../../lib/prisma.js";
import type { RiskLevel } from "../../generated/prisma/client.js";
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
  completedAt: Date | null;
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
  page?: number;
  pageSize?: number;
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

  // Build the student-scoped filter without clobbering `student` across the
  // three optional conditions (school year + has/none intervention).
  const studentWhere: Record<string, unknown> = {};
  if (schoolYearId) studentWhere.section = { schoolYearId };
  if (filters.hasIntervention === true) studentWhere.interventions = { some: {} };
  if (filters.hasIntervention === false) studentWhere.interventions = { none: {} };

  const where = {
    termId,
    riskLevel: { in: ["High", "Moderate"] as RiskLevel[] },
    ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
    ...(Object.keys(studentWhere).length ? { student: studentWhere } : {}),
  };

  // Roster twin of the filter above (roster relation instead of profile).
  const rosterWhere: Record<string, unknown> = {};
  if (schoolYearId) rosterWhere.section = { schoolYearId };
  if (filters.hasIntervention === true) rosterWhere.interventions = { some: {} };
  if (filters.hasIntervention === false) rosterWhere.interventions = { none: {} };

  const rosterSnapWhere = {
    termId,
    riskLevel: { in: ["High", "Moderate"] as RiskLevel[] },
    ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
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
                    completedAt: true,
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
                    completedAt: true,
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
  const toLink = (iv: {
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
      completedAt: Date | null;
    }[];
    assignedAt: Date | null;
    assignee: { fullName: string } | null;
  } | undefined): InterventionLink | null =>
    iv
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
            completedAt: s.completedAt,
          })),
          createdAt: iv.assignedAt ? iv.assignedAt.toISOString() : null,
        }
      : null;

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
      intervention: toLink(st.interventions[0]),
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
      intervention: toLink(r.interventions[0]),
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
