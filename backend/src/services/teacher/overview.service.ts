import { prisma } from "../../lib/prisma.js";
import { sectionHeadcounts } from "../enrollment.js";
import { ATTENDANCE_RISK_CUTOFF, subjectAverageAttendance } from "../attendance.js";
import { computeRiskFactors, levelFromFlags } from "../risk.js";
import {
  ACTION_LABEL,
  COMPONENT_TYPE_LABEL,
  EMPTY_RESPONSE,
  GRADE_LABELS,
  timeAgo,
} from "../../modules/teacher/teacher.repository.js";
import { isMasterTeacherEligible } from "./settings.service.js";
import type { TeacherContext } from "./teacher.types.js";

export async function getOverview(
  ctx: TeacherContext,
  scopeParam: "critical" | "secondary" | "gradebook" | "full",
) {
  const teacherId = ctx.userId;

  const scope = scopeParam;
  const isCriticalOnly = scope === "critical";
  const isSecondaryOnly = scope === "secondary";
  const isGradebookOnly = scope === "gradebook";
  const termId = ctx.termId;
  if (!termId) {
    return EMPTY_RESPONSE;
  }

  const [user, assignments, advisorySections, masterHolder] = await Promise.all([
    prisma.user.findUnique({
      where: { id: teacherId },
      select: { fullName: true, staffProfile: { select: { isMasterTeacher: true } } },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, termId },
      include: { subject: true, section: true },
    }),
    prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true, name: true, gradeLevel: true },
    }),

    prisma.user.findFirst({
      where: {
        id: { not: teacherId },
        status: "active",
        staffProfile: { isMasterTeacher: true },
      },
      select: { fullName: true },
    }),
  ]);

  const isAdviser = advisorySections.length > 0;
  const advisorySection = advisorySections[0] ?? null;

  const scopeGrades = [
    ...assignments.map((a) => a.section.gradeLevel),
    ...advisorySections.map((s) => s.gradeLevel),
  ];
  const masterTeacherEligible = isMasterTeacherEligible(scopeGrades);
  const isMasterTeacher = user?.staffProfile?.isMasterTeacher ?? false;

  const linkedSlots = await prisma.sectionTimetableEntry.findMany({
    where: {
      termId,
      status: { in: ["APPROVED", "SUBMITTED"] },
      teacherName: { userId: teacherId },
    },
    select: {
      subjectId: true,
      sectionId: true,
      subject: { select: { name: true, code: true } },
      section: { select: { name: true, gradeLevel: true } },
    },
    orderBy: [{ section: { name: "asc" } }, { subject: { name: "asc" } }],
  });
  const linkedPairs = [...new Map(
    linkedSlots.map((s) => [`${s.subjectId}|${s.sectionId}`, s]),
  ).values()];

  const handledSectionIds = Array.from(
    new Set(
      (linkedPairs.length > 0
        ? linkedPairs.map((s) => s.sectionId)
        : assignments.map((a) => a.section.id)),
    ),
  );
  const sectionIds = Array.from(new Set(assignments.map((a) => a.section.id)));
  const [sectionCounts, sectionStudents, openFlags, classRoster] = await Promise.all([
    prisma.studentProfile.groupBy({
      by: ["sectionId"],
      where: { sectionId: { in: handledSectionIds } },
      _count: { _all: true },
    }),
    prisma.studentProfile.findMany({
      where: { sectionId: { in: handledSectionIds } },
      select: {
        userId: true,
        lrn: true,
        sectionId: true,
        user: { select: { fullName: true } },
        section: { select: { name: true } },
      },
    }),
    prisma.anecdotalRecord.count({ where: { observerId: teacherId, termId } }),

    handledSectionIds.length > 0
      ? prisma.studentRoster.findMany({
          where: { sectionId: { in: handledSectionIds } },
          select: {
            id: true,
            lrn: true,
            fullName: true,
            sectionId: true,
            section: { select: { name: true } },
          },
        })
      : Promise.resolve([] as {
          id: string;
          lrn: string;
          fullName: string;
          sectionId: string;
          section: { name: string };
        }[]),
  ]);

  const headcounts = await sectionHeadcounts(handledSectionIds);
  const countBySection = new Map(
    sectionCounts.map((s) => [s.sectionId, s._count._all])
  );
  for (const [id, n] of headcounts) countBySection.set(id, n);
  const studentSecById = new Map(
    sectionStudents.map((s) => [s.userId, s.sectionId])
  );

  const subjectSectionIds = new Map<string, Set<string>>();

  const classLookup = new Map<string, { subject: string; section: string }>();
  for (const a of assignments) {
    const subjectKey = a.subject.id;
    if (!subjectSectionIds.has(subjectKey)) subjectSectionIds.set(subjectKey, new Set());
    subjectSectionIds.get(subjectKey)!.add(a.section.id);
    if (!classLookup.has(subjectKey)) {
      classLookup.set(subjectKey, {
        subject: a.subject.name,
        section: a.section.name,
      });
    }
  }

  const classes = (linkedPairs.length > 0
    ? linkedPairs.map((s) => ({
        id: `${s.subjectId}|${s.sectionId}`,
        subject: s.subject.name,
        gradeLevel: GRADE_LABELS[s.section.gradeLevel] ?? s.section.gradeLevel,
        section: s.section.name,
        studentCount: countBySection.get(s.sectionId) ?? 0,
      }))
    : assignments.map((a) => ({
        id: a.id,
        subject: a.subject.name,
        gradeLevel: GRADE_LABELS[a.section.gradeLevel] ?? a.section.gradeLevel,
        section: a.section.name,
        studentCount: countBySection.get(a.section.id) ?? 0,
      })));

  const studentCount = handledSectionIds.reduce(
    (sum, id) => sum + (countBySection.get(id) ?? 0),
    0,
  );

  const sectionSubjects = new Map<string, { name: string; subjects: string[] }>();
  for (const a of assignments) {
    const entry = sectionSubjects.get(a.section.id) ?? { name: a.section.name, subjects: [] as string[] };
    if (!entry.subjects.includes(a.subject.code)) entry.subjects.push(a.subject.code);
    sectionSubjects.set(a.section.id, entry);
  }
  for (const s of linkedPairs) {
    const entry = sectionSubjects.get(s.sectionId) ?? { name: s.section.name, subjects: [] as string[] };
    if (!entry.subjects.includes(s.subject.code)) entry.subjects.push(s.subject.code);
    sectionSubjects.set(s.sectionId, entry);
  }
  const handledSubjectIds = Array.from(
    new Set([...assignments.map((a) => a.subject.id), ...linkedPairs.map((s) => s.subjectId)]),
  );
  const registeredLrnsBySection = new Map<string, Set<string>>();
  for (const p of sectionStudents) {
    if (!p.sectionId) continue;
    const set = registeredLrnsBySection.get(p.sectionId) ?? new Set<string>();
    set.add(p.lrn);
    registeredLrnsBySection.set(p.sectionId, set);
  }
  type ClassStudentBase = {
    studentId: string;
    name: string;
    lrn: string;
    sectionId: string;
    section: string;
    subjects: string[];
  };
  const classStudentBases: ClassStudentBase[] = [
    ...sectionStudents
      .filter((p): p is typeof p & { sectionId: string } => p.sectionId !== null)
      .map((p) => ({
        studentId: p.userId,
        name: p.user.fullName,
        lrn: p.lrn,
        sectionId: p.sectionId,
        section: sectionSubjects.get(p.sectionId)?.name ?? p.section?.name ?? "",
        subjects: sectionSubjects.get(p.sectionId)?.subjects ?? [],
      })),
    ...classRoster
      .filter((r): r is typeof r & { sectionId: string } => r.sectionId !== null)
      .filter((r) => !registeredLrnsBySection.get(r.sectionId)?.has(r.lrn))
      .map((r) => ({
        studentId: `roster:${r.id}`,
        name: r.fullName,
        lrn: r.lrn,
        sectionId: r.sectionId,
        section: sectionSubjects.get(r.sectionId)?.name ?? r.section?.name ?? "",
        subjects: sectionSubjects.get(r.sectionId)?.subjects ?? [],
      })),
  ];

  const classRiskByKey = new Map<string, { riskLevel: "Low" | "Moderate" | "High"; flags: ("academic" | "attendance")[] }>();

  if (!isGradebookOnly && classStudentBases.length > 0 && handledSubjectIds.length > 0) {
    const profileIds = sectionStudents.map((p) => p.userId);
    const rosterIds = classRoster.map((r) => r.id);
    const orClauses = [
      ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
      ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
    ];
    const [classFinals, classRawRows, classAttendance] = await Promise.all([
      orClauses.length > 0
        ? prisma.finalGrade.findMany({
            where: { termId, subjectId: { in: handledSubjectIds }, OR: orClauses },
            select: { studentId: true, rosterId: true, computedAverage: true, transmutedGrade: true },
          })
        : Promise.resolve([] as { studentId: string | null; rosterId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
      orClauses.length > 0
        ? prisma.studentGrade.findMany({
            where: {
              assessment: { gradeComponent: { termId, subjectId: { in: handledSubjectIds } } },
              OR: orClauses,
            },
            select: {
              studentId: true,
              rosterId: true,
              percentageScore: true,
              assessment: { select: { gradeComponent: { select: { subjectId: true } } } },
            },
          })
        : Promise.resolve([] as { studentId: string | null; rosterId: string | null; percentageScore: number; assessment: { gradeComponent: { subjectId: string } } }[]),
      prisma.attendanceRecord.findMany({
        where: { termId, sectionId: { in: handledSectionIds }, subjectId: { in: handledSubjectIds } },
        select: { studentId: true, rosterId: true, status: true, subjectId: true },
      }),
    ]);
    const keyOf = (studentId: string | null, rosterId: string | null): string | null =>
      studentId ?? (rosterId ? `roster:${rosterId}` : null);
    const finalsByKey = new Map<string, { computedAverage: number | null; transmutedGrade: number | null }[]>();
    for (const f of classFinals) {
      const key = keyOf(f.studentId, f.rosterId);
      if (!key) continue;
      const arr = finalsByKey.get(key) ?? [];
      arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
      finalsByKey.set(key, arr);
    }
    const rawBySubject = new Map<string, Map<string, { sum: number; count: number }>>();
    for (const row of classRawRows) {
      const key = keyOf(row.studentId, row.rosterId);
      if (!key) continue;
      const subjectId = row.assessment.gradeComponent.subjectId;
      if (!rawBySubject.has(key)) rawBySubject.set(key, new Map());
      const perSubject = rawBySubject.get(key)!;
      const cell = perSubject.get(subjectId) ?? { sum: 0, count: 0 };
      cell.sum += row.percentageScore;
      cell.count += 1;
      perSubject.set(subjectId, cell);
    }
    const attByKey = new Map<string, { status: string; subjectId: string | null }[]>();
    for (const r of classAttendance) {
      const key = keyOf(r.studentId, r.rosterId);
      if (!key) continue;
      const arr = attByKey.get(key) ?? [];
      arr.push({ status: r.status, subjectId: r.subjectId });
      attByKey.set(key, arr);
    }
    for (const b of classStudentBases) {
      const rawAverages = Array.from((rawBySubject.get(b.studentId) ?? new Map()).values()).map(
        (cell) => cell.sum / cell.count,
      );
      const flags = computeRiskFactors({
        finalGrades: finalsByKey.get(b.studentId) ?? [],
        rawAverages,
        attendance: attByKey.get(b.studentId) ?? [],
        anecdotalCount: 0,
        enrolled: 0,
      });
      const active: ("academic" | "attendance")[] = [];
      if (flags.academicFlag) active.push("academic");
      if (flags.attendanceFlag) active.push("attendance");
      classRiskByKey.set(b.studentId, {
        riskLevel: levelFromFlags({ ...flags, behavioralFlag: false }),
        flags: active,
      });
    }
  }
  const classStudents = classStudentBases
    .map((b) => ({
      ...b,
      riskLevel: classRiskByKey.get(b.studentId)?.riskLevel ?? ("Low" as const),
      flags: classRiskByKey.get(b.studentId)?.flags ?? [],
    }))
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

  const subjectIds = Array.from(new Set(assignments.map((a) => a.subject.id)));

  let assessmentsPayload: {
    id: string;
    subject: string;
    gradeLevel: string;
    section: string;
    type: "WW" | "PT" | "E";
    title: string;
    dueDate: string;
    status: string;
  }[] = [];
  let pendingAssessments = 0;
  let standings: {
    subject: string;
    gradeLevel: string;
    section: string;
    average: number;
    assessed: number;
    students: number;
  }[] = [];
  let recentActivity: { action: string; target: string; when: string }[] = [];

  if (!isCriticalOnly) {
  const recentAudits = await prisma.auditLog.findMany({
    where: { userId: teacherId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { actionType: true, sourceTable: true, createdAt: true, reason: true },
  });
  const [assessments, finals, rosterSections] = await Promise.all([
    prisma.assessment.findMany({
      where: { gradeComponent: { subjectId: { in: subjectIds }, termId } },
      include: {
        gradeComponent: { include: { subject: true } },
        studentGrades: { select: { studentId: true } },
      },
    }),
    prisma.finalGrade.groupBy({
      by: ["subjectId", "studentId", "rosterId"],
      where: { termId, subjectId: { in: subjectIds }, computedAverage: { not: null } },
      _avg: { computedAverage: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true, sectionId: true },
    }),
  ]);

  const rosterSecById = new Map(rosterSections.map((s) => [`roster:${s.id}`, s.sectionId]));

  assessmentsPayload = assessments.map((as) => {
    const secIds = subjectSectionIds.get(as.gradeComponent.subjectId);
    const sectionOfAssessment = secIds ? Array.from(secIds)[0] ?? "" : "";
    const scoredIds = new Set(as.studentGrades.map((g) => g.studentId));
    let pending = false;
    for (const st of sectionStudents) {
      if (sectionOfAssessment && st.sectionId !== sectionOfAssessment) continue;
      if (!scoredIds.has(st.userId)) {
        pending = true;
        break;
      }
    }
    return {
      id: as.id,
      subject: as.gradeComponent.subject.name,
      gradeLevel:
        GRADE_LABELS[as.gradeComponent.subject.gradeLevel] ??
        as.gradeComponent.subject.gradeLevel,
      section:
        classLookup.get(as.gradeComponent.subjectId)?.section ?? "",
      type: COMPONENT_TYPE_LABEL[as.gradeComponent.componentType] ?? "WW",
      title: as.title,
      dueDate: as.dateGiven ? as.dateGiven.toISOString().slice(0, 10) : "",
      status:
        as.studentGrades.length === 0
          ? "draft"
          : pending
            ? "published"
            : "scores_locked",
    };
  });

  pendingAssessments = assessmentsPayload.filter(
    (a) => a.status !== "scores_locked"
  ).length;

  const aggMap = new Map<
    string,
    {
      sum: number;
      count: number;
      meta: { subject: string; gradeLevel: string; section: string; students: number };
    }
  >();
  for (const a of assignments) {
    const secId = a.section.id;
    const entryMeta = {
      subject: a.subject.name,
      gradeLevel: GRADE_LABELS[a.section.gradeLevel] ?? a.section.gradeLevel,
      section: a.section.name,
      students: countBySection.get(secId) ?? 0,
    };
    aggMap.set(`${a.subjectId}::${secId}`, { sum: 0, count: 0, meta: entryMeta });
  }
  for (const f of finals) {
    const stSec = f.studentId
      ? studentSecById.get(f.studentId)
      : rosterSecById.get(`roster:${f.rosterId}`);
    if (!stSec) continue;
    const entry = aggMap.get(`${f.subjectId}::${stSec}`);
    if (!entry) continue;
    entry.sum += f._avg.computedAverage ?? 0;
    entry.count += 1;
  }
  aggMap.forEach((v) => {
    standings.push({
      ...v.meta,
      average: v.count > 0 ? v.sum / v.count : 0,
      assessed: v.count,
    });
  });

  recentActivity = recentAudits.map((a) => ({
    action: ACTION_LABEL[a.actionType] ?? a.actionType.replace(/_/g, " "),
    target: a.reason ?? a.sourceTable,
    when: timeAgo(a.createdAt),
  }));
  }

  let advisoryStudents: {
    studentId: string;
    name: string;
    section: string;
    riskLevel: "Low" | "Moderate" | "High";
    flag: "academic" | "attendance" | "behavioral" | "none";
    flags: ("academic" | "attendance" | "behavioral")[];
  }[] = [];

  if (!isSecondaryOnly && !isGradebookOnly && advisorySection) {
    const [advisees, rosterEntries] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { sectionId: advisorySection.id },
        include: {
          user: { select: { fullName: true } },
          finalGrades: {
            where: { termId },
            select: { computedAverage: true, transmutedGrade: true },
          },
          attendanceRecords: { where: { termId }, select: { status: true } },
          _count: { select: { anecdotalRecords: { where: { termId } } } },
        },
      }),

      prisma.studentRoster.findMany({
        where: { sectionId: advisorySection.id },
        select: { id: true, lrn: true, fullName: true },
      }),
    ]);
    const registeredLrns = new Set(advisees.map((s) => s.lrn));
    const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
    const rosterIds = rosterOnly.map((r) => r.id);
    const profileIds = advisees.map((s) => s.userId);

    const [rawRows, rosterFinals, rosterAttendance, rosterAnecdotal] = await Promise.all([
      prisma.studentGrade.findMany({
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
      }),
      rosterIds.length > 0
        ? prisma.finalGrade.findMany({
            where: { rosterId: { in: rosterIds }, termId },
            select: {
              rosterId: true,
              computedAverage: true,
              transmutedGrade: true,
              lockStatus: true,
              finalizedAt: true,
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
            select: { rosterId: true },
          })
        : Promise.resolve([]),
    ]);

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

    const finalsByRoster = new Map<string, typeof rosterFinals>();
    for (const f of rosterFinals) {
      const arr = finalsByRoster.get(`roster:${f.rosterId}`) ?? [];
      arr.push(f);
      finalsByRoster.set(`roster:${f.rosterId}`, arr);
    }
    const attendanceByRoster = new Map<string, { status: string }[]>();
    for (const r of rosterAttendance) {
      const arr = attendanceByRoster.get(`roster:${r.rosterId}`) ?? [];
      arr.push({ status: r.status });
      attendanceByRoster.set(`roster:${r.rosterId}`, arr);
    }
    const anecdotalByRoster = new Map<string, number>();
    for (const r of rosterAnecdotal) {
      anecdotalByRoster.set(`roster:${r.rosterId}`, (anecdotalByRoster.get(`roster:${r.rosterId}`) ?? 0) + 1);
    }

    const toFlags = (
      finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[],
      key: string,
      attendance: { status: string }[],
      anecdotalCount: number,
      enrolled: number,
    ) => {
      const flags = computeRiskFactors({
        finalGrades,
        rawAverages: rawAveragesFor(key),
        attendance,
        anecdotalCount,
        enrolled,
      });

      const subjAvg = subjectAvgs.get(key);
      if (subjAvg) {
        flags.attendanceFlag = subjAvg.average < ATTENDANCE_RISK_CUTOFF;
      }
      const activeFlags: ("academic" | "attendance" | "behavioral")[] = [];
      if (flags.academicFlag) activeFlags.push("academic");
      if (flags.attendanceFlag) activeFlags.push("attendance");
      if (flags.behavioralFlag) activeFlags.push("behavioral");
      return { flags, activeFlags, flag: activeFlags[0] ?? ("none" as const) };
    };

    let enrolled = countBySection.get(advisorySection.id) ?? 0;
    if (!countBySection.has(advisorySection.id)) {
      enrolled =
        (await sectionHeadcounts([advisorySection.id])).get(
          advisorySection.id,
        ) ?? 0;
      countBySection.set(advisorySection.id, enrolled);
    }
    const subjectAvgs = await subjectAverageAttendance([advisorySection.id], termId);
    advisoryStudents = [
      ...advisees.map((s) => {
        const { flags, activeFlags, flag } = toFlags(
          s.finalGrades,
          s.userId,
          s.attendanceRecords,
          s._count.anecdotalRecords,
          enrolled,
        );
        return {
          studentId: s.userId,
          name: s.user.fullName,
          lrn: s.lrn,
          section: advisorySection.name,
          riskLevel: levelFromFlags(flags),
          flag,
          flags: activeFlags,
        };
      }),
      ...rosterOnly.map((r) => {
        const key = `roster:${r.id}`;
        const { flags, activeFlags, flag } = toFlags(
          (finalsByRoster.get(key) ?? []).map((f) => ({
            computedAverage: f.computedAverage,
            transmutedGrade: f.transmutedGrade,
          })),
          key,
          attendanceByRoster.get(key) ?? [],
          anecdotalByRoster.get(key) ?? 0,
          enrolled,
        );
        return {
          studentId: key,
          name: r.fullName,
          lrn: r.lrn,
          section: advisorySection.name,
          riskLevel: levelFromFlags(flags),
          flag,
          flags: activeFlags,
        };
      }),
    ];
  }

  const atRiskFactors = {
    academic: advisoryStudents.filter((s) => s.flags.includes("academic")).length,
    attendance: advisoryStudents.filter((s) => s.flags.includes("attendance")).length,
    behavioral: advisoryStudents.filter((s) => s.flags.includes("behavioral")).length,
  };

  const atRiskStudents = advisoryStudents.filter((s) => s.flag !== "none").length;

  if (isGradebookOnly) {
    return {
      classes,
      assessments: assessmentsPayload,
      standings,
    };
  }

  if (isSecondaryOnly) {
    return {
      assessments: assessmentsPayload,
      standings,
      recentActivity,
      pendingAssessments,
      openFlags,
    };
  }

  return {
    teacherName: user?.fullName ?? "",
    isAdviser,
    isMasterTeacher,
    masterTeacherEligible,

    masterTeacherTaken: !isMasterTeacher && masterHolder !== null,
    masterTeacherHolderName: masterHolder?.fullName ?? null,
    advisorySection: advisorySection
      ? {
          id: advisorySection.id,
          name: advisorySection.name,

          gradeLevel: advisorySection.gradeLevel,
        }
      : null,
    kpi: {
      classCount: classes.length,
      pendingAssessments,
      openFlags,
      studentCount,
    },
    atRiskFactors,
    atRiskStudents,
    classes,
    classStudents,
    advisory: { students: advisoryStudents },

    ...(isCriticalOnly
      ? {}
      : {
          recentActivity,
          subjectClasses: { assessments: assessmentsPayload, standings },
        }),
  };
}
