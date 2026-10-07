import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { sectionHeadcounts } from "../enrollment.js";
import {
  ATTENDANCE_RISK_CUTOFF,
  subjectAverageAttendance,
} from "../attendance.js";
import {
  computeRiskFactors,
  levelFromFlags,
} from "../risk.js";
import {
  ACTION_LABEL,
  advisoryRoster,
  COMPONENT_TYPE_LABEL,
  EMPTY_RESPONSE,
  GRADE_LABELS,
  timeAgo,
} from "../../modules/teacher/teacher.repository.js";
import { isMasterTeacherEligible } from "./settings.service.js";
import type { TeacherContext } from "./teacher.types.js";

// Teacher / Adviser overview (TEACH-1). Live data only — no mocked rows.
// Classes come from TeacherSubjectAssignment, the advisory section from
// Section.adviserId, flags from AnecdotalRecord created by this teacher, and
// recent activity from AuditLog rows for this user. Risk is recomputed live so
// the overview agrees with the risk engine.
export async function getOverview(
  ctx: TeacherContext,
  scopeParam: "critical" | "secondary" | "gradebook" | "full",
) {
  const teacherId = ctx.userId;
  // Scope narrows the payload so first paint stays light:
  // - `critical` skips assessments/standings/activity (heavy aggregations).
  // - `secondary` skips the advisory risk engine (heavy per-student scans).
  // - `gradebook` serves the grading landing in one round trip: classes +
  //   assessments + standings only (no risk scans, no advisory engine,
  //   no activity log).
  // - absent scope returns the full legacy shape (backward compatible).
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
    // Singleton holder (active teachers only, excluding self) so other
    // teachers can hide the claim toggle while the seat is taken.
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
  // Master Teacher is a grades 7–10 designation: eligible when every
  // known grade (classes + advisory) sits in that band — or when nothing
  // is assigned yet (new teachers declare first, endpoint re-validates).
  const scopeGrades = [
    ...assignments.map((a) => a.section.gradeLevel),
    ...advisorySections.map((s) => s.gradeLevel),
  ];
  const masterTeacherEligible = isMasterTeacherEligible(scopeGrades);
  const isMasterTeacher = user?.staffProfile?.isMasterTeacher ?? false;

  // Classes linked to this login (what My Classes shows): distinct
  // (subject, section) pairs from committed timetable slots. Logins
  // with no linked code fall back to assignment rows.
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
  // Handled sections: linked sections when linked, else assignment
  // sections. Each section counts once no matter how many subjects
  // the teacher handles in it.
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
    // Enlisted students without accounts — account status never hides
    // anyone from a teacher's own class list.
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

  // Roster-aware headcounts: enlisted students without accounts count too.
  const headcounts = await sectionHeadcounts(handledSectionIds);
  const countBySection = new Map(
    sectionCounts.map((s) => [s.sectionId, s._count._all])
  );
  for (const [id, n] of headcounts) countBySection.set(id, n);
  const studentSecById = new Map(
    sectionStudents.map((s) => [s.userId, s.sectionId])
  );

  // subject -> section id(s) the teacher handles it in (internal lookup only).
  const subjectSectionIds = new Map<string, Set<string>>();
  // subject id -> { subject name, section name } for labeling assessments.
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
  // One row per linked (subject, section) pair — what My Classes shows.
  // Falls back to one row per assignment for logins with no linked code.
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
  // One headcount per handled section — the same section taught for two
  // subjects still counts its students once.
  const studentCount = handledSectionIds.reduce(
    (sum, id) => sum + (countBySection.get(id) ?? 0),
    0,
  );

  // Every student in the teacher's own classes (subject assignments +
  // linked timetable sections): registered profiles plus enlisted
  // roster rows (LRN-deduped per section). This is what non-advisers see
  // on the overview — their class subject-assignment datas — since they
  // have no advisory section. Subjects are codes (one row in the UI).
  // Risk is academic + attendance only over the handled subjects —
  // regular teachers record no anecdotal, so no behavioral factor.
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

  // At-risk per handled subject: academic (finals + raw means in the
  // teacher's subjects) and attendance (takes in the teacher's subjects)
  // only. enrolled: 0 forces the subject-era present/records rule so a
  // student with no takes in these subjects is not falsely flagged.
  const classRiskByKey = new Map<string, { riskLevel: "Low" | "Moderate" | "High"; flags: ("academic" | "attendance")[] }>();
  // Gradebook scope never reads classStudents — skip its three heavy
  // scans (finals + raw scores + attendance takes) entirely.
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

  // Secondary aggregations (assessments, standings, activity). Skipped
  // entirely for `critical` scope so first paint only waits on primary data.
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
  // Roster finals attribute to their enlistment section so encoded
  // account-less students count in class standings too.
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

  // Class averages grouped by (subject, section).
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
  // Secondary + gradebook scopes skip the advisory risk engine
  // (per-student scans) — they only need the aggregations above.
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
      // Enlisted students without accounts — account status never hides
      // anyone from risk detection.
      prisma.studentRoster.findMany({
        where: { sectionId: advisorySection.id },
        select: { id: true, lrn: true, fullName: true },
      }),
    ]);
    const registeredLrns = new Set(advisees.map((s) => s.lrn));
    const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
    const rosterIds = rosterOnly.map((r) => r.id);
    const profileIds = advisees.map((s) => s.userId);

    // Raw assessment means per student per subject (unweighted) for the
    // raw-grade academic check, plus roster finals/attendance/anecdotal.
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

    // Per-student raw subject means: mean of recorded percentages per
    // subject, then averaged across subjects by the engine.
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
      // Attendance at-risk follows the general average across all
      // subjects (mean of per-subject present / elapsed rates — same
      // definition as the advisory attendance display), never AM/PM
      // sessions. An entry exists whenever elapsed meetups exist, so a
      // student with no takes scores 0% and flags — matching the
      // display. Only when nothing elapsed (no entry) is the legacy
      // engine result kept.
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

    // Advisory-section headcount for the legacy fallback (used only
    // when nothing elapsed and subjectAvgs has no entry). The handled-
    // sections map above may not contain the advisory section when the
    // adviser teaches elsewhere, so fall back to a direct headcount
    // instead of 0 — 0 would clear the flag for zero-record students.
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
  // Unique at-risk advisees — the population share. Factor counts above
  // can exceed this (one student may trip several factors) and must never
  // be summed into a percentage.
  const atRiskStudents = advisoryStudents.filter((s) => s.flag !== "none").length;

  // Gradebook scope serves the grading landing in one round trip:
  // classes + assessments + standings, nothing else.
  if (isGradebookOnly) {
    return {
      classes,
      assessments: assessmentsPayload,
      standings,
    };
  }

  // Secondary scope serves the lazy widgets only (grading cards need
  // assessments/standings; nothing renders kpi counters yet, but they are
  // included so GradebookKpis can mount without a second round-trip).
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
    // Singleton seat: other teachers hide the claim toggle while this is
    // set. The holder's own payload reports taken=false so their switch
    // stays actionable.
    masterTeacherTaken: !isMasterTeacher && masterHolder !== null,
    masterTeacherHolderName: masterHolder?.fullName ?? null,
    advisorySection: advisorySection
      ? {
          id: advisorySection.id,
          name: advisorySection.name,
          // Raw grade code (G7, not "Grade 7") — clients key colors
          // and format display labels from it.
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
    // Critical scope omits the heavy aggregations — the grading desk loads
    // them progressively via `secondary` scope. Full scope keeps them for
    // backward compatibility.
    ...(isCriticalOnly
      ? {}
      : {
          recentActivity,
          subjectClasses: { assessments: assessmentsPayload, standings },
        }),
  };
}

