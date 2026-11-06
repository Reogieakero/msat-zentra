import { prisma } from "../../lib/prisma.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import { meetsAcademicExcellenceAward } from "../../services/grading.js";
import { computeRiskFactors, levelFromFlags, sectionAttendanceTotals } from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import { mascotFor } from "../../services/mascot.js";
import { gradeToNumber as gradeNumber } from "../../lib/grades.js";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface LiveHonorSubjectDTO {
  subject: string;
  code: string;
  average: number;
}

export interface LiveHonorCandidateDTO {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  gradeLevel: number;
  generalAverage: number;
  lowestSubject: number;
  /** Stored profile/roster mascot, or the canonical hash pick. */
  mascot: string | null;
  subjects: LiveHonorSubjectDTO[];
}

export interface LiveHonorRoll {
  schoolYear: string;
  termLabel: string;
  candidates: LiveHonorCandidateDTO[];
}

export async function getLiveHonorRoll(scope?: {
  schoolYearId?: string | null;
  termId?: string | null;
  gradeLevel?: string | null;
  sectionId?: string | null;
}): Promise<LiveHonorRoll> {
  let activeTerm: {
    id: string;
    termNumber: number;
    schoolYear: { name: string };
  } | null = null;
  if (scope?.termId) {
    activeTerm = await prisma.term.findUnique({
      where: { id: scope.termId },
      select: { id: true, termNumber: true, schoolYear: { select: { name: true } } },
    });
  }
  if (!activeTerm && scope?.schoolYearId) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYearId: scope.schoolYearId },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true, schoolYear: { select: { name: true } } },
    });
  }
  if (!activeTerm) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYear: { isActive: true } },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true, schoolYear: { select: { name: true } } },
    });
  }
  const termId = activeTerm?.id ?? null;
  const termLabel = activeTerm ? `Term ${activeTerm.termNumber}` : "No active term";
  const schoolYear = activeTerm?.schoolYear?.name ?? "No active school year";
  if (!termId) return { schoolYear, termLabel, candidates: [] };

  let resolvedYearId = scope?.schoolYearId ?? null;
  if (!resolvedYearId) {
    const activeYear = await prisma.schoolYear.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    resolvedYearId = activeYear?.id ?? null;
  }

  const sections = await prisma.section.findMany({
    where: {
      ...(resolvedYearId ? { schoolYearId: resolvedYearId } : {}),
      ...(scope?.sectionId ? { id: scope.sectionId } : {}),
      ...(scope?.gradeLevel ? { gradeLevel: scope.gradeLevel as GradeLevel } : {}),
    },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      // The principal only reads student data the adviser has explicitly shared
      // (Settings → share student data), same gate as the academics summary.
      adviser: {
        select: { staffProfile: { select: { shareStudentData: true } } },
      },
      students: {
        select: {
          userId: true,
          lrn: true,
          mascot: true,
          user: { select: { fullName: true } },
        },
      },
      rosterEntries: {
        select: { id: true, lrn: true, fullName: true, mascot: true },
      },
    },
  });

  // Unshared sections are omitted entirely: an honor-roll entry is a student's
  // live average, and that number must not leak past the adviser's sharing gate.
  const sharedSections = sections.filter(
    (s) => s.adviser?.staffProfile?.shareStudentData === true,
  );
  const sectionIds = sharedSections.map((s) => s.id);

  const registeredLrns = new Set(
    sharedSections.flatMap((s) => s.students.map((st) => st.lrn)),
  );
  const profileIds = sharedSections.flatMap((s) => s.students.map((st) => st.userId));
  const rosterIds = sharedSections.flatMap((s) =>
    s.rosterEntries.filter((r) => !registeredLrns.has(r.lrn)).map((r) => r.id),
  );

  const [gradeRows, attendanceRows, anecdotalRows, headcounts, sectionTotals] = await Promise.all([
    profileIds.length + rosterIds.length > 0
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
            assessment: {
              select: {
                gradeComponent: {
                  select: { subject: { select: { id: true, name: true, code: true } } },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.attendanceRecord.findMany({
      where: {
        termId,
        OR: [
          ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
          ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
        ],
      },
      select: { studentId: true, rosterId: true, status: true },
    }),
    prisma.anecdotalRecord.findMany({
      where: {
        termId,
        OR: [
          ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
          ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
        ],
      },
      select: { studentId: true, rosterId: true },
    }),
    sectionHeadcounts(sectionIds),
    sectionAttendanceTotals(sectionIds, termId),
  ]);

  const liveByKey = new Map<
    string,
    Map<string, { sum: number; count: number; name: string; code: string }>
  >();
  for (const row of gradeRows) {
    const key = row.studentId ?? `roster:${row.rosterId}`;
    const subject = row.assessment.gradeComponent.subject;
    if (!liveByKey.has(key)) liveByKey.set(key, new Map());
    const perSubject = liveByKey.get(key)!;
    const cell = perSubject.get(subject.id) ?? {
      sum: 0,
      count: 0,
      name: subject.name,
      code: subject.code,
    };
    cell.sum += row.percentageScore;
    cell.count += 1;
    perSubject.set(subject.id, cell);
  }

  const attendanceByKey = new Map<string, { status: string }[]>();
  for (const r of attendanceRows) {
    const key = r.studentId ?? `roster:${r.rosterId}`;
    const arr = attendanceByKey.get(key) ?? [];
    arr.push({ status: r.status });
    attendanceByKey.set(key, arr);
  }
  const anecdotalByKey = new Map<string, number>();
  for (const r of anecdotalRows) {
    const key = r.studentId ?? `roster:${r.rosterId}`;
    anecdotalByKey.set(key, (anecdotalByKey.get(key) ?? 0) + 1);
  }

  const sectionOf = new Map<
    string,
    { sectionId: string; section: string; gradeLevel: number }
  >();
  const nameOf = new Map<
    string,
    { name: string; lrn: string; mascot: string | null }
  >();
  for (const s of sharedSections) {
    const meta = { sectionId: s.id, section: s.name, gradeLevel: gradeNumber(s.gradeLevel) };
    for (const st of s.students) {
      sectionOf.set(st.userId, meta);
      nameOf.set(st.userId, {
        name: st.user.fullName,
        lrn: st.lrn,
        mascot: st.mascot,
      });
    }
    for (const r of s.rosterEntries) {
      if (registeredLrns.has(r.lrn)) continue;
      const key = `roster:${r.id}`;
      sectionOf.set(key, meta);
      nameOf.set(key, { name: r.fullName, lrn: r.lrn, mascot: r.mascot });
    }
  }

  const candidates: LiveHonorCandidateDTO[] = [];
  for (const [key, perSubject] of liveByKey) {
    const subjects: LiveHonorSubjectDTO[] = [];
    for (const cell of perSubject.values()) {
      if (cell.count === 0) continue;
      subjects.push({
        subject: cell.name,
        code: cell.code,
        average: round1(cell.sum / cell.count),
      });
    }
    if (subjects.length === 0) continue;
    subjects.sort((a, b) => a.subject.localeCompare(b.subject));

    const generalAverage = round1(
      subjects.reduce((a, s) => a + s.average, 0) / subjects.length,
    );
    const lowestSubject = Math.min(...subjects.map((s) => s.average));
    if (!meetsAcademicExcellenceAward(generalAverage, lowestSubject)) continue;

    const meta = sectionOf.get(key);
    const identity = nameOf.get(key);
    if (!meta || !identity) continue;
    const liveLevel = levelFromFlags(
      computeRiskFactors({
        finalGrades: [],
        rawAverages: subjects.map((s) => s.average),
        attendance: attendanceByKey.get(key) ?? [],
        attendanceTotal: sectionTotals.get(meta.sectionId),
        anecdotalCount: anecdotalByKey.get(key) ?? 0,
        enrolled: headcounts.get(meta.sectionId) ?? 0,
      }),
    );
    if (liveLevel === "High") continue;

    candidates.push({
      studentId: key,
      name: identity.name,
      lrn: identity.lrn,
      section: meta.section,
      gradeLevel: meta.gradeLevel,
      generalAverage,
      lowestSubject,
      mascot: identity.mascot ?? mascotFor(identity.name, identity.lrn),
      subjects,
    });
  }

  candidates.sort((a, b) => b.generalAverage - a.generalAverage);

  return { schoolYear, termLabel, candidates };
}
