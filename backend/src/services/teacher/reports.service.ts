import { prisma } from "../../lib/prisma.js";
import { sectionHeadcounts } from "../enrollment.js";
import { ATTENDANCE_RISK_CUTOFF } from "../attendance.js";
import { computeRiskFactors, levelFromFlags, sectionAttendanceTotals } from "../risk.js";
import { COMPONENT_TYPE_LABEL, GRADE_LABELS } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export interface TeacherReportClass {
  id: string;
  subjectId: string;
  subject: string;
  subjectCode: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  /** The signed-in teacher's role in this section. */
  teacherRole: "adviser" | "subject_teacher";
  learners: number;
  assessments: number;
  gradedAssessments: number;
  completionRate: number | null;
  average: number | null;
  transmutedAverage: number | null;
  graded: number;
  passing: number;
  failing: number;
  passRate: number | null;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceLate: number;
  attendanceExcused: number;
  attendanceTotal: number;
  attendanceRate: number | null;
  belowAttendance: number;
  lockStatus: "unlocked" | "locked" | "adviser_approved" | null;
}

export interface TeacherReportPending {
  id: string;
  subject: string;
  section: string;
  title: string;
  type: "WW" | "PT" | "E";
  dateGiven: string;
  scored: number;
  learners: number;
}

export interface TeacherReportAtRisk {
  studentId: string;
  name: string;
  section: string;
  riskLevel: "Low" | "Moderate" | "High";
  flags: ("academic" | "attendance" | "behavioral")[];
  average: number | null;
  attendanceRate: number | null;
}

export interface TeacherReportsPayload {
  term: {
    id: string;
    termNumber: number;
    startDate: string | null;
    endDate: string | null;
    schoolYearName: string | null;
  } | null;
  teacher: {
    name: string;
    code: string | null;
    isAdviser: boolean;
    isMasterTeacher: boolean;
    advisorySection: { id: string; name: string; gradeLevel: string } | null;
  };
  summary: {
    classes: number;
    learners: number;
    assessments: number;
    gradedAssessments: number;
    average: number | null;
    transmutedAverage: number | null;
    passing: number;
    failing: number;
    passRate: number | null;
    attendancePresent: number;
    attendanceTotal: number;
    attendanceRate: number | null;
    atRisk: number;
    highRisk: number;
    openFlags: number;
    anecdotal: number;
    referrals: number;
  };
  classes: TeacherReportClass[];
  distribution: { band: string; label: string; count: number; percent: number }[];
  atRisk: TeacherReportAtRisk[];
  pending: TeacherReportPending[];
  activity: {
    anecdotal: number;
    referrals: { total: number; byStatus: { status: string; count: number }[] };
  };
  generatedAt: string;
}

const EMPTY: TeacherReportsPayload = {
  term: null,
  teacher: {
    name: "",
    code: null,
    isAdviser: false,
    isMasterTeacher: false,
    advisorySection: null,
  },
  summary: {
    classes: 0,
    learners: 0,
    assessments: 0,
    gradedAssessments: 0,
    average: null,
    transmutedAverage: null,
    passing: 0,
    failing: 0,
    passRate: null,
    attendancePresent: 0,
    attendanceTotal: 0,
    attendanceRate: null,
    atRisk: 0,
    highRisk: 0,
    openFlags: 0,
    anecdotal: 0,
    referrals: 0,
  },
  classes: [],
  distribution: [],
  atRisk: [],
  pending: [],
  activity: { anecdotal: 0, referrals: { total: 0, byStatus: [] } },
  generatedAt: new Date().toISOString(),
};

/** DepEd grade bands used by the distribution card. */
const BANDS = [
  { band: "90-100", label: "Outstanding", min: 90, max: Infinity },
  { band: "85-89", label: "Very Satisfactory", min: 85, max: 90 },
  { band: "80-84", label: "Satisfactory", min: 80, max: 85 },
  { band: "75-79", label: "Fairly Satisfactory", min: 75, max: 80 },
  { band: "below-75", label: "Did Not Meet Expectations", min: -Infinity, max: 75 },
] as const;

const PASSING_GRADE = 75;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function rate(part: number, total: number): number | null {
  if (total <= 0) return null;
  return part / total;
}