export interface StudentListQuery {
  classId: string;
  advisorySectionId: string;
}

// Student list for the Overview → Student List page (regular teachers AND
// advisers, same display). Self-sufficient in one round-trip: it returns the
// handled-class rail, the advisory rail, AND the active roster, so the page
// never waits on the heavier overview payload first.
//
// Two roster modes share one student-row shape (name + LRN, attendance %,
// academic grade):
// - subject mode (`classId`: assignment id or `subjectId|sectionId`) — every
//   student in the section with attendance % and grade for that specific
//   subject (attendance-sheet basis: elapsed meetups with no take = absent).
// - advisory mode (`advisorySectionId`) — the teacher's advisees with the
//   per-subject-average attendance % (same definition as the advisory
//   attendance display) and the general-average academic grade across the
//   section's offered subjects.
// Omitted ids serve the teacher's first advisory section (advisers) or first
// handled class (regular teachers). Every id is verified against the
// caller's assignments + committed timetable links + advised sections.
export async function getStudentList(ctx: TeacherContext, query: StudentListQuery) {
  const teacherId = ctx.userId;
  const classIdParam = query.classId;
  const advisorySectionParam = query.advisorySectionId;
  const termId = ctx.termId;
  if (!termId) {
    return {
      classes: [],
      advisorySections: [],
      class: null,
      advisorySection: null,
      students: [],
    };
  }

  const [assignments, linkedSlots, advisedSections] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, termId },
      select: {
        id: true,
        subjectId: true,
        sectionId: true,
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true, gradeLevel: true } },
      },
      orderBy: [{ section: { name: "asc" } }, { subject: { name: "asc" } }],
    }),
    prisma.sectionTimetableEntry.findMany({
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
    }),
    prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true, name: true, gradeLevel: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const linkedPairs = [...new Map(
    linkedSlots.map((s) => [`${s.subjectId}|${s.sectionId}`, s]),
  ).values()];
  const handledSectionIds = Array.from(
    new Set(
      (linkedPairs.length > 0
        ? linkedPairs.map((s) => s.sectionId)
        : assignments.map((a) => a.sectionId)),
    ),
  );
  const railSectionIds = Array.from(
    new Set([...handledSectionIds, ...advisedSections.map((s) => s.id)]),
  );
  // No rails at all (same condition as the classes/advisorySections
  // check below, but known before any roster work starts).
  if (linkedPairs.length === 0 && assignments.length === 0 && advisedSections.length === 0) {
    return {
      classes: [],
      advisorySections: [],
      class: null,
      advisorySection: null,
      students: [],
    };
  }
  // Rail headcounts and the active roster are independent — start both
  // together so a section switch pays one round-trip chain instead of
  // two. Pick validation below is sync (assignments + links + advised
  // sections are already in hand); validation failures reject the same
  // way through next(e).
  const headcountsPromise = sectionHeadcounts(railSectionIds);
  const advisedIds = new Set(advisedSections.map((s) => s.id));
  const advisoryId =
    advisorySectionParam ||
    (!classIdParam && advisedSections.length > 0 ? advisedSections[0].id : "");
  const rosterPromise = (async () => {
    if (advisoryId) {
      if (!advisedIds.has(advisoryId)) {
        throw new AppError(404, "SECTION_NOT_FOUND", "Advisory section not found");
      }
      return {
        kind: "advisory" as const,
        students: await advisoryRoster(termId, advisoryId),
      };
    }
    const resolvePair = (classId: string): { subjectId: string; sectionId: string } | null => {
      const sep = classId.indexOf("|");
      if (sep >= 0) {
        return { subjectId: classId.slice(0, sep), sectionId: classId.slice(sep + 1) };
      }
      const match = assignments.find((a) => a.id === classId);
      return match ? { subjectId: match.subjectId, sectionId: match.sectionId } : null;
    };
    // Default pick mirrors rail order: first linked pair, else first
    // assignment (same ordering the rail rows use below).
    const activeId =
      classIdParam ||
      (linkedPairs.length > 0
        ? `${linkedPairs[0].subjectId}|${linkedPairs[0].sectionId}`
        : (assignments[0]?.id ?? ""));
    const pair = resolvePair(activeId);
    const owns =
      !!pair &&
      (assignments.some(
        (a) => a.subjectId === pair.subjectId && a.sectionId === pair.sectionId,
      ) ||
        linkedPairs.some(
          (s) => s.subjectId === pair.subjectId && s.sectionId === pair.sectionId,
        ));
    if (!pair || !owns) {
      throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    }
    const [subject, section, profiles, rosterEntries] = await Promise.all([
      prisma.subject.findUnique({
        where: { id: pair.subjectId },
        select: { id: true, name: true, code: true },
      }),
      prisma.section.findUnique({
        where: { id: pair.sectionId },
        select: { id: true, name: true, gradeLevel: true },
      }),
      prisma.studentProfile.findMany({
        where: { sectionId: pair.sectionId },
        select: {
          userId: true,
          lrn: true,
          user: { select: { fullName: true } },
        },
        orderBy: { user: { fullName: "asc" } },
      }),
      prisma.studentRoster.findMany({
        where: { sectionId: pair.sectionId },
        select: { id: true, lrn: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ]);
    return {
      kind: "subject" as const,
      subjectId: pair.subjectId,
      sectionId: pair.sectionId,
      classId: activeId,
      subject,
      section,
      profiles,
      rosterEntries,
    };
  })();
  const [headcounts, roster] = await Promise.all([headcountsPromise, rosterPromise]);
  // Rail rows — same shape as the overview `classes` so the picker is
  // consistent everywhere.
  const classes = (linkedPairs.length > 0
    ? linkedPairs.map((s) => ({
        id: `${s.subjectId}|${s.sectionId}`,
        subject: s.subject.name,
        code: s.subject.code,
        gradeLevel: GRADE_LABELS[s.section.gradeLevel] ?? s.section.gradeLevel,
        section: s.section.name,
        studentCount: headcounts.get(s.sectionId) ?? 0,
      }))
    : assignments.map((a) => ({
        id: a.id,
        subject: a.subject.name,
        code: a.subject.code,
        gradeLevel: GRADE_LABELS[a.section.gradeLevel] ?? a.section.gradeLevel,
        section: a.section.name,
        studentCount: headcounts.get(a.sectionId) ?? 0,
      })));
  const advisorySections = advisedSections.map((s) => ({
    id: s.id,
    name: s.name,
    gradeLevel: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
    studentCount: headcounts.get(s.id) ?? 0,
  }));
  if (classes.length === 0 && advisorySections.length === 0) {
    return {
      classes,
      advisorySections,
      class: null,
      advisorySection: null,
      students: [],
    };
  }

  // Advisory mode: the teacher's advisees. Subject mode below stays
  // untouched for regular teachers. Roster data arrived with headcounts
  // above; this just branches on it.
  if (roster.kind === "advisory") {
    return {
      classes,
      advisorySections,
      class: null,
      advisorySection: advisorySections.find((s) => s.id === advisoryId) ?? null,
      students: roster.students,
    };
  }

  const { subject, section, profiles, rosterEntries, subjectId, sectionId, classId } = roster;
  if (!subject || !section) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }

  // Enlisted students without accounts join the list (LRN-deduped) so
  // account status never hides anyone from the teacher's own class list.
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const profileIds = profiles.map((p) => p.userId);
  const rosterIds = rosterOnly.map((r) => r.id);
  const orClauses = [
    ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
    ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
  ];

  const [profileFinals, rosterFinals, attendance, entries, term] = await Promise.all([
    profileIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { subjectId, termId, studentId: { in: profileIds } },
          select: {
            studentId: true,
            computedAverage: true,
            transmutedGrade: true,
          },
        })
      : Promise.resolve([] as { studentId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    rosterIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { subjectId, termId, rosterId: { in: rosterIds } },
          select: {
            rosterId: true,
            computedAverage: true,
            transmutedGrade: true,
          },
        })
      : Promise.resolve([] as { rosterId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    prisma.attendanceRecord.findMany({
      where: { termId, sectionId, subjectId },
      select: { studentId: true, rosterId: true, status: true, date: true },
    }),
    // Committed meetups for this subject × section — the attendance
    // sheet's denominator (see below).
    prisma.sectionTimetableEntry.findMany({
      where: {
        sectionId,
        subjectId,
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
      },
      select: { day: true },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const finalByKey = new Map<
    string,
    { computedAverage: number | null; transmutedGrade: number | null }
  >();
  for (const f of profileFinals) {
    if (f.studentId) {
      finalByKey.set(f.studentId, {
        computedAverage: f.computedAverage,
        transmutedGrade: f.transmutedGrade,
      });
    }
  }
  for (const f of rosterFinals) {
    if (f.rosterId) {
      finalByKey.set(`roster:${f.rosterId}`, {
        computedAverage: f.computedAverage,
        transmutedGrade: f.transmutedGrade,
      });
    }
  }

  // Attendance percentage on the ATTENDANCE SHEET basis so both pages
  // always agree: present elapsed meetups ÷ elapsed meetups for this
  // subject × section × term. An elapsed meetup with no take counts as
  // absent (a student with no takes shows 0%, never blank); nothing
  // elapsed yet renders null (blank), exactly like the sheet. A day
  // counts present only when every take that day is present
  // (worst-status-wins, same as the sheet's blocks view).
  const meetupDays = [...new Set(entries.map((e) => e.day))];
  const elapsed = new Set<string>();
  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const termEndStr = term?.endDate?.toISOString().slice(0, 10) ?? null;
  const endStr = termEndStr && termEndStr < todayStr ? termEndStr : todayStr;
  if (startStr && startStr <= endStr) {
    for (
      let d = new Date(`${startStr}T00:00:00Z`);
      d.toISOString().slice(0, 10) <= endStr;
      d = new Date(d.getTime() + 86_400_000)
    ) {
      const dow = d.getUTCDay();
      const day = dow === 0 ? 7 : dow;
      if (meetupDays.includes(day)) elapsed.add(d.toISOString().slice(0, 10));
    }
  }
  const DAY_RANK: Record<string, number> = { present: 0, excused: 1, late: 2, absent: 3 };
  const worstByStudent = new Map<string, Map<string, number>>();
  for (const r of attendance) {
    const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
    if (!key) continue;
    const dayKey = r.date.toISOString().slice(0, 10);
    if (!elapsed.has(dayKey)) continue;
    let perDay = worstByStudent.get(key);
    if (!perDay) {
      perDay = new Map<string, number>();
      worstByStudent.set(key, perDay);
    }
    const rank = DAY_RANK[r.status] ?? 3;
    perDay.set(dayKey, Math.max(perDay.get(dayKey) ?? -1, rank));
  }
  const presentMeetupsOf = (studentKey: string): number => {
    let n = 0;
    for (const rank of worstByStudent.get(studentKey)?.values() ?? []) {
      if (rank === 0) n += 1;
    }
    return n;
  };

  const students = [
    ...profiles.map((p) => ({
      studentId: p.userId,
      name: p.user.fullName,
      lrn: p.lrn,
      hasAccount: true as const,
    })),
    ...rosterOnly.map((r) => ({
      studentId: `roster:${r.id}`,
      name: r.fullName,
      lrn: r.lrn,
      hasAccount: false as const,
    })),
  ]
    .map((s) => {
      const present = presentMeetupsOf(s.studentId);
      const final = finalByKey.get(s.studentId) ?? null;
      return {
        ...s,
        attendancePresent: present,
        attendanceTotal: elapsed.size,
        attendancePercentage:
          elapsed.size > 0 ? Math.round((present / elapsed.size) * 1000) / 10 : null,
        computedAverage: final?.computedAverage ?? null,
        academicGrade: final?.transmutedGrade ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    classes,
    advisorySections,
    class: {
      id: classId,
      subjectId,
      subjectName: subject.name,
      subjectCode: subject.code,
      sectionId,
      sectionName: section.name,
      gradeLevel: GRADE_LABELS[section.gradeLevel] ?? section.gradeLevel,
    },
    advisorySection: null,
    students,
  };
}
