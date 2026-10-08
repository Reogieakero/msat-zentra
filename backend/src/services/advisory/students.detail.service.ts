import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { assertAdvisee } from "./students.auth.js";
import type { AdvisoryContext } from "./advisory.types.js";

export async function getStudentAnecdotal(ctx: AdvisoryContext, studentId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }
  const student = await assertAdvisee(teacherId, studentId);

  const records = await prisma.anecdotalRecord.findMany({
    where: { studentId, termId },
    include: {
      observer: { select: { id: true, fullName: true } },
      followups: {
        include: { followupUser: { select: { id: true, fullName: true } } },
        orderBy: { followupDate: "asc" },
      },
    },
    orderBy: { observationDatetime: "desc" },
  });

  return {
    student: {
      studentId: student.userId,
      name: student.user.fullName,
      lrn: student.lrn,
      section: student.section?.name ?? "",
    },
    records: records.map((r) => {
      const base = {
        id: r.id,
        observationDatetime: r.observationDatetime,
        category: r.category,
        confidentialityLevel: r.confidentialityLevel,
        mine: r.observerId === teacherId,
      };
      if (r.observerId !== teacherId) {
        return { ...base, followupCount: r.followups.length };
      }
      return {
        ...base,
        location: r.descriptionOfLocation,
        incident: r.descriptionOfIncident,
        notes: r.notesRecommendationsActions,
        classPerformance: r.classPerformance,
        attendanceSummary: r.attendanceSummary,
        followups: r.followups.map((f) => ({
          id: f.id,
          by: f.followupUser.fullName,
          date: f.followupDate,
          notes: f.notes,
        })),
      };
    }),
  };
}

export async function getStudentAcademic(ctx: AdvisoryContext, rawId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }
  const isRoster = rawId.startsWith("roster:");
  const student = isRoster
    ? await (async () => {
        const entry = await prisma.studentRoster.findUnique({
          where: { id: rawId.slice("roster:".length) },
          include: {
            section: { select: { id: true, name: true, adviserId: true } },
          },
        });
        if (!entry || entry.section?.adviserId !== teacherId) {
          throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
        }
        return {
          userId: rawId,
          fullName: entry.fullName,
          lrn: entry.lrn,
          section: entry.section,
          rosterId: entry.id,
          studentId: null as string | null,
        };
      })()
    : await (async () => {
        const profile = await assertAdvisee(teacherId, rawId);
        return {
          userId: profile.userId,
          fullName: profile.user.fullName,
          lrn: profile.lrn,
          section: profile.section,
          rosterId: null as string | null,
          studentId: profile.userId,
        };
      })();

  const gradeWhere = isRoster
    ? { rosterId: student.rosterId as string, termId }
    : { studentId: student.studentId as string, termId };
  const [grades, sectionSubjects] = await Promise.all([
    prisma.finalGrade.findMany({
      where: gradeWhere,
      include: { subject: { select: { id: true, name: true } } },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId: student.section!.id },
      select: { subject: { select: { id: true, name: true } } },
      distinct: ["subjectId"],
    }),
  ]);

  const bySubjectId = new Map(grades.map((g) => [g.subject.id, g]));
  const subjectIds = new Set<string>([
    ...grades.map((g) => g.subject.id),
    ...sectionSubjects.map((a) => a.subject.id),
  ]);
  const subjectNames = new Map<string, string>([
    ...grades.map((g) => [g.subject.id, g.subject.name] as const),
    ...sectionSubjects.map((a) => [a.subject.id, a.subject.name] as const),
  ]);

  interface GradeRow {
    subject: string;
    computedAverage: number | null;
    transmutedGrade: number | null;
    remarks: string | null;
    lockStatus: string | null;
  }
  const rows: GradeRow[] = Array.from(subjectIds)
    .map((subjectId) => {
      const g = bySubjectId.get(subjectId);
      if (!g) {
        return {
          subject: subjectNames.get(subjectId) ?? "",
          computedAverage: null,
          transmutedGrade: null,
          remarks: null,
          lockStatus: null,
        };
      }
      return {
        subject: g.subject.name,
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
        remarks: g.remarks,
        lockStatus: g.lockStatus,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const gradedRows = rows.filter((g) => g.computedAverage !== null);
  const passed = rows.filter((g) => g.remarks === "Passed").length;
  const failed = rows.filter((g) => g.remarks === "Failed").length;

  return {
    student: {
      studentId: student.userId,
      name: student.fullName,
      lrn: student.lrn,
      section: student.section?.name ?? "",
    },
    grades: rows,
    summary: {
      subjects: rows.length,
      graded: gradedRows.length,
      passed,
      failed,
      average:
        gradedRows.length === 0
          ? null
          : gradedRows.reduce((sum, g) => sum + (g.computedAverage ?? 0), 0) /
            gradedRows.length,
    },
  };
}

export async function getStudentDetail(ctx: AdvisoryContext, studentId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    include: {
      user: { select: { fullName: true } },
      section: { select: { id: true, name: true, gradeLevel: true, adviserId: true } },
      finalGrades: {
        where: { termId },
        include: { subject: { select: { id: true, name: true } } },
      },
      attendanceRecords: { where: { termId }, select: { status: true } },
      anecdotalRecords: {
        where: { termId },
        select: { confidentialityLevel: true, category: true },
      },
      referrals: {
        where: { termId },
        select: { id: true, referredToRole: true, status: true },
        orderBy: { id: "desc" },
      },
      admProfiles: {
        where: { termId },
        select: { id: true, stage: true, eligibilityStatus: true },
      },
      gradeFlags: {
        include: {
          subject: { select: { id: true, name: true } },
          raisedByUser: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student || student.section?.adviserId !== teacherId) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  }

  const present = student.attendanceRecords.filter((r) => r.status === "present").length;
  const absent = student.attendanceRecords.filter((r) => r.status === "absent").length;
  const late = student.attendanceRecords.filter((r) => r.status === "late").length;
  const excused = student.attendanceRecords.filter((r) => r.status === "excused").length;
  const total = student.attendanceRecords.length;

  return {
    studentId: student.userId,
    name: student.user.fullName,
    lrn: student.lrn,
    birthdate: student.birthdate,
    gender: student.gender,
    section: student.section.name,
    gradeLevel: student.section.gradeLevel,
    grades: student.finalGrades.map((g) => ({
      subject: g.subject.name,
      computedAverage: g.computedAverage,
      transmutedGrade: g.transmutedGrade,
      remarks: g.remarks,
      lockStatus: g.lockStatus,
    })),
    attendance: {
      rate: total === 0 ? 1 : present / total,
      present,
      absent,
      late,
      excused,
      total,
    },
    anecdotal: {
      count: student.anecdotalRecords.length,
      tiers: Array.from(new Set(student.anecdotalRecords.map((a) => a.confidentialityLevel))),
      categories: Array.from(new Set(student.anecdotalRecords.map((a) => a.category))),
    },
    referrals: student.referrals.map((r) => ({
      id: r.id,
      target: r.referredToRole,
      status: r.status,
    })),
    admCases: student.admProfiles.map((a) => ({
      id: a.id,
      stage: a.stage,
      eligibility: a.eligibilityStatus,
    })),
    gradeFlags: student.gradeFlags.map((f) => ({
      id: f.id,
      reason: f.reason,
      note: f.note,
      status: f.status,
      subject: f.subject.name,
      raisedBy: f.raisedByUser.fullName,
      createdAt: f.createdAt,
      resolutionNote: f.resolutionNote,
      resolvedAt: f.resolvedAt,
    })),
  };
}
