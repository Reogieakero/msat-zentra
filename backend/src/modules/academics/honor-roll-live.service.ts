import { prisma } from "../../lib/prisma.js";
import { meetsAcademicExcellenceAward } from "../../services/grading.js";
import { computeRiskFactors, levelFromFlags } from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function gradeNumber(gradeLevel: string): number {
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export interface LiveHonorSubjectDTO {
  subject: string;
  code: string;
  /** Live unweighted mean of recorded percentage scores (1dp). */
  average: number;
}

export interface LiveHonorCandidateDTO {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  gradeLevel: number;
  /** Mean of graded live subject averages (1dp). */
  generalAverage: number;
  lowestSubject: number;
  subjects: LiveHonorSubjectDTO[];
}

export interface LiveHonorRoll {
  schoolYear: string;
  termLabel: string;
  candidates: LiveHonorCandidateDTO[];
}

// Principal Honor Roll & Awards — live general-average basis.
//
// General Average here = mean of the student's graded LIVE subject averages
// (unweighted mean of recorded percentage scores per subject, lock-agnostic
// — the same definition as the advisory students table). NOT the transmuted
// FinalGrade mean the academics summary uses.
//
// Qualification keeps the DO 15, s. 2026 rule on the live scale
// (generalAverage >= 90, no subject below 80) plus the High-risk exclusion.
// No lock requirement: live work counts the moment scores are recorded.
// Students with no recorded scores never appear (no zero-average rows).
export async function getLiveHonorRoll(scope?: {
  schoolYearId?: string | null;
  termId?: string | null;
}): Promise<LiveHonorRoll> {
  // Same scope resolution as the academics summary: session term, else
  // first term of the session year, else first term of the active year.
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

  // Identity grain: every section in scope with registered profiles +
  // enlisted roster rows (matched globally by LRN so nobody counts twice).
  const sections = await prisma.section.findMany({
    where: resolvedYearId ? { schoolYearId: resolvedYearId } : undefined,
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      students: {
        select: { userId: true, lrn: true, user: { select: { fullName: true } } },
      },
      rosterEntries: {
        select: { id: true, lrn: true, fullName: true },
      },
    },
  });
  const sectionIds = sections.map((s) => s.id);

  const registeredLrns = new Set(
    sections.flatMap((s) => s.students.map((st) => st.lrn)),
  );
  const profileIds = sections.flatMap((s) => s.students.map((st) => st.userId));
  const rosterIds = sections.flatMap((s) =>
    s.rosterEntries.filter((r) => !registeredLrns.has(r.lrn)).map((r) => r.id),
  );

  // Everything below needs only (termId, sectionIds, profileIds, rosterIds)
  // — one parallel fan-out, no sequential stages.
  const [gradeRows, attendanceRows, anecdotalRows, headcounts] = await Promise.all([
    // Live inputs: every recorded percentage score this term, school-wide.
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
    // Attendance statuses for the risk gate (present ratios only).
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
    // Anecdotal counts for the risk gate (counts only, never content).
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
  ]);

  // Per-student live subject means (unweighted, 1dp) — same formula as the
  // advisory desk: sum/count per (student, subject).
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
  const nameOf = new Map<string, { name: string; lrn: string }>();
  for (const s of sections) {
    const meta = { sectionId: s.id, section: s.name, gradeLevel: gradeNumber(s.gradeLevel) };
    for (const st of s.students) {
      sectionOf.set(st.userId, meta);
      nameOf.set(st.userId, { name: st.user.fullName, lrn: st.lrn });
    }
    for (const r of s.rosterEntries) {
      if (registeredLrns.has(r.lrn)) continue;
      const key = `roster:${r.id}`;
      sectionOf.set(key, meta);
      nameOf.set(key, { name: r.fullName, lrn: r.lrn });
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

    // High-risk exclusion on the same live basis: the academic flag reads
    // the live subject means (a >=90 qualifier can never trip it), while
    // attendance/behavioral read the term's real records.
    const meta = sectionOf.get(key);
    const identity = nameOf.get(key);
    if (!meta || !identity) continue;
    const liveLevel = levelFromFlags(
      computeRiskFactors({
        finalGrades: [],
        rawAverages: subjects.map((s) => s.average),
        attendance: attendanceByKey.get(key) ?? [],
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
      subjects,
    });
  }

  candidates.sort((a, b) => b.generalAverage - a.generalAverage);

  return { schoolYear, termLabel, candidates };
}
