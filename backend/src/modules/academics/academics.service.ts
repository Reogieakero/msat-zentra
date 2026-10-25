import { prisma } from "../../lib/prisma.js";
import {
  remarksFromTransmuted,
  meetsAcademicExcellenceAward,
} from "../../services/grading.js";
import { computeRiskFactors, levelFromFlags } from "../../services/risk.js";
import { schoolDaysToDate } from "../../services/attendance.js";
import { gradeLabel } from "../../lib/grades.js";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface AcademicsSummary {
  schoolYear: string;
  termLabel: string;
  sections: SectionSummaryDTO[];
  passFailByGrade: PassFailByGradeDTO[];
  honorRollPreview: HonorRollCandidateDTO[];
  potentialHonorRoll: PotentialHonorCandidateDTO[];
}

export interface PotentialHonorCandidateDTO {
  studentId: string;
  name: string;
  overallAverage: number;
  unlockedSubjects: number;
}

export interface StudentSubjectDTO {
  subject: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: "Passed" | "Failed";
}

export interface StudentRowDTO {
  studentId: string;
  lrn: string;
  name: string;
  /** Persisted sprite mascot; null falls back to the derived one client-side. */
  mascot: string | null;
  riskLevel: "High" | "Moderate" | "Low";
  overallAverage: number;
  attendanceRatePct: number;
  presentAm: number;
  presentPm: number;
  schoolDays: number;
  subjects: StudentSubjectDTO[];
}

export interface SectionSummaryDTO {
  sectionId: string;
  section: string;
  grade: string;
  avgTransmuted: number;
  passPct: number;
  failPct: number;
  atRiskCount: number;
  students: StudentRowDTO[];
}

export interface PassFailByGradeDTO {
  grade: string;
  passed: number;
  failed: number;
}

export interface HonorRollCandidateDTO {
  studentId: string;
  name: string;
  overallAverage: number;
}

