import { prisma } from "../../lib/prisma.js";
import type { RiskLevel } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import {
  resolveActiveTermId,
  computeRiskFactors,
  levelFromFlags,
  type GradeMode,
} from "../../services/risk.js";

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
  createdAt: string | null;
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
  riskLevel: RiskLevelValue;
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

  // Fetch the full at-risk cohort for the scope (small: ≤ a few hundred). We
  // compute the per-factor breakdown live from the engine rule so the principal
  // can filter by factor and inspect the academic subject grades. Pagination is
  // applied in memory after factor/filter computation to keep counts correct.
  const snaps = await prisma.riskSnapshot.findMany({
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
          section: { select: { name: true, _count: { select: { students: true } } } },
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
              assignedAt: true,
              assignee: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  // A student can have more than one RiskSnapshot row for a term (engine
  // re-runs append new snapshots). Collapse to one row per student, keeping
  // the most recent snapshot, so the principal sees each at-risk student once.
  const byStudent = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) {
    const id = s.student.userId;
    const prev = byStudent.get(id);
    if (!prev) {
      byStudent.set(id, s);
      continue;
    }
    const prevDate = prev.snapshotDate?.getTime() ?? 0;
    const curDate = s.snapshotDate?.getTime() ?? 0;
    if (curDate >= prevDate) byStudent.set(id, s);
  }
  const deduped = [...byStudent.values()];

  const highModerate = deduped.length;

  const mapped: RiskSnapshotStudent[] = deduped.map((s) => {
    const st = s.student;
    const enrolled = st.section?._count.students ?? 0;
    const flags = computeRiskFactors({
      finalGrades: st.finalGrades.map((g) => ({
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
      })),
      gradeMode: filters.gradeMode ?? "final",
      attendance: st.attendanceRecords.map((a) => ({ status: a.status })),
      anecdotalCount: st.anecdotalRecords.length,
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

    const iv = st.interventions[0];
    const intervention: InterventionLink | null = iv
      ? {
          id: iv.id,
          recommendedAction: iv.recommendedAction,
          assignedTo: iv.assignedTo,
          assignedStaffName: iv.assignee?.fullName ?? null,
          approvalStatus: iv.approvalStatus,
          outcomeStatus: iv.outcomeStatus,
          createdAt: iv.assignedAt ? iv.assignedAt.toISOString() : null,
        }
      : null;

    return {
      studentId: st.userId,
      lrn: st.lrn,
      studentName: st.user.fullName,
      section: st.section?.name ?? "—",
      gradeLevel: st.gradeLevel,
      riskLevel: level,
      riskCount:
        (flags.academicFlag ? 1 : 0) +
        (flags.attendanceFlag ? 1 : 0) +
        (flags.behavioralFlag ? 1 : 0),
      snapshotDate: s.snapshotDate ? s.snapshotDate.toISOString() : null,
      factors: {
        academic: flags.academicFlag,
        attendance: flags.attendanceFlag,
        behavioral: flags.behavioralFlag,
      },
      subjectGrades,
      intervention,
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
