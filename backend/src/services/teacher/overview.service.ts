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

export interface OverviewListOpts {
  atRiskOnly?: boolean;
  classPage?: number;
  classLimit?: number;
  advisoryPage?: number;
  advisoryLimit?: number;
}

/**
 * Latest RiskSnapshot.snapshotDate per student for a term, keyed by
 * profile userId or `roster:<id>` — the same _max lookup the
 * interventions board uses. Missing snapshots yield no entry.
 */
async function latestSnapshotDates(
  termId: string,
  profileIds: string[],
  rosterIds: string[],
): Promise<Map<string, string>> {
  const [snapP, snapR] = await Promise.all([
    profileIds.length > 0
      ? prisma.riskSnapshot.groupBy({
          by: ["studentId"],
          where: { termId, studentId: { in: profileIds } },
          _max: { snapshotDate: true },
        })
      : Promise.resolve([] as { studentId: string | null; _max: { snapshotDate: Date | null } }[]),
    rosterIds.length > 0
      ? prisma.riskSnapshot.groupBy({
          by: ["rosterId"],
          where: { termId, rosterId: { in: rosterIds } },
          _max: { snapshotDate: true },
        })
      : Promise.resolve([] as { rosterId: string | null; _max: { snapshotDate: Date | null } }[]),
  ]);
  const byKey = new Map<string, string>();
  for (const g of snapP) {
    if (g.studentId && g._max.snapshotDate) byKey.set(g.studentId, g._max.snapshotDate.toISOString());
  }
  for (const g of snapR) {
    if (g.rosterId && g._max.snapshotDate) byKey.set(`roster:${g.rosterId}`, g._max.snapshotDate.toISOString());
  }
  return byKey;
}

/**
 * Attach each row's latest RiskSnapshot.snapshotDate (ISO string or null).
 * Row keys are profile userIds or `roster:<id>`.
 */
async function attachSnapshotDates<T extends { studentId: string }>(
  termId: string,
  rows: T[],
): Promise<(T & { snapshotDate: string | null })[]> {
  if (rows.length === 0) return rows.map((r) => ({ ...r, snapshotDate: null }));
  const profileIds = Array.from(
    new Set(rows.filter((r) => !r.studentId.startsWith("roster:")).map((r) => r.studentId)),
  );
  const rosterIds = Array.from(
    new Set(
      rows
        .filter((r) => r.studentId.startsWith("roster:"))
        .map((r) => r.studentId.slice("roster:".length)),
    ),
  );
  const byKey = await latestSnapshotDates(termId, profileIds, rosterIds);
  return rows.map((r) => ({ ...r, snapshotDate: byKey.get(r.studentId) ?? null }));
}