export async function getAcademicsSummary(
  mode: "raw" | "final" = "final",
  scope?: { schoolYearId?: string | null; termId?: string | null },
): Promise<AcademicsSummary> {

  let activeTerm: {
    id: string;
    termNumber: number;
    startDate: Date | null;
    schoolYear: { name: string };
  } | null = null;
  if (scope?.termId) {
    activeTerm = await prisma.term.findUnique({
      where: { id: scope.termId },
      select: { id: true, termNumber: true, startDate: true, schoolYear: { select: { name: true } } },
    });
  }
  if (!activeTerm && scope?.schoolYearId) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYearId: scope.schoolYearId },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true, startDate: true, schoolYear: { select: { name: true } } },
    });
  }
  if (!activeTerm) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYear: { isActive: true } },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true, startDate: true, schoolYear: { select: { name: true } } },
    });
  }
  const termId = activeTerm?.id;
  const termLabel = activeTerm ? `Term ${activeTerm.termNumber}` : "No active term";
  const schoolYear = activeTerm?.schoolYear?.name ?? "No active school year";

  const schoolDays = schoolDaysToDate(activeTerm?.startDate);

  const lockedOnly = mode === "final";

  let resolvedYearId = scope?.schoolYearId ?? null;
  if (!resolvedYearId) {
    const activeYear = await prisma.schoolYear.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    resolvedYearId = activeYear?.id ?? null;
  }

  const sections = await prisma.section.findMany({
    where: resolvedYearId ? { schoolYearId: resolvedYearId } : undefined,
    include: {
      students: {
        include: {
          user: { select: { fullName: true } },
          finalGrades: {
            where: termId ? { termId } : undefined,
            select: {
              termId: true,
              transmutedGrade: true,
              computedAverage: true,
              remarks: true,
              lockStatus: true,
              finalizedAt: true,
              subject: { select: { name: true } },
            },
          },
          attendanceRecords: {
            where: { termId },
            select: { status: true, session: true, date: true },
          },
          anecdotalRecords: {
            where: { termId },
            select: { id: true },
          },
        },
      },

      rosterEntries: {
        select: {
          id: true,
          lrn: true,
          fullName: true,
          mascot: true,
          finalGrades: {
            where: { termId },
            select: {
              termId: true,
              transmutedGrade: true,
              computedAverage: true,
              remarks: true,
              lockStatus: true,
              finalizedAt: true,
              subject: { select: { name: true } },
            },
          },
          attendanceRecords: {
            where: { termId },
            select: { status: true, session: true, date: true },
          },
          anecdotalRecords: {
            where: { termId },
            select: { id: true },
          },
        },
      },
    },
  });

  const sectionSummaries: SectionSummaryDTO[] = [];
  const passFailMap = new Map<string, { passed: number; failed: number }>();
  const honorRollPool: HonorRollCandidateDTO[] = [];
  const potentialPool: PotentialHonorCandidateDTO[] = [];

  for (const section of sections) {
    const grade = gradeLabel(section.gradeLevel);
    const gradeAcc = passFailMap.get(grade) ?? { passed: 0, failed: 0 };

    const registeredLrns = new Set(section.students.map((s) => s.lrn));
    const enrolledStudents: {
      userId: string;
      lrn: string;
      fullName: string;
      mascot: string | null;
      finalGrades: {
        termId: string | null;
        transmutedGrade: number | null;
        computedAverage: number | null;
        remarks: string | null;
        lockStatus: string;
        finalizedAt: Date | null;
        subject: { name: string };
      }[];
      attendanceRecords: { status: string; session: string; date: Date }[];
      anecdotalCount: number;
    }[] = [
      ...section.students.map((s) => ({
        userId: s.userId,
        lrn: s.lrn,
        fullName: s.user.fullName,
        mascot: s.mascot ?? null,
        finalGrades: s.finalGrades,
        attendanceRecords: s.attendanceRecords,
        anecdotalCount: s.anecdotalRecords.length,
      })),
      ...section.rosterEntries
        .filter((r) => !registeredLrns.has(r.lrn))
        .map((r) => ({
          userId: `roster:${r.id}`,
          lrn: r.lrn,
          fullName: r.fullName,
          mascot: r.mascot ?? null,
          finalGrades: r.finalGrades,
          attendanceRecords: r.attendanceRecords,
          anecdotalCount: r.anecdotalRecords.length,
        })),
    ];
    const enrolled = enrolledStudents.length;

    const students: StudentRowDTO[] = [];
    for (const student of enrolledStudents) {
      const finals = (student.finalGrades ?? [])
        .filter((f) => f.termId === termId)
        .filter((f) =>
          lockedOnly
            ? f.lockStatus === "locked" || f.lockStatus === "adviser_approved" || f.finalizedAt != null
            : true
        )
        .filter((f) => f.transmutedGrade != null && f.computedAverage != null);

      const hasGrades = finals.length > 0;

      const subjects: StudentSubjectDTO[] = finals.map((f) => {
        const transmutedGrade = f.transmutedGrade as number;
        return {
          subject: f.subject.name,
          computedAverage: round1(f.computedAverage as number),
          transmutedGrade,
          remarks: (f.remarks ?? remarksFromTransmuted(transmutedGrade)) as
            | "Passed"
            | "Failed",
        };
      });

      const overallAverage = hasGrades
        ? round1(
            subjects.reduce((a, s) => a + s.transmutedGrade, 0) / subjects.length
          )
        : 0;

      if (hasGrades) {
        if (overallAverage >= 75) gradeAcc.passed += 1;
        else gradeAcc.failed += 1;
      }

      const liveLevel = levelFromFlags(
        computeRiskFactors({
          finalGrades: finals.map((f) => ({
            computedAverage: f.computedAverage,
            transmutedGrade: f.transmutedGrade,
          })),
          attendance: student.attendanceRecords,
          anecdotalCount: student.anecdotalCount,
          enrolled,
        })
      );
      const amRecords = student.attendanceRecords.filter((a) => a.session === "AM");
      const pmRecords = student.attendanceRecords.filter((a) => a.session === "PM");
      const presentAm = amRecords.filter((a) => a.status === "present").length;
      const presentPm = pmRecords.filter((a) => a.status === "present").length;
      const totalRecords = student.attendanceRecords.length;
      const attendanceRatePct = totalRecords > 0
        ? round1((presentAm + presentPm) / totalRecords * 100)
        : 0;

      students.push({
        studentId: student.userId,
        lrn: student.lrn,
        name: student.fullName,
        mascot: student.mascot,
        riskLevel: liveLevel,
        overallAverage,
        attendanceRatePct,
        presentAm,
        presentPm,
        schoolDays,
        subjects,
      });

      if (hasGrades) {
        const allLocked = finals.every(
          (f) => f.lockStatus === "locked" || f.lockStatus === "adviser_approved" || f.finalizedAt != null
        );
        if (allLocked && liveLevel !== "High") {
          const lowestSubject = subjects.reduce(
            (min, s) => Math.min(min, s.transmutedGrade),
            Infinity
          );
          if (meetsAcademicExcellenceAward(overallAverage, lowestSubject)) {
            honorRollPool.push({
              studentId: student.userId,
              name: student.fullName,
              overallAverage,
            });
          }
        } else if (!allLocked && liveLevel !== "High") {

          const lowestSubject = subjects.reduce(
            (min, s) => Math.min(min, s.transmutedGrade),
            Infinity
          );
          if (meetsAcademicExcellenceAward(overallAverage, lowestSubject)) {
            const unlockedSubjects = finals.filter(
              (f) =>
                f.lockStatus !== "locked" &&
                f.lockStatus !== "adviser_approved" &&
                f.finalizedAt == null
            ).length;
            potentialPool.push({
              studentId: student.userId,
              name: student.fullName,
              overallAverage,
              unlockedSubjects,
            });
          }
        }
      }
    }

    passFailMap.set(grade, gradeAcc);

    const graded = students.filter((s) => s.subjects.length > 0);
    const avgTransmuted =
      graded.length > 0
        ? round1(
            graded.reduce((a, s) => a + s.overallAverage, 0) / graded.length
          )
        : 0;
    const failed = graded.filter((s) => s.overallAverage < 75).length;
    const failPct =
      graded.length > 0 ? round1((failed / graded.length) * 100) : 0;
    const passPct = graded.length > 0 ? round1(100 - failPct) : 0;
    const atRiskCount = students.filter(
      (s) => s.riskLevel === "High" || s.riskLevel === "Moderate"
    ).length;

    sectionSummaries.push({
      sectionId: section.id,
      section: section.name,
      grade,
      avgTransmuted,
      passPct,
      failPct,
      atRiskCount,
      students,
    });
  }

  const passFailByGrade: PassFailByGradeDTO[] = Array.from(
    passFailMap.entries()
  )
    .map(([grade, acc]) => ({ grade, ...acc }))
    .sort(
      (a, b) =>
        Number(a.grade.replace(/\D/g, "")) - Number(b.grade.replace(/\D/g, ""))
    );

  const honorRollPreview = honorRollPool
    .sort((a, b) => a.name.localeCompare(b.name));

  const potentialHonorRoll = potentialPool
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    schoolYear,
    termLabel,
    sections: sectionSummaries,
    passFailByGrade,
    honorRollPreview,
    potentialHonorRoll,
  };
}