function studentKey(studentId: string | null, rosterId: string | null): string | null {
  if (studentId) return studentId;
  if (rosterId) return `roster:${rosterId}`;
  return null;
}

/**
 * Term report for a teacher's own classes. Everything is resolved from the
 * teacher's timetable-linked classes (falling back to registrar assignments),
 * so the numbers match the teacher overview and grading workspaces. The term
 * comes from `resolveActiveTermId` — the teacher's selected scope.
 */
export async function getTeacherReports(ctx: TeacherContext): Promise<TeacherReportsPayload> {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) return EMPTY;

  const [term, user, teacherName, advisorySections, assignments, linkedSlots] = await Promise.all([
    prisma.term.findUnique({
      where: { id: termId },
      select: {
        id: true,
        termNumber: true,
        startDate: true,
        endDate: true,
        schoolYear: { select: { name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: teacherId },
      select: { fullName: true, staffProfile: { select: { isMasterTeacher: true } } },
    }),
    prisma.teacherName.findUnique({ where: { userId: teacherId }, select: { code: true } }),
    prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true, name: true, gradeLevel: true },
      orderBy: { name: "asc" },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, termId },
      select: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true, gradeLevel: true } },
      },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: { termId, status: { in: ["APPROVED", "SUBMITTED"] }, teacherName: { userId: teacherId } },
      select: {
        subjectId: true,
        sectionId: true,
        subject: { select: { name: true, code: true } },
        section: { select: { name: true, gradeLevel: true } },
      },
    }),
  ]);

  const advisorySection = advisorySections[0] ?? null;

  // Timetable-linked classes win (same rule as the overview/grading desk); a
  // teacher with no committed slots still reports on registrar assignments.
  const pairMap = new Map<
    string,
    {
      subjectId: string;
      subject: string;
      subjectCode: string;
      sectionId: string;
      section: string;
      gradeLevel: string;
      teacherRole: "adviser" | "subject_teacher";
    }
  >();
  const advisedSectionIds = new Set(advisorySections.map((s) => s.id));
  for (const s of linkedSlots) {
    pairMap.set(`${s.subjectId}|${s.sectionId}`, {
      subjectId: s.subjectId,
      subject: s.subject.name,
      subjectCode: s.subject.code,
      sectionId: s.sectionId,
      section: s.section.name,
      gradeLevel: s.section.gradeLevel,
      teacherRole: advisedSectionIds.has(s.sectionId) ? "adviser" : "subject_teacher",
    });
  }
  if (pairMap.size === 0) {
    for (const a of assignments) {
      pairMap.set(`${a.subject.id}|${a.section.id}`, {
        subjectId: a.subject.id,
        subject: a.subject.name,
        subjectCode: a.subject.code,
        sectionId: a.section.id,
        section: a.section.name,
        gradeLevel: a.section.gradeLevel,
        teacherRole: advisedSectionIds.has(a.section.id) ? "adviser" : "subject_teacher",
      });
    }
  }
  const pairs = [...pairMap.values()];

  const sectionIds = [...new Set(pairs.map((p) => p.sectionId))];
  const subjectIds = [...new Set(pairs.map((p) => p.subjectId))];
  const sectionMeta = new Map(
    pairs.map((p) => [
      p.sectionId,
      { name: p.section, gradeLevel: GRADE_LABELS[p.gradeLevel] ?? p.gradeLevel },
    ]),
  );

  const [
    headcounts,
    profiles,
    rosters,
    assessments,
    anecdotalMine,
    anecdotalAll,
    referrals,
    openFlags,
  ] = await Promise.all([
    sectionHeadcounts(sectionIds),
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: {
        userId: true,
        lrn: true,
        sectionId: true,
        user: { select: { fullName: true } },
      },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true, lrn: true, fullName: true, sectionId: true },
    }),
    prisma.assessment.findMany({
      where: {
        gradeComponent: { subjectId: { in: subjectIds }, termId },
        OR: [{ sectionId: { in: sectionIds } }, { sectionId: null }],
      },
      select: {
        id: true,
        title: true,
        dateGiven: true,
        sectionId: true,
        gradeComponent: { select: { subjectId: true, componentType: true } },
        studentGrades: { select: { studentId: true, rosterId: true } },
      },
    }),
    prisma.anecdotalRecord.count({ where: { termId, observerId: teacherId } }),
    prisma.anecdotalRecord.findMany({
      where: { termId, sectionId: { in: sectionIds } },
      select: { studentId: true, rosterId: true },
    }),
    prisma.referral.findMany({
      where: { termId, referredBy: teacherId },
      select: { status: true },
    }),
    prisma.gradeFlag.count({
      where: {
        termId,
        status: { in: ["open", "escalated"] },
        OR: [{ raisedBy: teacherId }, { ownerId: teacherId }],
      },
    }),
  ]);

  // --- learner index (profiles + roster-only enlistments, deduped by LRN) ---
  type Learner = {
    key: string;
    name: string;
    sectionId: string;
    section: string;
    profileId: string | null;
    rosterId: string | null;
  };
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const learners: Learner[] = [
    ...profiles
      .filter((p): p is typeof p & { sectionId: string } => p.sectionId !== null)
      .map((p) => ({
        key: p.userId,
        name: p.user.fullName,
        sectionId: p.sectionId,
        section: sectionMeta.get(p.sectionId)?.name ?? "",
        profileId: p.userId,
        rosterId: null,
      })),
    ...rosters
      .filter((r): r is typeof r & { sectionId: string } => r.sectionId !== null)
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({
        key: `roster:${r.id}`,
        name: r.fullName,
        sectionId: r.sectionId,
        section: sectionMeta.get(r.sectionId)?.name ?? "",
        profileId: null,
        rosterId: r.id,
      })),
  ];
  const learnerByKey = new Map(learners.map((l) => [l.key, l]));
  const sectionByStudentKey = new Map(learners.map((l) => [l.key, l.sectionId]));

  // Learner-scoped rows: profiles and roster-only enlistments are disjoint by
  // construction (roster rows whose LRN already has a profile are dropped), so
  // the OR clauses never double-count.
  const profileIds = learners.map((l) => l.profileId).filter((id): id is string => id != null);
  const rosterIds = learners.map((l) => l.rosterId).filter((id): id is string => id != null);
  const learnerOr = [
    ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
    ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
  ];
  const [finals, rawScores, attendance, sectionTotals] = await Promise.all([
    learnerOr.length > 0
      ? prisma.finalGrade.findMany({
          where: { termId, subjectId: { in: subjectIds }, OR: learnerOr },
          select: {
            subjectId: true,
            studentId: true,
            rosterId: true,
            computedAverage: true,
            transmutedGrade: true,
            lockStatus: true,
          },
        })
      : Promise.resolve([] as {
          subjectId: string;
          studentId: string | null;
          rosterId: string | null;
          computedAverage: number | null;
          transmutedGrade: number | null;
          lockStatus: string;
        }[]),
    learnerOr.length > 0
      ? prisma.studentGrade.findMany({
          where: {
            assessment: { gradeComponent: { termId, subjectId: { in: subjectIds } } },
            OR: learnerOr,
          },
          select: {
            studentId: true,
            rosterId: true,
            percentageScore: true,
            assessment: { select: { gradeComponent: { select: { subjectId: true } } } },
          },
        })
      : Promise.resolve([] as {
          studentId: string | null;
          rosterId: string | null;
          percentageScore: number;
          assessment: { gradeComponent: { subjectId: string } };
        }[]),
    prisma.attendanceRecord.findMany({
      where: { termId, sectionId: { in: sectionIds } },
      select: { studentId: true, rosterId: true, sectionId: true, subjectId: true, status: true },
    }),
    sectionAttendanceTotals(sectionIds, termId),
  ]);

  // --- per-class accumulators ---
  const classAgg = new Map<
    string,
    {
      pair: (typeof pairs)[number];
      finals: { computed: number | null; transmuted: number | null; lockStatus: string }[];
      assessTotal: number;
      assessGraded: number;
      att: { present: number; absent: number; late: number; excused: number };
      perLearner: Map<string, { present: number; total: number }>;
    }
  >();
  const ensureClass = (subjectId: string, sectionId: string) => {
    const key = `${subjectId}|${sectionId}`;
    let entry = classAgg.get(key);
    if (!entry) {
      entry = {
        pair: pairMap.get(key)!,
        finals: [],
        assessTotal: 0,
        assessGraded: 0,
        att: { present: 0, absent: 0, late: 0, excused: 0 },
        perLearner: new Map(),
      };
      classAgg.set(key, entry);
    }
    return entry;
  };
  for (const p of pairs) ensureClass(p.subjectId, p.sectionId);

  // --- finals: class averages, pass/fail, lock state, distribution ---
  const distributionCounts = new Map<string, number>();
  for (const f of finals) {
    const key = studentKey(f.studentId, f.rosterId);
    if (!key) continue;
    const sectionId = sectionByStudentKey.get(key);
    if (!sectionId || !pairMap.has(`${f.subjectId}|${sectionId}`)) continue;
    const entry = ensureClass(f.subjectId, sectionId);
    entry.finals.push({
      computed: f.computedAverage,
      transmuted: f.transmutedGrade,
      lockStatus: f.lockStatus,
    });
    if (f.transmutedGrade != null) {
      const band = BANDS.find((b) => f.transmutedGrade! >= b.min && f.transmutedGrade! < b.max);
      if (band) distributionCounts.set(band.band, (distributionCounts.get(band.band) ?? 0) + 1);
    }
  }

  // --- assessments: completion per class + pending list ---
  const sectionsBySubject = new Map<string, Set<string>>();
  for (const p of pairs) {
    const set = sectionsBySubject.get(p.subjectId) ?? new Set<string>();
    set.add(p.sectionId);
    sectionsBySubject.set(p.subjectId, set);
  }
  const pending: TeacherReportPending[] = [];
  for (const as of assessments) {
    const subjectId = as.gradeComponent.subjectId;
    const visibleSections = as.sectionId
      ? pairMap.has(`${subjectId}|${as.sectionId}`)
        ? [as.sectionId]
        : []
      : [...(sectionsBySubject.get(subjectId) ?? new Set<string>())];
    if (visibleSections.length === 0) continue;
    for (const sectionId of visibleSections) {
      const entry = ensureClass(subjectId, sectionId);
      const learnersInSection = headcounts.get(sectionId) ?? 0;
      const scored = as.studentGrades.filter((g) => {
        const key = studentKey(g.studentId, g.rosterId);
        return key ? sectionByStudentKey.get(key) === sectionId : false;
      }).length;
      entry.assessTotal += 1;
      if (learnersInSection > 0 && scored >= learnersInSection) entry.assessGraded += 1;
      if (scored < learnersInSection) {
        pending.push({
          id: `${as.id}:${sectionId}`,
          subject: pairMap.get(`${subjectId}|${sectionId}`)?.subject ?? "",
          section: sectionMeta.get(sectionId)?.name ?? "",
          title: as.title,
          type: COMPONENT_TYPE_LABEL[as.gradeComponent.componentType] ?? "WW",
          dateGiven: as.dateGiven ? as.dateGiven.toISOString().slice(0, 10) : "",
          scored,
          learners: learnersInSection,
        });
      }
    }
  }

  // --- attendance per class (subject-era rows only; legacy AM/PM has no subject) ---
  for (const r of attendance) {
    if (!r.subjectId) continue;
    const key = `${r.subjectId}|${r.sectionId}`;
    const entry = classAgg.get(key);
    if (!entry) continue;
    entry.att[r.status] += 1;
    const learnerKey = studentKey(r.studentId, r.rosterId);
    if (learnerKey) {
      const cell = entry.perLearner.get(learnerKey) ?? { present: 0, total: 0 };
      cell.total += 1;
      if (r.status === "present") cell.present += 1;
      entry.perLearner.set(learnerKey, cell);
    }
  }

  // --- per-class rows ---
  const classes: TeacherReportClass[] = pairs.map((p) => {
    const entry = classAgg.get(`${p.subjectId}|${p.sectionId}`)!;
    const computed = entry.finals
      .map((f) => f.computed)
      .filter((v): v is number => v != null);
    const transmuted = entry.finals
      .map((f) => f.transmuted)
      .filter((v): v is number => v != null);
    const passing = transmuted.filter((g) => g >= PASSING_GRADE).length;
    const failing = transmuted.length - passing;
    const att = entry.att;
    const attTotal = att.present + att.absent + att.late + att.excused;
    const belowAttendance = [...entry.perLearner.values()].filter(
      (c) => c.total > 0 && c.present / c.total < ATTENDANCE_RISK_CUTOFF,
    ).length;
    const lockStatuses = new Set(entry.finals.map((f) => f.lockStatus));
    const lockStatus =
      entry.finals.length === 0
        ? null
        : lockStatuses.size === 1 && lockStatuses.has("adviser_approved")
          ? "adviser_approved"
          : lockStatuses.has("locked") || lockStatuses.has("adviser_approved")
            ? "locked"
            : "unlocked";
    return {
      id: `${p.subjectId}|${p.sectionId}`,
      subjectId: p.subjectId,
      subject: p.subject,
      subjectCode: p.subjectCode,
      sectionId: p.sectionId,
      section: p.section,
      gradeLevel: sectionMeta.get(p.sectionId)?.gradeLevel ?? p.gradeLevel,
      teacherRole: p.teacherRole,
      learners: headcounts.get(p.sectionId) ?? 0,
      assessments: entry.assessTotal,
      gradedAssessments: entry.assessGraded,
      completionRate: rate(entry.assessGraded, entry.assessTotal),
      average: mean(computed),
      transmutedAverage: mean(transmuted),
      graded: transmuted.length,
      passing,
      failing,
      passRate: rate(passing, passing + failing),
      attendancePresent: att.present,
      attendanceAbsent: att.absent,
      attendanceLate: att.late,
      attendanceExcused: att.excused,
      attendanceTotal: attTotal,
      attendanceRate: rate(att.present, attTotal),
      belowAttendance,
      lockStatus,
    };
  });

  // --- at-risk learners (live, same rule as the overview risk table) ---
  const finalsByLearner = new Map<string, { computedAverage: number | null; transmutedGrade: number | null }[]>();
  for (const f of finals) {
    const key = studentKey(f.studentId, f.rosterId);
    if (!key || !learnerByKey.has(key)) continue;
    const list = finalsByLearner.get(key) ?? [];
    list.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByLearner.set(key, list);
  }
  const rawByLearner = new Map<string, Map<string, { sum: number; count: number }>>();
  for (const row of rawScores) {
    const key = studentKey(row.studentId, row.rosterId);
    if (!key || !learnerByKey.has(key)) continue;
    const subjectId = row.assessment.gradeComponent.subjectId;
    const perSubject = rawByLearner.get(key) ?? new Map<string, { sum: number; count: number }>();
    const cell = perSubject.get(subjectId) ?? { sum: 0, count: 0 };
    cell.sum += row.percentageScore;
    cell.count += 1;
    perSubject.set(subjectId, cell);
    rawByLearner.set(key, perSubject);
  }
  const attendanceByLearner = new Map<string, { status: string; subjectId: string | null }[]>();
  for (const r of attendance) {
    const key = studentKey(r.studentId, r.rosterId);
    if (!key || !learnerByKey.has(key)) continue;
    const list = attendanceByLearner.get(key) ?? [];
    list.push({ status: r.status, subjectId: r.subjectId });
    attendanceByLearner.set(key, list);
  }
  const anecdotalByLearner = new Map<string, number>();
  for (const a of anecdotalAll) {
    const key = studentKey(a.studentId, a.rosterId);
    if (!key) continue;
    anecdotalByLearner.set(key, (anecdotalByLearner.get(key) ?? 0) + 1);
  }

  const atRisk: TeacherReportAtRisk[] = [];
  let highRisk = 0;
  for (const learner of learners) {
    const attendanceRows = attendanceByLearner.get(learner.key) ?? [];
    const rawAverages = [...(rawByLearner.get(learner.key)?.values() ?? [])].map(
      (cell) => cell.sum / cell.count,
    );
    const flags = computeRiskFactors({
      finalGrades: finalsByLearner.get(learner.key) ?? [],
      rawAverages,
      attendance: attendanceRows,
      attendanceTotal: sectionTotals.get(learner.sectionId),
      anecdotalCount: anecdotalByLearner.get(learner.key) ?? 0,
      enrolled: headcounts.get(learner.sectionId) ?? 0,
    });
    const riskLevel = levelFromFlags(flags);
    if (riskLevel === "Low") continue;
    if (riskLevel === "High") highRisk += 1;
    const activeFlags: ("academic" | "attendance" | "behavioral")[] = [];
    if (flags.academicFlag) activeFlags.push("academic");
    if (flags.attendanceFlag) activeFlags.push("attendance");
    if (flags.behavioralFlag) activeFlags.push("behavioral");
    const present = attendanceRows.filter((r) => r.status === "present").length;
    const graded = (finalsByLearner.get(learner.key) ?? [])
      .map((f) => f.transmutedGrade)
      .filter((v): v is number => v != null);
    atRisk.push({
      studentId: learner.key,
      name: learner.name,
      section: learner.section,
      riskLevel,
      flags: activeFlags,
      average: mean(graded),
      attendanceRate: rate(present, attendanceRows.length),
    });
  }
  const riskRank = { High: 0, Moderate: 1, Low: 2 } as const;
  atRisk.sort(
    (a, b) => riskRank[a.riskLevel] - riskRank[b.riskLevel] || a.name.localeCompare(b.name),
  );

  // --- distribution + summary ---
  const gradedTotal = [...distributionCounts.values()].reduce((sum, n) => sum + n, 0);
  const distribution = BANDS.map((b) => {
    const count = distributionCounts.get(b.band) ?? 0;
    return {
      band: b.band,
      label: b.label,
      count,
      percent: gradedTotal > 0 ? count / gradedTotal : 0,
    };
  });
  const allComputed = finals.map((f) => f.computedAverage).filter((v): v is number => v != null);
  const allTransmuted = finals.map((f) => f.transmutedGrade).filter((v): v is number => v != null);
  const passing = allTransmuted.filter((g) => g >= PASSING_GRADE).length;
  const failing = allTransmuted.length - passing;
  const attendancePresent = classes.reduce((sum, c) => sum + c.attendancePresent, 0);
  const attendanceTotal = classes.reduce((sum, c) => sum + c.attendanceTotal, 0);

  const referralCounts = new Map<string, number>();
  for (const r of referrals) {
    referralCounts.set(r.status, (referralCounts.get(r.status) ?? 0) + 1);
  }

  return {
    term: term
      ? {
          id: term.id,
          termNumber: term.termNumber,
          startDate: term.startDate ? term.startDate.toISOString() : null,
          endDate: term.endDate ? term.endDate.toISOString() : null,
          schoolYearName: term.schoolYear?.name ?? null,
        }
      : null,
    teacher: {
      name: user?.fullName ?? "",
      code: teacherName?.code ?? null,
      isAdviser: advisorySection !== null,
      isMasterTeacher: user?.staffProfile?.isMasterTeacher ?? false,
      advisorySection: advisorySection
        ? {
            id: advisorySection.id,
            name: advisorySection.name,
            gradeLevel: GRADE_LABELS[advisorySection.gradeLevel] ?? advisorySection.gradeLevel,
          }
        : null,
    },
    summary: {
      classes: classes.length,
      learners: learners.length,
      assessments: classes.reduce((sum, c) => sum + c.assessments, 0),
      gradedAssessments: classes.reduce((sum, c) => sum + c.gradedAssessments, 0),
      average: mean(allComputed),
      transmutedAverage: mean(allTransmuted),
      passing,
      failing,
      passRate: rate(passing, passing + failing),
      attendancePresent,
      attendanceTotal,
      attendanceRate: rate(attendancePresent, attendanceTotal),
      atRisk: atRisk.length,
      highRisk,
      openFlags,
      anecdotal: anecdotalMine,
      referrals: referrals.length,
    },
    classes,
    distribution,
    atRisk,
    pending: pending.sort((a, b) => b.learners - b.scored - (a.learners - a.scored)),
    activity: {
      anecdotal: anecdotalMine,
      referrals: {
        total: referrals.length,
        byStatus: [...referralCounts.entries()]
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
      },
    },
    generatedAt: new Date().toISOString(),
  };
}
