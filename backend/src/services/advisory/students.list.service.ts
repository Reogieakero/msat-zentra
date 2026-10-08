import { prisma } from "../../lib/prisma.js";
import { computeRiskFactors, levelFromFlags } from "../risk.js";
import { ATTENDANCE_RISK_CUTOFF, subjectAverageAttendance } from "../attendance.js";
import { sectionHeadcounts } from "../enrollment.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.repository.js";
import type { AdvisoryContext } from "./advisory.types.js";

export async function getStudents(ctx: AdvisoryContext) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  const sections = await adviserSectionsOr404(teacherId, ctx.schoolYearId);
  if (!termId) {
    return { advisorySections: sections, termId: null, students: [] };
  }

  const sectionIds = sections.map((s) => s.id);
  const [counts, advisees, rosterEntries, assignSubjects, entrySubjects, subjectAvgs] =
    await Promise.all([
      prisma.studentProfile.groupBy({
        by: ["sectionId"],
        where: { sectionId: { in: sectionIds } },
        _count: { _all: true },
      }),
      prisma.studentProfile.findMany({
        where: { sectionId: { in: sectionIds } },
        include: {
          user: { select: { fullName: true } },
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
          anecdotalRecords: {
            where: { termId },
            select: { confidentialityLevel: true, category: true },
          },
          gradeFlags: { where: { termId }, select: { status: true } },
        },
        orderBy: { user: { fullName: "asc" } },
      }),
      prisma.studentRoster.findMany({
        where: { sectionId: { in: sectionIds } },
        select: {
          id: true,
          lrn: true,
          fullName: true,
          sectionId: true,
          section: { select: { name: true } },
        },
        orderBy: { fullName: "asc" },
      }),
      prisma.teacherSubjectAssignment.findMany({
        where: { sectionId: { in: sectionIds }, termId },
        select: { subject: { select: { name: true, code: true } } },
        distinct: ["subjectId"],
      }),
      prisma.sectionTimetableEntry.findMany({
        where: { sectionId: { in: sectionIds }, termId },
        select: { subject: { select: { name: true, code: true } } },
        distinct: ["subjectId"],
      }),
      subjectAverageAttendance(sectionIds, termId),
    ]);
  const registeredLrns = new Set(advisees.map((s) => s.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const rosterIds = rosterOnly.map((r) => r.id);
  const profileIds = advisees.map((s) => s.userId);

  const [rosterFinals, rosterAttendance, rosterAnecdotal, rawRows, enrolledBySection] =
    await Promise.all([
    rosterIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: {
            rosterId: true,
            computedAverage: true,
            transmutedGrade: true,
            subject: { select: { name: true, code: true } },
          },
        })
      : Promise.resolve([]),
    rosterIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: { rosterId: true, status: true },
        })
      : Promise.resolve([]),
    rosterIds.length > 0
      ? prisma.anecdotalRecord.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: { rosterId: true, confidentialityLevel: true },
        })
      : Promise.resolve([]),
    termId
      ? prisma.studentGrade.findMany({
          where: {
            assessment: { gradeComponent: { termId } },
            OR: [
              ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
              ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
            ],
          },
          select: {
            studentId: true,
            rosterId: true,
            percentageScore: true,
            assessment: { select: { gradeComponent: { select: { subjectId: true } } } },
          },
        })
      : Promise.resolve([]),
    sectionHeadcounts(sectionIds, counts),
  ]);

  const finalsByRoster = new Map<string, typeof rosterFinals>();
  for (const f of rosterFinals) {
    const arr = finalsByRoster.get(f.rosterId as string) ?? [];
    arr.push(f);
    finalsByRoster.set(f.rosterId as string, arr);
  }
  const attendanceByRoster = new Map<string, { status: string }[]>();
  for (const r of rosterAttendance) {
    const arr = attendanceByRoster.get(r.rosterId as string) ?? [];
    arr.push({ status: r.status });
    attendanceByRoster.set(r.rosterId as string, arr);
  }
  const anecdotalByRoster = new Map<string, { confidentialityLevel: string }[]>();
  for (const r of rosterAnecdotal) {
    const arr = anecdotalByRoster.get(r.rosterId as string) ?? [];
    arr.push({ confidentialityLevel: r.confidentialityLevel });
    anecdotalByRoster.set(r.rosterId as string, arr);
  }
  const rawBySubject = new Map<string, Map<string, { sum: number; count: number }>>();
  for (const row of rawRows) {
    const key = row.studentId ?? `roster:${row.rosterId}`;
    const subjectId = row.assessment.gradeComponent.subjectId;
    if (!rawBySubject.has(key)) rawBySubject.set(key, new Map());
    const perSubject = rawBySubject.get(key)!;
    const cell = perSubject.get(subjectId) ?? { sum: 0, count: 0 };
    cell.sum += row.percentageScore;
    cell.count += 1;
    perSubject.set(subjectId, cell);
  }
  const rawAveragesFor = (key: string): number[] =>
    Array.from((rawBySubject.get(key) ?? new Map()).values()).map(
      (cell) => cell.sum / cell.count,
    );

  const liveGradesByKey = new Map<string, { subjectId: string; average: number }[]>();
  for (const [key, perSubject] of rawBySubject) {
    const arr: { subjectId: string; average: number }[] = [];
    for (const [subjectId, cell] of perSubject) {
      if (cell.count > 0) {
        arr.push({
          subjectId,
          average: Math.round((cell.sum / cell.count) * 10) / 10,
        });
      }
    }
    if (arr.length > 0) liveGradesByKey.set(key, arr);
  }
  const liveSubjectIds = [
    ...new Set([...liveGradesByKey.values()].flatMap((a) => a.map((g) => g.subjectId))),
  ];
  const liveSubjectById = new Map(
    (
      liveSubjectIds.length > 0
        ? await prisma.subject.findMany({
            where: { id: { in: liveSubjectIds } },
            select: { id: true, name: true, code: true },
          })
        : []
    ).map((s) => [s.id, s]),
  );
  const liveGradesFor = (
    key: string,
  ): { subject: string; code: string; average: number }[] =>
    (liveGradesByKey.get(key) ?? [])
      .map((g) => {
        const meta = liveSubjectById.get(g.subjectId);
        if (!meta) return null;
        return { subject: meta.name, code: meta.code, average: g.average };
      })
      .filter(
        (g): g is { subject: string; code: string; average: number } =>
          g !== null,
      )
      .sort((a, b) => a.subject.localeCompare(b.subject));

  const toActiveFlags = (flags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean }) => {
    const active: ("academic" | "attendance" | "behavioral")[] = [];
    if (flags.academicFlag) active.push("academic");
    if (flags.attendanceFlag) active.push("attendance");
    if (flags.behavioralFlag) active.push("behavioral");
    return active;
  };

  const withSubjectAverage = <T extends { attendanceFlag: boolean }>(
    key: string,
    flags: T,
  ): T => {
    const subjAvg = subjectAvgs.get(key);
    if (subjAvg) {
      flags.attendanceFlag = subjAvg.average < ATTENDANCE_RISK_CUTOFF;
    }
    return flags;
  };

  const students = [
    ...advisees.map((s) => {
      const enrolled = enrolledBySection.get(s.sectionId!) ?? 0;
      const factors = withSubjectAverage(
        s.userId,
        computeRiskFactors({
          finalGrades: s.finalGrades,
          rawAverages: rawAveragesFor(s.userId),
          attendance: s.attendanceRecords,
          anecdotalCount: s.anecdotalRecords.length,
          enrolled,
        }),
      );
      const activeFlags = toActiveFlags(factors);
      const present = s.attendanceRecords.filter((r) => r.status === "present").length;
      const total = s.attendanceRecords.length;
      const openFlags = s.gradeFlags.filter((g) => g.status !== "resolved").length;
      return {
        studentId: s.userId,
        name: s.user.fullName,
        lrn: s.lrn,
        birthdate: s.birthdate,
        gender: s.gender,
        section: s.section?.name ?? "",
        riskLevel: levelFromFlags(factors),
        flags: activeFlags,
        attendanceRate: total === 0 ? 1 : present / total,
        anecdotalCount: s.anecdotalRecords.length,
        confidentialityTiers: Array.from(
          new Set(s.anecdotalRecords.map((a) => a.confidentialityLevel))
        ),
        hasOpenFlag: openFlags > 0,
        openFlagCount: openFlags,
        hasAccount: true,
        grades: s.finalGrades.map((f) => ({
          subject: f.subject.name,
          code: f.subject.code,
          computedAverage: f.computedAverage,
          transmutedGrade: f.transmutedGrade,
        })),
        liveGrades: liveGradesFor(s.userId),
      };
    }),
    ...rosterOnly.map((r) => {
      const key = `roster:${r.id}`;
      const finals = finalsByRoster.get(r.id) ?? [];
      const att = attendanceByRoster.get(r.id) ?? [];
      const anec = anecdotalByRoster.get(r.id) ?? [];
      const enrolled = enrolledBySection.get(r.sectionId) ?? 0;
      const factors = withSubjectAverage(
        key,
        computeRiskFactors({
          finalGrades: finals,
          rawAverages: rawAveragesFor(key),
          attendance: att,
          anecdotalCount: anec.length,
          enrolled,
        }),
      );
      const activeFlags = toActiveFlags(factors);
      const present = att.filter((a) => a.status === "present").length;
      return {
        studentId: key,
        name: r.fullName,
        lrn: r.lrn,
        birthdate: null,
        gender: null,
        section: r.section.name,
        riskLevel: levelFromFlags(factors),
        flags: activeFlags,
        attendanceRate: att.length === 0 ? 1 : present / att.length,
        anecdotalCount: anec.length,
        confidentialityTiers: Array.from(new Set(anec.map((a) => a.confidentialityLevel))),
        hasOpenFlag: false,
        openFlagCount: 0,
        hasAccount: false,
        grades: finals.map((f) => ({
          subject: f.subject.name,
          code: f.subject.code,
          computedAverage: f.computedAverage,
          transmutedGrade: f.transmutedGrade,
        })),
        liveGrades: liveGradesFor(key),
      };
    }),
  ];

  return {
    advisorySections: sections,
    termId,
    students,
    subjects: [...new Map(
      [...assignSubjects, ...entrySubjects].map((s) => [s.subject.name, s.subject]),
    ).values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