/** Hover-card stats for one learner — live, term-scoped, sharing-gated. */
export interface StudentHoverStatsDTO {
  studentId: string;
  name: string;
  termLabel: string;
  schoolYear: string;
  /** Adviser has connected/synced data (shareStudentData ON). */
  connected: boolean;
  generalAverage: number | null;
  gradedSubjects: number;
  attendance: { present: number; total: number; pct: number | null };
  anecdoteCount: number;
}

/**
 * Per-student snapshot behind the principal academics hover card.
 *
 * Term resolution mirrors the summary: the requested term wins, otherwise the
 * active school year's first term, otherwise any term of the active year.
 * Nothing is served unless the adviser has switched data sharing ON — the
 * principal sees the "adviser not sharing" state instead of live numbers.
 */
export async function getStudentHoverStats(
  rawId: string,
  scope?: { schoolYearId?: string | null; termId?: string | null },
): Promise<StudentHoverStatsDTO> {
  const isRoster = rawId.startsWith("roster:");
  const rosterId = isRoster ? rawId.slice("roster:".length) : null;

  const [student, term] = await Promise.all([
    isRoster
      ? prisma.studentRoster.findUnique({
          where: { id: rosterId! },
          select: {
            fullName: true,
            section: {
              select: {
                adviser: {
                  select: { staffProfile: { select: { shareStudentData: true } } },
                },
              },
            },
          },
        })
      : prisma.studentProfile.findUnique({
          where: { userId: rawId },
          select: {
            user: { select: { fullName: true } },
            section: {
              select: {
                adviser: {
                  select: { staffProfile: { select: { shareStudentData: true } } },
                },
              },
            },
          },
        }),
    resolveHoverTerm(scope),
  ]);

  const name = isRoster
    ? (student as { fullName?: string } | null)?.fullName ?? "Student"
    : (student as { user?: { fullName?: string } } | null)?.user?.fullName ?? "Student";
  const connected =
    (student as { section?: { adviser?: { staffProfile?: { shareStudentData?: boolean } | null } | null } | null } | null)
      ?.section?.adviser?.staffProfile?.shareStudentData ?? false;

  const termLabel = term ? `Term ${term.termNumber}` : "No active term";
  const schoolYear = term?.schoolYear.name ?? "No active school year";

  const base: StudentHoverStatsDTO = {
    studentId: rawId,
    name,
    termLabel,
    schoolYear,
    connected,
    generalAverage: null,
    gradedSubjects: 0,
    attendance: { present: 0, total: 0, pct: null },
    anecdoteCount: 0,
  };

  if (!connected || !term) return base;

  const owner = isRoster ? { rosterId } : { studentId: rawId };
  const [grades, attendance, anecdoteCount] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { ...owner, termId: term.id, transmutedGrade: { not: null } },
      select: { transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { ...owner, termId: term.id },
      select: { status: true },
    }),
    prisma.anecdotalRecord.count({ where: { ...owner, termId: term.id } }),
  ]);

  const values = grades
    .map((g) => g.transmutedGrade)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const present = attendance.filter((a) => a.status === "present").length;
  const total = attendance.length;

  return {
    ...base,
    generalAverage: values.length > 0 ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null,
    gradedSubjects: values.length,
    attendance: { present, total, pct: total > 0 ? round1((present / total) * 100) : null },
    anecdoteCount,
  };
}

async function resolveHoverTerm(scope?: { schoolYearId?: string | null; termId?: string | null }) {
  const select = { id: true, termNumber: true, schoolYear: { select: { name: true } } } as const;
  if (scope?.termId) {
    const term = await prisma.term.findUnique({ where: { id: scope.termId }, select });
    if (term) return term;
  }
  if (scope?.schoolYearId) {
    const term = await prisma.term.findFirst({
      where: { schoolYearId: scope.schoolYearId },
      orderBy: { termNumber: "asc" },
      select,
    });
    if (term) return term;
  }
  return prisma.term.findFirst({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select,
  });
}