export async function getOverview(
  ctx: TeacherContext,
  scopeParam: "critical" | "secondary" | "gradebook" | "full",
  opts?: OverviewListOpts,
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

  // Grading (gradebook scope) is gated on the class-page link code:
  // every teacher — master included — only sees subjects with
  // timetable-linked entries. No linked pairs => no display on /teacher/grading.
  if (isGradebookOnly && linkedPairs.length === 0) {
    return {
      classes: [],
      assessments: [],
      standings: [],
    };
  }

  // Shared-code gate: entering the code happens only on /teacher/classes,
  // which writes a per-term grant. Linked but not term-entered => no display
  // on /teacher/grading (same rule as classes + attendance).
  if (isGradebookOnly) {
    const termGrant = await prisma.teacherTermGrant.findUnique({
      where: { userId_termId: { userId: teacherId, termId } },
      select: { id: true },
    });
    if (!termGrant) {
      return {
        classes: [],
        assessments: [],
        standings: [],
      };
    }
  }

  const handledSectionIds = Array.from(
    new Set(
      (linkedPairs.length > 0
        ? linkedPairs.map((s) => s.sectionId)
        : assignments.map((a) => a.section.id)),
    ),
  );
  const sectionIds = Array.from(
    new Set([...assignments.map((a) => a.section.id), ...linkedPairs.map((s) => s.sectionId)]),
  );
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
        mascot: true,
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
            mascot: true,
            sectionId: true,
            section: { select: { name: true } },
          },
        })
      : Promise.resolve([] as {
          id: string;
          lrn: string;
          fullName: string;
          mascot: string | null;
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
  // Include timetable-linked pairs so linked-only teachers resolve
  // assessment sections correctly on the grading page.
  for (const s of linkedPairs) {
    if (!subjectSectionIds.has(s.subjectId)) subjectSectionIds.set(s.subjectId, new Set());
    subjectSectionIds.get(s.subjectId)!.add(s.sectionId);
    if (!classLookup.has(s.subjectId)) {
      classLookup.set(s.subjectId, {
        subject: s.subject.name,
        section: s.section.name,
      });
    }
  }

  // Every teacher (master included) is restricted to timetable-linked
  // subjects on the grading page — registrar assignments alone never appear.
  const gradebookLinkedOnly = isGradebookOnly;

  const classes = (gradebookLinkedOnly || linkedPairs.length > 0
    ? linkedPairs.map((s) => ({
        id: `${s.subjectId}|${s.sectionId}`,
        subject: s.subject.name,
        subjectCode: s.subject.code,
        gradeLevel: GRADE_LABELS[s.section.gradeLevel] ?? s.section.gradeLevel,
        section: s.section.name,
        studentCount: countBySection.get(s.sectionId) ?? 0,
      }))
    : assignments.map((a) => ({
        id: a.id,
        subject: a.subject.name,
        subjectCode: a.subject.code,
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
    mascot: string | null;
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
        mascot: p.mascot ?? null,
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
        mascot: r.mascot ?? null,
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
  const needSnapshotDates = !isGradebookOnly && !isSecondaryOnly;
  const classStudents = needSnapshotDates
    ? await attachSnapshotDates(
        termId,
        classStudentBases
          .map((b) => ({
            ...b,
            riskLevel: classRiskByKey.get(b.studentId)?.riskLevel ?? ("Low" as const),
            flags: classRiskByKey.get(b.studentId)?.flags ?? [],
          }))
          .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name)),
      )
    : classStudentBases
        .map((b) => ({
          ...b,
          riskLevel: classRiskByKey.get(b.studentId)?.riskLevel ?? ("Low" as const),
          flags: classRiskByKey.get(b.studentId)?.flags ?? [],
        }))
        .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

  // Scoped to the teacher's linked subjects only (assignments + timetable-linked
  // pairs) — never the whole school catalog. For the grading page, non-master
  // teachers are restricted to timetable-linked subjects only (class-page link code).
  const subjectIds = gradebookLinkedOnly
    ? Array.from(new Set(linkedPairs.map((s) => s.subjectId)))
    : Array.from(
        new Set([...assignments.map((a) => a.subject.id), ...linkedPairs.map((s) => s.subjectId)]),
      );

  let assessmentsPayload: {
    id: string;
    subject: string;
    subjectId: string;
    gradeLevel: string;
    section: string;
    sectionId: string;
    type: "WW" | "PT" | "E";
    title: string;
    dueDate: string;
    status: string;
    scored: number;
    students: number;
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
      where: {
        gradeComponent: { subjectId: { in: subjectIds }, termId },
        // Section-subject scope: only this teacher's sections plus legacy
        // shared rows. Scoped rows from other sections never load here.
        OR: [{ sectionId: { in: handledSectionIds } }, { sectionId: null }],
      },
      include: {
        gradeComponent: { include: { subject: true } },
        studentGrades: { select: { studentId: true, rosterId: true } },
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
  // Roster-only enlistments also carry grades — include their section mapping
  // so per-section scored counts cover students without accounts.
  for (const r of classRoster) {
    const key = `roster:${r.id}`;
    if (!rosterSecById.has(key) && r.sectionId) rosterSecById.set(key, r.sectionId);
  }
  // Section display meta (name + grade label) for per-class assessment rows.
  const sectionMeta = new Map<string, { name: string; gradeLevel: string }>();
  for (const a of assignments) {
    if (!sectionMeta.has(a.section.id)) {
      sectionMeta.set(a.section.id, {
        name: a.section.name,
        gradeLevel: GRADE_LABELS[a.section.gradeLevel] ?? a.section.gradeLevel,
      });
    }
  }
  for (const s of linkedPairs) {
    if (!sectionMeta.has(s.sectionId)) {
      sectionMeta.set(s.sectionId, {
        name: s.section.name,
        gradeLevel: GRADE_LABELS[s.section.gradeLevel] ?? s.section.gradeLevel,
      });
    }
  }
  // Sections teaching each subject. Gradebook scope only shows
  // timetable-linked (class-page code) sections — registrar assignments
  // alone never appear there.
  const linkedSectionsBySubject = new Map<string, Set<string>>();
  for (const s of linkedPairs) {
    if (!linkedSectionsBySubject.has(s.subjectId)) linkedSectionsBySubject.set(s.subjectId, new Set());
    linkedSectionsBySubject.get(s.subjectId)!.add(s.sectionId);
  }

  // Assessments are section-subject scoped: each row lives in exactly one
  // subject-section class (the section it was added from). Legacy pre-scope
  // rows (sectionId NULL) remain shared across every section teaching that
  // subject. Emit one payload row per visible class so each gradebook card
  // counts its own added assessments.
  for (const as of assessments) {
    const subjectId = as.gradeComponent.subjectId;
    const sectionsForSubject = gradebookLinkedOnly
      ? (linkedSectionsBySubject.get(subjectId) ?? new Set<string>())
      : (subjectSectionIds.get(subjectId) ?? new Set<string>());
    if (sectionsForSubject.size === 0) continue;
    // Scoped rows are only visible in their own section; legacy NULL rows
    // stay visible in every section of the subject.
    const visibleSections = as.sectionId
      ? (sectionsForSubject.has(as.sectionId) ? [as.sectionId] : [])
      : [...sectionsForSubject];
    if (visibleSections.length === 0) continue;
    const scoredBySection = new Map<string, number>();
    for (const g of as.studentGrades) {
      const key = g.studentId ?? (g.rosterId ? `roster:${g.rosterId}` : null);
      const sec = key
        ? (key.startsWith("roster:")
            ? rosterSecById.get(key)
            : studentSecById.get(key))
        : undefined;
      if (!sec || !sectionsForSubject.has(sec)) continue;
      // Scoped assessments only carry their own section's grades; legacy
      // shared rows attribute each grade to its student's section.
      if (as.sectionId && sec !== as.sectionId) continue;
      scoredBySection.set(sec, (scoredBySection.get(sec) ?? 0) + 1);
    }
    for (const sectionId of visibleSections) {
      const meta = sectionMeta.get(sectionId);
      const students = countBySection.get(sectionId) ?? 0;
      const scored = scoredBySection.get(sectionId) ?? 0;
      assessmentsPayload.push({
        id: as.id,
        subject: as.gradeComponent.subject.name,
        subjectId,
        gradeLevel: meta?.gradeLevel
          ?? GRADE_LABELS[as.gradeComponent.subject.gradeLevel]
          ?? as.gradeComponent.subject.gradeLevel,
        section: meta?.name ?? classLookup.get(subjectId)?.section ?? "",
        sectionId,
        type: COMPONENT_TYPE_LABEL[as.gradeComponent.componentType] ?? "WW",
        title: as.title,
        dueDate: as.dateGiven ? as.dateGiven.toISOString().slice(0, 10) : "",
        status:
          scored === 0
            ? "draft"
            : students > 0 && scored >= students
              ? "scores_locked"
              : "published",
        scored,
        students,
      });
    }
  }

  pendingAssessments = new Set(
    assessmentsPayload.filter((a) => a.status !== "scores_locked").map((a) => a.id),
  ).size;

  const aggMap = new Map<
    string,
    {
      sum: number;
      count: number;
      meta: { subject: string; gradeLevel: string; section: string; students: number };
    }
  >();
  // For grading, non-master teachers only aggregate timetable-linked
  // (class-page link code) subjects — registrar assignments alone never appear.
  if (!gradebookLinkedOnly) {
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
  }
  for (const s of linkedPairs) {
    const key = `${s.subjectId}::${s.sectionId}`;
    if (aggMap.has(key)) continue;
    aggMap.set(key, {
      sum: 0,
      count: 0,
      meta: {
        subject: s.subject.name,
        gradeLevel: GRADE_LABELS[s.section.gradeLevel] ?? s.section.gradeLevel,
        section: s.section.name,
        students: countBySection.get(s.sectionId) ?? 0,
      },
    });
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
    snapshotDate: string | null;
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
        select: { id: true, lrn: true, fullName: true, mascot: true },
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
          mascot: s.mascot ?? null,
          section: advisorySection.name,
          riskLevel: levelFromFlags(flags),
          flag,
          flags: activeFlags,
          snapshotDate: null as string | null,
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
          mascot: r.mascot ?? null,
          section: advisorySection.name,
          riskLevel: levelFromFlags(flags),
          flag,
          flags: activeFlags,
          snapshotDate: null as string | null,
        };
      }),
    ];
    // needSnapshotDates is always true inside this block (same scope guard).
    advisoryStudents = await attachSnapshotDates(termId, advisoryStudents);
  }

  const atRiskFactors = {
    academic: advisoryStudents.filter((s) => s.flags.includes("academic")).length,
    attendance: advisoryStudents.filter((s) => s.flags.includes("attendance")).length,
    behavioral: advisoryStudents.filter((s) => s.flags.includes("behavioral")).length,
  };

  const atRiskStudents = advisoryStudents.filter((s) => s.flag !== "none").length;

  const classStudentsTotal = classStudents.length;
  const advisoryTotal = advisoryStudents.length;
  const classAtRiskFactors = {
    academic: classStudents.filter((s) => s.flags.includes("academic")).length,
    attendance: classStudents.filter((s) => s.flags.includes("attendance")).length,
  };
  let classStudentsOut = opts?.atRiskOnly
    ? classStudents.filter((s) => s.riskLevel !== "Low")
    : classStudents;
  let advisoryStudentsOut = opts?.atRiskOnly
    ? advisoryStudents.filter((s) => s.flag !== "none")
    : advisoryStudents;
  if (opts?.classPage && opts?.classLimit) {
    const start = (opts.classPage - 1) * opts.classLimit;
    classStudentsOut = classStudentsOut.slice(start, start + opts.classLimit);
  }
  if (opts?.advisoryPage && opts?.advisoryLimit) {
    const start = (opts.advisoryPage - 1) * opts.advisoryLimit;
    advisoryStudentsOut = advisoryStudentsOut.slice(start, start + opts.advisoryLimit);
  }

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
    classStudents: classStudentsOut,
    classStudentsTotal,
    classAtRiskFactors,
    advisory: { students: advisoryStudentsOut },
    advisoryTotal,

    ...(isCriticalOnly
      ? {}
      : {
          recentActivity,
          subjectClasses: { assessments: assessmentsPayload, standings },
        }),
  };
}
