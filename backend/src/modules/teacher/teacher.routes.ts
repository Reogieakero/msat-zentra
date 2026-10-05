import { Router } from "express";
import { z } from "zod";
import { randomInt } from "crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import {
  ATTENDANCE_RISK_CUTOFF,
  subjectAverageAttendance,
} from "../../services/attendance.js";
import {
  computeRiskFactors,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import { adviserSectionsOr404 } from "./advisory.routes.js";

const router = Router();

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

const COMPONENT_TYPE_LABEL: Record<string, "WW" | "PT" | "E"> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

const ACTION_LABEL: Record<string, string> = {
  grade_lock: "Locked grades",
  grade_unlock: "Unlocked grades",
  anecdotal_edit: "Logged anecdotal",
  referral_status_change: "Updated referral",
  create: "Created record",
  update: "Updated record",
};

// Master Teacher is a grades 7–10 designation. Pure so it stays unit-tested
// without a DB: eligible when every known grade sits in that band, or when
// nothing is assigned yet (new teachers declare first).
const MASTER_TEACHER_GRADES = new Set([7, 8, 9, 10]);

export function gradeToNumber(gradeLevel: string | number): number {
  if (typeof gradeLevel === "number") return gradeLevel;
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export function isMasterTeacherEligible(gradeLevels: (string | number)[]): boolean {
  const nums = gradeLevels
    .map(gradeToNumber)
    .filter((n) => n >= 7 && n <= 12);
  if (nums.length === 0) return true;
  return nums.every((n) => MASTER_TEACHER_GRADES.has(n));
}

const EMPTY_RESPONSE = {
  teacherName: "",
  isAdviser: false,
  isMasterTeacher: false,
  masterTeacherEligible: false,
  masterTeacherTaken: false,
  masterTeacherHolderName: null as string | null,
  advisorySection: null,
  kpi: { classCount: 0, pendingAssessments: 0, openFlags: 0, studentCount: 0 },
  atRiskFactors: { academic: 0, attendance: 0, behavioral: 0 },
  atRiskStudents: 0,
  classes: [],
  classStudents: [],
  recentActivity: [],
  advisory: { students: [] },
  subjectClasses: { assessments: [], standings: [] },
};

// Teacher / Adviser overview (TEACH-1). Live data only — no mocked rows.
// Classes come from TeacherSubjectAssignment, the advisory section from
// Section.adviserId, flags from AnecdotalRecord created by this teacher, and
// recent activity from AuditLog rows for this user. Risk is recomputed live so
// the overview agrees with the risk engine.
router.get(
  "/overview",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  cache({ tags: ["teacher", "overview"] }),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      // Scope narrows the payload so first paint stays light:
      // - `critical` skips assessments/standings/activity (heavy aggregations).
      // - `secondary` skips the advisory risk engine (heavy per-student scans).
      // - absent scope returns the full legacy shape (backward compatible).
      const scopeParam = req.query.scope;
      const scope = scopeParam === "critical" || scopeParam === "secondary" ? scopeParam : "full";
      const isCriticalOnly = scope === "critical";
      const isSecondaryOnly = scope === "secondary";
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        return res.json(EMPTY_RESPONSE);
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
      if (classStudentBases.length > 0 && handledSubjectIds.length > 0) {
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
      // Secondary scope skips the advisory risk engine (per-student scans) —
      // it only needs the secondary aggregations computed above.
      if (!isSecondaryOnly && advisorySection) {
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
          // Attendance at-risk follows the per-subject present average
          // (same definition as the advisory attendance display), never
          // AM/PM sessions. Students with no subject-linked takes keep the
          // engine result.
          const subjAvg = subjectAvgs.get(key);
          if (subjAvg?.hasSubjectData) {
            flags.attendanceFlag = subjAvg.average < ATTENDANCE_RISK_CUTOFF;
          }
          const activeFlags: ("academic" | "attendance" | "behavioral")[] = [];
          if (flags.academicFlag) activeFlags.push("academic");
          if (flags.attendanceFlag) activeFlags.push("attendance");
          if (flags.behavioralFlag) activeFlags.push("behavioral");
          return { flags, activeFlags, flag: activeFlags[0] ?? ("none" as const) };
        };

        const enrolled = countBySection.get(advisorySection.id) ?? 0;
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

      // Secondary scope serves the lazy widgets only (grading cards need
      // assessments/standings; nothing renders kpi counters yet, but they are
      // included so GradebookKpis can mount without a second round-trip).
      if (isSecondaryOnly) {
        return res.json({
          assessments: assessmentsPayload,
          standings,
          recentActivity,
          pendingAssessments,
          openFlags,
        });
      }

      res.json({
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
      });
    } catch (e) {
      next(e);
    }
  }
);

// Advisory roster for the student list (adviser mode): every advisee in the
// section — registered profiles plus enlisted roster-only rows
// (LRN-deduped) — in the SAME row shape as subject mode. Attendance % is the
// per-subject average over elapsed meetups (the advisory attendance
// definition: 0% once meetups elapsed with no takes, blank only when nothing
// elapsed); the academic grade is the general average (mean transmuted
// grade) across the section's offered subjects this term.
async function advisoryRoster(termId: string, sectionId: string) {
  const [profiles, rosterEntries, assignSubs, entrySubs] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: { userId: true, lrn: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId, termId },
      select: { subjectId: true },
      distinct: ["subjectId"],
    }),
    prisma.sectionTimetableEntry.findMany({
      where: { sectionId, termId, status: { in: ["APPROVED", "SUBMITTED"] } },
      select: { subjectId: true },
      distinct: ["subjectId"],
    }),
  ]);
  const offeredIds = [
    ...new Set([...assignSubs.map((s) => s.subjectId), ...entrySubs.map((s) => s.subjectId)]),
  ];
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const profileIds = profiles.map((p) => p.userId);
  const rosterIds = rosterOnly.map((r) => r.id);
  const keyOf = (studentId: string | null, rosterId: string | null): string | null =>
    studentId ?? (rosterId ? `roster:${rosterId}` : null);

  const [profileFinals, rosterFinals, takes, avgs] = await Promise.all([
    profileIds.length > 0 && offeredIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { termId, subjectId: { in: offeredIds }, studentId: { in: profileIds } },
          select: { studentId: true, computedAverage: true, transmutedGrade: true },
        })
      : Promise.resolve([] as { studentId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    rosterIds.length > 0 && offeredIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { termId, subjectId: { in: offeredIds }, rosterId: { in: rosterIds } },
          select: { rosterId: true, computedAverage: true, transmutedGrade: true },
        })
      : Promise.resolve([] as { rosterId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    offeredIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: { termId, sectionId, subjectId: { in: offeredIds } },
          select: { studentId: true, rosterId: true, status: true },
        })
      : Promise.resolve([] as { studentId: string | null; rosterId: string | null; status: string }[]),
    subjectAverageAttendance([sectionId], termId),
  ]);

  const finalsByKey = new Map<string, { computedAverage: number | null; transmutedGrade: number | null }[]>();
  for (const f of profileFinals) {
    const key = keyOf(f.studentId, null);
    if (!key) continue;
    const arr = finalsByKey.get(key) ?? [];
    arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByKey.set(key, arr);
  }
  for (const f of rosterFinals) {
    const key = keyOf(null, f.rosterId);
    if (!key) continue;
    const arr = finalsByKey.get(key) ?? [];
    arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByKey.set(key, arr);
  }
  const takesByKey = new Map<string, { present: number; total: number }>();
  for (const t of takes) {
    const key = keyOf(t.studentId, t.rosterId);
    if (!key) continue;
    const cell = takesByKey.get(key) ?? { present: 0, total: 0 };
    cell.total += 1;
    if (t.status === "present") cell.present += 1;
    takesByKey.set(key, cell);
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const mean = (ns: (number | null)[]): number | null => {
    const vals = ns.filter((n): n is number => n !== null);
    return vals.length > 0 ? r1(vals.reduce((s, n) => s + n, 0) / vals.length) : null;
  };

  return [
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
      const avg = avgs.get(s.studentId)?.average ?? null;
      const cell = takesByKey.get(s.studentId) ?? { present: 0, total: 0 };
      const finals = finalsByKey.get(s.studentId) ?? [];
      return {
        ...s,
        attendancePresent: cell.present,
        attendanceTotal: cell.total,
        attendancePercentage: avg === null ? null : Math.round(avg * 1000) / 10,
        computedAverage: mean(finals.map((f) => f.computedAverage)),
        academicGrade: mean(finals.map((f) => f.transmutedGrade)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
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
router.get(
  "/overview/student-list",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  cache({ tags: ["teacher", "overview"] }),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const classIdParam = String(req.query.classId ?? "").trim();
      const advisorySectionParam = String(req.query.advisorySectionId ?? "").trim();
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        return res.json({
          classes: [],
          advisorySections: [],
          class: null,
          advisorySection: null,
          students: [],
        });
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
      const headcounts = await sectionHeadcounts(railSectionIds);
      // Rail rows — same shape as the overview `classes` so the picker is
      // consistent everywhere.
      const classes = (linkedPairs.length > 0
        ? linkedPairs.map((s) => ({
            id: `${s.subjectId}|${s.sectionId}`,
            subject: s.subject.name,
            gradeLevel: GRADE_LABELS[s.section.gradeLevel] ?? s.section.gradeLevel,
            section: s.section.name,
            studentCount: headcounts.get(s.sectionId) ?? 0,
          }))
        : assignments.map((a) => ({
            id: a.id,
            subject: a.subject.name,
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
        return res.json({
          classes,
          advisorySections,
          class: null,
          advisorySection: null,
          students: [],
        });
      }

      // Advisory mode: the teacher's advisees. Subject mode below stays
      // untouched for regular teachers.
      const advisedIds = new Set(advisedSections.map((s) => s.id));
      const advisoryId = advisorySectionParam || (!classIdParam && advisorySections.length > 0 ? advisorySections[0].id : "");
      if (advisoryId) {
        if (!advisedIds.has(advisoryId)) {
          throw new AppError(404, "SECTION_NOT_FOUND", "Advisory section not found");
        }
        return res.json({
          classes,
          advisorySections,
          class: null,
          advisorySection: advisorySections.find((s) => s.id === advisoryId) ?? null,
          students: await advisoryRoster(termId, advisoryId),
        });
      }

      const resolvePair = (classId: string): { subjectId: string; sectionId: string } | null => {
        const sep = classId.indexOf("|");
        if (sep >= 0) {
          return { subjectId: classId.slice(0, sep), sectionId: classId.slice(sep + 1) };
        }
        const match = assignments.find((a) => a.id === classId);
        return match ? { subjectId: match.subjectId, sectionId: match.sectionId } : null;
      };
      const activeId = classIdParam || classes[0].id;
      const pair = resolvePair(activeId);
      const owns = !!pair && (
        assignments.some((a) => a.subjectId === pair.subjectId && a.sectionId === pair.sectionId) ||
        linkedPairs.some((s) => s.subjectId === pair.subjectId && s.sectionId === pair.sectionId)
      );
      if (!pair || !owns) {
        throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
      }
      const { subjectId, sectionId } = pair;
      const classId = activeId;

      const [subject, section, profiles, rosterEntries] = await Promise.all([
        prisma.subject.findUnique({
          where: { id: subjectId },
          select: { id: true, name: true, code: true },
        }),
        prisma.section.findUnique({
          where: { id: sectionId },
          select: { id: true, name: true, gradeLevel: true },
        }),
        prisma.studentProfile.findMany({
          where: { sectionId },
          select: {
            userId: true,
            lrn: true,
            user: { select: { fullName: true } },
          },
          orderBy: { user: { fullName: "asc" } },
        }),
        prisma.studentRoster.findMany({
          where: { sectionId },
          select: { id: true, lrn: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
      ]);
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

      res.json({
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
      });
    } catch (e) {
      next(e);
    }
  }
);

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toISOString().slice(0, 10);
}

// Adviser section options for Settings ("Are you an adviser?"). Lists every
// section in the active school year with its holder, flagging which ones
// appear in the master teacher's schedule (committed timetable entries this
// term) so the picker can prefer schedule sections. Claimable = unclaimed;
// advisedByMe = already mine. Reuses the same singleton-per-section rule as
// POST /api/teacher/advisory/claim.
router.get(
  "/settings/adviser-sections",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const termId = await resolveActiveTermId(req);
      const yearId = req.termScope?.schoolYearId ?? null;
      const sectionWhere = yearId ? { schoolYearId: yearId } : {};
      const [sections, scheduled] = await Promise.all([
        prisma.section.findMany({
          where: sectionWhere,
          orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            adviserLabel: true,
            adviserCode: true,
            adviserId: true,
            adviser: { select: { fullName: true } },
          },
        }),
        termId
          ? prisma.sectionTimetableEntry.findMany({
              where: { termId },
              select: { sectionId: true },
              distinct: ["sectionId"],
            })
          : Promise.resolve([] as { sectionId: string }[]),
      ]);
      const scheduledIds = new Set(scheduled.map((s) => s.sectionId));
      res.json({
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          gradeLevel: s.gradeLevel,
          gradeNumber: gradeToNumber(s.gradeLevel),
          adviserLabel: (s as { adviserLabel?: string | null }).adviserLabel ?? "",
          claimable: s.adviserId === null,
          advisedByMe: s.adviserId === teacherId,
          holderName: s.adviserId && s.adviserId !== teacherId ? (s.adviser?.fullName ?? null) : null,
          inMasterSchedule: scheduledIds.has(s.id),
          hasCode: !!((s as { adviserCode?: string | null }).adviserCode ?? null),
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// Self-declared Master Teacher designation (grades 7–10 only). The grade
// band is re-resolved server-side from this term's assignments + advised
// sections, so a tampered client cannot claim it from grades 11–12.
// Turning it off is always allowed.
router.patch(
  "/settings/master-teacher",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", z.object({ isMasterTeacher: z.boolean() })),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const { isMasterTeacher } = req.body as { isMasterTeacher: boolean };
      if (isMasterTeacher) {
        const termId = await resolveActiveTermId(req);
        // Only one Master Teacher at a time — validate the grade band
        // first, so we never leave the DB in a half-cleared state.
        const [assignments, advised] = await Promise.all([
          termId
            ? prisma.teacherSubjectAssignment.findMany({
                where: { teacherId, termId },
                select: { section: { select: { gradeLevel: true } } },
              })
            : Promise.resolve([]),
          termId
            ? prisma.section.findMany({
                where: { adviserId: teacherId },
                select: { gradeLevel: true },
              })
            : Promise.resolve([]),
        ]);
        const gradeLevels = [
          ...(assignments as { section: { gradeLevel: string } }[]).map(
            (a) => a.section.gradeLevel
          ),
          ...(advised as { gradeLevel: string }[]).map((s) => s.gradeLevel),
        ];
        if (!isMasterTeacherEligible(gradeLevels)) {
          throw new AppError(
            403,
            "GRADE_BAND_NOT_ALLOWED",
            "Master Teacher designation is only available for grades 7–10"
          );
        }
        // Singleton seat: if another ACTIVE teacher already holds it, refuse
        // to steal — they must turn it off first. Checked inside an
        // interactive transaction so concurrent claims cannot both win.
        // Inactive holders are treated as stale and cleared.
        let holderName: string | null = null;
        await prisma.$transaction(async (tx) => {
          const existing = await tx.user.findFirst({
            where: {
              id: { not: teacherId },
              status: "active",
              staffProfile: { isMasterTeacher: true },
            },
            select: { fullName: true },
          });
          if (existing) {
            holderName = existing.fullName;
            throw new AppError(
              409,
              "MASTER_TEACHER_TAKEN",
              holderName
                ? `Master Teacher is currently designated by ${holderName} — ask them to turn it off first`
                : "Master Teacher is currently designated — try again after it is turned off"
            );
          }
          // No active holder: clear any stale flags, then claim.
          await tx.staffProfile.updateMany({
            where: { isMasterTeacher: true, userId: { not: teacherId } },
            data: { isMasterTeacher: false },
          });
          await tx.staffProfile.updateMany({
            where: { userId: teacherId },
            data: { isMasterTeacher: true },
          });
        });
      } else {
        await prisma.staffProfile.updateMany({
          where: { userId: teacherId },
          data: { isMasterTeacher: false },
        });
      }
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "staff_profiles",
        sourceId: teacherId,
        reason: isMasterTeacher
          ? "Teacher declared Master Teacher status"
          : "Teacher removed Master Teacher status",
      });
      await invalidateTags(["teacher", "overview"]);

      res.json({ isMasterTeacher });
    } catch (e) {
      next(e);
    }
  }
);

// Teacher profile settings (Settings page): display name, photo, and the
// workspace palette. Reads/writes the teacher's own User + StaffProfile rows
// (profile row upserted — teachers created before it existed have none).
const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #RRGGBB hex value");

async function readTeacherProfileSettings(teacherId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: teacherId },
      select: { fullName: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: teacherId },
      select: { photoUrl: true, primaryColor: true, secondaryColor: true },
    }),
  ]);
  return {
    fullName: user?.fullName ?? "",
    photoUrl: profile?.photoUrl ?? null,
    primaryColor: profile?.primaryColor ?? null,
    secondaryColor: profile?.secondaryColor ?? null,
  };
}

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      res.json(await readTeacherProfileSettings(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/settings/profile",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate(
    "body",
    z.object({
      fullName: z.string().trim().min(1).max(100).optional(),
      primaryColor: HEX_COLOR.nullable().optional(),
      secondaryColor: HEX_COLOR.nullable().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const { fullName, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      await prisma.$transaction(async (tx) => {
        if (fullName !== undefined) {
          await tx.user.update({
            where: { id: teacherId },
            data: { fullName },
          });
        }
        const palette: { primaryColor?: string | null; secondaryColor?: string | null } = {};
        if (primaryColor !== undefined) palette.primaryColor = primaryColor;
        if (secondaryColor !== undefined) palette.secondaryColor = secondaryColor;
        if (Object.keys(palette).length > 0) {
          await tx.staffProfile.upsert({
            where: { userId: teacherId },
            update: palette,
            create: {
              userId: teacherId,
              employeeId: `T-${teacherId.slice(0, 8)}`,
              ...palette,
            },
          });
        }
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "staff_profiles",
        sourceId: teacherId,
        reason: "Teacher updated profile settings",
      });
      await invalidateTags(["teacher", "overview"]);
      res.json(await readTeacherProfileSettings(teacherId));
    } catch (e) {
      next(e);
    }
  }
);

// Profile photo upload (JSON data URL — same storage shape as the drawn
// signature). PNG/JPEG/GIF/WebP only, 2MB cap so rows stay lean.
router.post(
  "/settings/photo",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate(
    "body",
    z.object({
      photoUrl: z
        .string()
        .regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Photo must be a PNG, JPEG, GIF, or WebP data URL")
        .max(2_800_000),
    })
  ),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const { photoUrl } = req.body as { photoUrl: string };
      await prisma.staffProfile.upsert({
        where: { userId: teacherId },
        update: { photoUrl },
        create: {
          userId: teacherId,
          employeeId: `T-${teacherId.slice(0, 8)}`,
          photoUrl,
        },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "staff_profiles",
        sourceId: teacherId,
        reason: "Teacher updated profile photo",
      });
      await invalidateTags(["teacher", "overview"]);
      res.json({ photoUrl });
    } catch (e) {
      next(e);
    }
  }
);

export default router;

router.get("/schedule", requireAuth, requireRole("subject_teacher", "adviser"), async (req, res, next) => {
  try {
    const termId = await resolveActiveTermId(req);
    const sections = await prisma.section.findMany({
      where: { gradeLevel: { in: ["G7", "G8", "G9", "G10"] } },
      include: {
        adviser: { select: { fullName: true } },
        teacherAssignments: {
          where: termId ? { termId } : undefined,
          include: { subject: true, teacher: { select: { fullName: true } } },
        },
        timetableEntries: {
          where: termId ? { termId } : undefined,
          select: {
            subjectId: true,
            teacherNameId: true,
            day: true,
            period: true,
            status: true,
            reviewNote: true,
            subject: { select: { id: true, name: true, code: true } },
            teacherName: { select: { id: true, name: true } },
          },
        },
        _count: { select: { students: true } },
      },
    });
    res.json({ sections });
  } catch (e) {
    next(e);
  }
});

// Teaching staff options for the slot overlay: plain display names the
// master types once and picks forever. No accounts involved.
router.get(
  "/schedule/teachers",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (_req, res, next) => {
    try {
      const rows = await prisma.teacherName.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, userId: true },
      });
      // Never leak account ids — the master only needs to know whether a
      // teacher linked their login, which refreshes live on claim/unclaim.
      res.json({
        teachers: rows.map((t) => ({ id: t.id, name: t.name, code: t.code, linked: !!t.userId })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// The catalog row the signed-in teacher linked with their code (if any),
// plus this term's verification grant. The link is identity (global); the
// grant is per term — a Term 1 unlock never opens another term.
// Masters bypass code gates on My Classes / Attendance, so the flag rides
// along here too.
router.get(
  "/schedule/teachers/me",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const [mine, profile] = await Promise.all([
        prisma.teacherName.findUnique({
          where: { userId: teacherId },
          select: { id: true, name: true, code: true },
        }),
        prisma.staffProfile.findUnique({
          where: { userId: teacherId },
          select: { isMasterTeacher: true },
        }),
      ]);
      const termId = req.termScope?.termId ?? null;
      let termGrant: { via: string; attendanceVerified: boolean } | null = null;
      if (termId) {
        const grant = await prisma.teacherTermGrant.findUnique({
          where: { userId_termId: { userId: teacherId, termId } },
          select: { via: true, attendanceVerifiedAt: true },
        });
        if (grant) {
          termGrant = { via: grant.via, attendanceVerified: grant.attendanceVerifiedAt !== null };
        }
      }
      res.json({
        teacherName: mine
          ? {
              id: mine.id,
              name: mine.name,
              code: mine.code,
              // Per-term verification (legacy global flag retired).
              attendanceVerified: termGrant?.attendanceVerified ?? false,
            }
          : null,
        termGrant,
        isMasterTeacher: profile?.isMasterTeacher ?? false,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Per-term entry for advisers: answering "continue as adviser for this term"
// records the term grant in the DB (the auth verification flow per term).
// Subject teachers enter their code instead (claim + verify-attendance).
router.post(
  "/schedule/teachers/term-grant",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const termId = req.termScope?.termId ?? null;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      // Only advisers may enter a term this way — everyone else answers
      // with their teacher-list code.
      await adviserSectionsOr404(teacherId);
      const mine = await prisma.teacherName.findUnique({
        where: { userId: teacherId },
        select: { id: true },
      });
      const grant = await prisma.teacherTermGrant.upsert({
        where: { userId_termId: { userId: teacherId, termId } },
        update: { via: "adviser" },
        create: {
          userId: teacherId,
          termId,
          via: "adviser",
          teacherNameId: mine?.id ?? null,
        },
        select: { via: true, attendanceVerifiedAt: true },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "teacher_term_grants",
        sourceId: `${teacherId}|${termId}`,
        reason: "Teacher entered term workspace as adviser",
      });
      await invalidateTags(["teacher", "schedule"]);
      res.json({
        termGrant: { via: grant.via, attendanceVerified: grant.attendanceVerifiedAt !== null },
      });
    } catch (e) {
      next(e);
    }
  }
);

// Link the teacher's login to their teacher-list row by entering its code.
// One login holds one row; one row holds one login.
router.post(
  "/schedule/teachers/claim",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", z.object({ code: z.string().max(32) })),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const cleaned = ((req.body as { code?: string }).code ?? "").trim();
      if (!cleaned) {
        throw new AppError(400, "CODE_REQUIRED", "Enter the code from your teacher list entry");
      }
      const mine = await prisma.teacherName.findUnique({
        where: { userId: teacherId },
        select: { id: true, name: true, code: true },
      });
      if (mine) {
        throw new AppError(
          409,
          "ALREADY_LINKED",
          `This login is already linked to ${mine.name}${mine.code ? ` (${mine.code})` : ""}`
        );
      }
      const row = await prisma.teacherName.findFirst({
        where: { code: { equals: cleaned, mode: "insensitive" } },
      });
      if (!row || !row.code) {
        throw new AppError(
          404,
          "CODE_NOT_FOUND",
          "No teacher list entry uses this code — check with your Master Teacher"
        );
      }
      if (row.userId && row.userId !== teacherId) {
        throw new AppError(409, "CODE_TAKEN", "This code is already linked to another login");
      }
      const linked = await prisma.teacherName.update({
        where: { id: row.id },
        data: { userId: teacherId },
        select: { id: true, name: true, code: true },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "teacher_names",
        sourceId: linked.id,
        reason: `Teacher linked login to teacher list entry ${linked.name} (${linked.code})`,
      });
      await invalidateTags(["teacher", "schedule"]);
      res.json({ teacherName: linked });
      // Every master learns in realtime (toast + bell + catalog refresh)
      // that this teacher linked the code to their account — including a
      // master linking their own code, so the record exists in their bell.
      void notifyMastersTeacherLinkChanged(linked.id, linked.name, linked.code, "claim");
    } catch (e) {
      next(e);
    }
  }
);

// Best-effort fanout to active Master Teachers (never delays responses).
// Masters are flagged on StaffProfile, not a role, so role fanout can't
// address them.
async function notifyMastersTeacherLinkChanged(
  teacherNameId: string,
  teacherName: string,
  code: string | null,
  action: "claim" | "unclaim"
) {
  try {
    const masters = await prisma.user.findMany({
      where: { status: "active", staffProfile: { isMasterTeacher: true } },
      select: { id: true },
    });
    const message =
      action === "claim"
        ? `${teacherName} linked code ${code ?? "—"} to their login — their classes now follow the scheduled timetable.`
        : `${teacherName} unlinked code ${code ?? "—"} from their login.`;
    await Promise.all(
      masters.map((m) =>
        fanoutNotification({
          userId: m.id,
          sourceTable: "teacher_names",
          action,
          sourceId: teacherNameId,
          message,
        })
      )
    );
  } catch {
    // Logged inside fanoutNotification; never throws outward.
  }
}

// Verify the attendance code: the entered code must match the teacher's
// schedule link code (same code re-entered per term unlocks that term).
// The unlock lands on this term's grant row — never the global link row —
// so Term 1 can never open another term. On match both the teacher and
// every active Master Teacher get a realtime bell row (toast + badge,
// no refresh).
router.post(
  "/schedule/teachers/verify-attendance",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", z.object({ code: z.string().max(32) })),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const termId = req.termScope?.termId ?? null;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const cleaned = ((req.body as { code?: string }).code ?? "").trim();
      if (!cleaned) {
        throw new AppError(400, "CODE_REQUIRED", "Enter your teacher code to open attendance");
      }
      const mine = await prisma.teacherName.findUnique({
        where: { userId: teacherId },
        select: { id: true, name: true, code: true },
      });
      if (!mine) {
        throw new AppError(
          409,
          "NOT_LINKED",
          "No schedule link code found — link your code in My Classes first"
        );
      }
      if (!mine.code || mine.code.trim().toUpperCase() !== cleaned.toUpperCase()) {
        throw new AppError(
          403,
          "CODE_MISMATCH",
          "This code is not the same as your schedule link code. Check My Classes for the code you linked and try again"
        );
      }
      // Persist the unlock on THIS term's grant — attendance stops asking
      // for this term only, until the teacher leaves the term.
      await prisma.teacherTermGrant.upsert({
        where: { userId_termId: { userId: teacherId, termId } },
        update: { via: "code", teacherNameId: mine.id, attendanceVerifiedAt: new Date() },
        create: {
          userId: teacherId,
          termId,
          via: "code",
          teacherNameId: mine.id,
          attendanceVerifiedAt: new Date(),
        },
      });
      res.json({ verified: true, teacherName: { id: mine.id, name: mine.name, code: mine.code } });
      void (async () => {
        try {
          const masters = await prisma.user.findMany({
            where: { status: "active", staffProfile: { isMasterTeacher: true } },
            select: { id: true },
          });
          await fanoutNotification({
            userId: teacherId,
            sourceTable: "teacher_names",
            action: "attendance_unlock",
            sourceId: mine.id,
            message: `You unlocked attendance with code ${mine.code} — per-subject sheets are now open.`,
          });
          await Promise.all(
            masters
              .filter((m) => m.id !== teacherId)
              .map((m) =>
                fanoutNotification({
                  userId: m.id,
                  sourceTable: "teacher_names",
                  action: "attendance_unlock",
                  sourceId: mine.id,
                  message: `${mine.name} unlocked attendance with code ${mine.code}.`,
                })
              )
          );
        } catch {
          // Logged inside fanoutNotification; never throws outward.
        }
      })();
    } catch (e) {
      next(e);
    }
  }
);

// Leave the active term (per-term): drops ONLY this term's grant row.
// The catalog link and every other term's grants stay intact — leaving
// Term 1 never affects Term 2, because access is scoped by term, not by
// school year. No master fanout: the link itself is unchanged, so there is
// nothing for the teacher list to react to.
router.delete(
  "/schedule/teachers/me",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const termId = req.termScope?.termId ?? null;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const mine = await prisma.teacherName.findUnique({
        where: { userId: teacherId },
        select: { id: true, name: true, code: true },
      });
      if (!mine) {
        throw new AppError(404, "NOT_LINKED", "This login is not linked to any teacher list entry");
      }
      // Idempotent: leaving a term with no grant row still succeeds.
      await prisma.teacherTermGrant.deleteMany({
        where: { userId: teacherId, termId },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "teacher_term_grants",
        sourceId: mine.id,
        reason: "Teacher left the active term (per-term leave; link and other terms kept)",
      });
      await invalidateTags(["teacher", "schedule"]);
      res.json({ released: true });
    } catch (e) {
      next(e);
    }
  }
);

// The signed-in teacher's own timetable slots for the active term —
// committed slots only (approved + submitted), ordered for calendar render.
router.get(
  "/schedule/my-slots",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const slots = await prisma.sectionTimetableEntry.findMany({
        where: {
          termId,
          status: { in: ["APPROVED", "SUBMITTED"] },
          teacherName: { userId: req.user!.id },
        },
        select: {
          day: true,
          period: true,
          status: true,
          subject: { select: { id: true, name: true, code: true } },
          section: { select: { id: true, name: true, gradeLevel: true } },
          teacherName: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ day: "asc" }, { period: "asc" }],
      });
      res.json({ slots });
    } catch (e) {
      next(e);
    }
  }
);

// Subject options for the scheduling overlay — grades 7–10 only, so the
// master teacher can only pick subjects that belong to a section's grade.
router.get("/schedule/subjects", requireAuth, requireRole("subject_teacher", "adviser"), async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { gradeLevel: { in: ["G7", "G8", "G9", "G10"] } },
      select: { id: true, name: true, code: true, gradeLevel: true, category: true },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    });
    res.json({ subjects });
  } catch (e) {
    next(e);
  }
});

router.post("/schedule", requireAuth, requireRole("subject_teacher", "adviser"), validate("body", z.object({ subjectId: z.string(), sectionId: z.string() })), async (req, res, next) => {
  try {
    const teacherId = req.user!.id;
    const { subjectId, sectionId } = req.body as { subjectId: string; sectionId: string };
    const profile = await prisma.staffProfile.findUnique({ where: { userId: teacherId } });
    if (!profile?.isMasterTeacher) {
      throw new AppError(403, "MASTER_TEACHER_REQUIRED", "Only Master Teachers can schedule subjects");
    }
    const termId = await resolveActiveTermId(req);
    if (!termId) {
      throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
    }
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || !["G7", "G8", "G9", "G10"].includes(section.gradeLevel as string)) {
      throw new AppError(403, "GRADE_BAND_NOT_ALLOWED", "Schedule subject is only available for grades 7–10");
    }
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    if (subject.gradeLevel !== section.gradeLevel) {
      throw new AppError(403, "GRADE_MISMATCH", "The subject must belong to the section's grade level");
    }
    const existing = await prisma.teacherSubjectAssignment.findFirst({
      where: { teacherId, subjectId, sectionId, termId },
    });
    if (existing) {
      throw new AppError(409, "ASSIGNMENT_EXISTS", "This subject is already assigned to this section");
    }
    const assignment = await prisma.teacherSubjectAssignment.create({
      data: { teacherId, subjectId, sectionId, termId },
      include: { subject: true, section: true },
    }) as { id: string; subject: { name: string }; section: { name: string } };
    await writeAudit({
      userId: teacherId,
      actionType: "create",
      sourceTable: "teacher_subject_assignments",
      sourceId: assignment.id,
      reason: `Scheduled ${assignment.subject.name} for ${assignment.section.name}`,
    });
    await invalidateTags(["teacher", "overview", "schedule"]);
    res.status(201).json(assignment);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Persisted scheduling workspace: day-shape config + timetable cells.
// Entries are the source of truth for the grid; TeacherSubjectAssignment rows
// are derived (one per distinct scheduled subject) and stay in sync.
// ---------------------------------------------------------------------------

const SCHEDULE_CONFIG_DEFAULTS = {
  startTime: "07:30",
  periodMins: 60,
  lunch: { afterPeriod: 4, mins: 90 },
  morningRecess: { enabled: false, afterPeriod: 2, mins: 15 },
  afternoonRecess: { enabled: false, afterPeriod: 6, mins: 15 },
};

function toScheduleConfig(row: {
  startTime: string;
  periodMins: number;
  lunchAfter: number;
  lunchMins: number;
  recessAmOn: boolean;
  recessAmAfter: number;
  recessAmMins: number;
  recessPmOn: boolean;
  recessPmAfter: number;
  recessPmMins: number;
}) {
  return {
    startTime: row.startTime,
    periodMins: row.periodMins,
    lunch: { afterPeriod: row.lunchAfter, mins: row.lunchMins },
    morningRecess: { enabled: row.recessAmOn, afterPeriod: row.recessAmAfter, mins: row.recessAmMins },
    afternoonRecess: { enabled: row.recessPmOn, afterPeriod: row.recessPmAfter, mins: row.recessPmMins },
  };
}

const recessBodySchema = (minPeriod: number, maxPeriod: number) =>
  z.object({
    enabled: z.boolean(),
    afterPeriod: z.number().int().min(minPeriod).max(maxPeriod),
    mins: z.number().int().min(5).max(45),
  });

const scheduleConfigBodySchema = z.object({
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .refine(
      (v) => {
        const [h, m] = v.split(":").map(Number);
        return h >= 0 && h <= 23 && m >= 0 && m <= 59;
      },
      { message: "startTime must be a valid HH:MM time" }
    ),
  periodMins: z.number().int().min(15).max(120),
  lunch: z.object({
    afterPeriod: z.number().int().min(1).max(8),
    mins: z.number().int().min(15).max(180),
  }),
  morningRecess: recessBodySchema(1, 4),
  afternoonRecess: recessBodySchema(5, 8),
});

async function requireMasterTeacher(teacherId: string, action: string) {
  const profile = await prisma.staffProfile.findUnique({ where: { userId: teacherId } });
  if (!profile?.isMasterTeacher) {
    throw new AppError(403, "MASTER_TEACHER_REQUIRED", `Only Master Teachers can ${action}`);
  }
}

async function resolveScheduleTarget(sectionId: string, subjectId: string | null) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section || !["G7", "G8", "G9", "G10"].includes(section.gradeLevel as string)) {
    throw new AppError(
      403,
      "GRADE_BAND_NOT_ALLOWED",
      "Schedule subject is only available for grades 7–10"
    );
  }
  if (subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    if (subject.gradeLevel !== section.gradeLevel) {
      throw new AppError(
        403,
        "GRADE_MISMATCH",
        "The subject must belong to the section's grade level"
      );
    }
  }
  return section;
}

// One assignment per (teacher, subject, section, term) — created on demand so
// the gradebook/attendance owners resolve for scheduled subjects. Shared with
// the principal review flow (approval is what materializes assignments).
export async function ensureSubjectAssignment(
  teacherId: string,
  subjectId: string,
  sectionId: string,
  termId: string
) {
  const existing = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherId, subjectId, sectionId, termId },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.teacherSubjectAssignment.create({
    data: { teacherId, subjectId, sectionId, termId },
    select: { id: true },
  });
}

// Drops the requester's assignment once its last timetable cell is gone.
async function cleanupOrphanAssignment(
  teacherId: string,
  subjectId: string,
  sectionId: string,
  termId: string
) {
  const remaining = await prisma.sectionTimetableEntry.count({
    where: { sectionId, termId, subjectId },
  });
  if (remaining === 0) {
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { teacherId, subjectId, sectionId, termId },
    });
  }
}

// One subject takes one teacher per section (per term) — a teacher may still
// own several subjects. Shared by the slot writer, the submit gate, and the
// principal approve gate so every timeslot in every section stays consistent.
export async function findSubjectTeacherSplits(
  where: { sectionId?: string; termId: string },
): Promise<
  { subjectId: string; subjectName: string; sectionName: string; teacherNames: string[] }[]
> {
  const rows = await prisma.sectionTimetableEntry.findMany({
    where: { ...where, teacherNameId: { not: null } },
    select: {
      sectionId: true,
      subjectId: true,
      teacherNameId: true,
      subject: { select: { name: true } },
      section: { select: { name: true } },
      teacherName: { select: { name: true } },
    },
  });
  const bySubject = new Map<
    string,
    { subjectId: string; subjectName: string; sectionName: string; teachers: Map<string, string> }
  >();
  for (const r of rows) {
    if (!r.teacherNameId) continue;
    // Group per section + subject: the same subject in another section may
    // legitimately have a different teacher.
    const key = `${r.sectionId}|${r.subjectId}`;
    let bucket = bySubject.get(key);
    if (!bucket) {
      bucket = {
        subjectId: r.subjectId,
        subjectName: r.subject?.name ?? "Subject",
        sectionName: r.section?.name ?? "section",
        teachers: new Map(),
      };
      bySubject.set(key, bucket);
    }
    bucket.teachers.set(r.teacherNameId, r.teacherName?.name ?? "another teacher");
  }
  return [...bySubject.values()]
    .filter((b) => b.teachers.size > 1)
    .map((b) => ({
      subjectId: b.subjectId,
      subjectName: b.subjectName,
      sectionName: b.sectionName,
      teacherNames: [...b.teachers.values()],
    }));
}

// Day-shape config for the active term. No row yet → app defaults (same shape
// the setup view used before persistence existed). Principals can read it to
// render clock times on the review page; only masters may change it.
router.get(
  "/schedule/config",
  requireAuth,
  requireRole("subject_teacher", "adviser", "principal"),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const row = await prisma.scheduleConfig.findUnique({ where: { termId } });
      res.json({ config: row ? toScheduleConfig(row) : SCHEDULE_CONFIG_DEFAULTS });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/schedule/config",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", scheduleConfigBodySchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "configure the school day");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const body = req.body as z.infer<typeof scheduleConfigBodySchema>;
      const row = await prisma.scheduleConfig.upsert({
        where: { termId },
        create: {
          termId,
          startTime: body.startTime,
          periodMins: body.periodMins,
          lunchAfter: body.lunch.afterPeriod,
          lunchMins: body.lunch.mins,
          recessAmOn: body.morningRecess.enabled,
          recessAmAfter: body.morningRecess.afterPeriod,
          recessAmMins: body.morningRecess.mins,
          recessPmOn: body.afternoonRecess.enabled,
          recessPmAfter: body.afternoonRecess.afterPeriod,
          recessPmMins: body.afternoonRecess.mins,
        },
        update: {
          startTime: body.startTime,
          periodMins: body.periodMins,
          lunchAfter: body.lunch.afterPeriod,
          lunchMins: body.lunch.mins,
          recessAmOn: body.morningRecess.enabled,
          recessAmAfter: body.morningRecess.afterPeriod,
          recessAmMins: body.morningRecess.mins,
          recessPmOn: body.afternoonRecess.enabled,
          recessPmAfter: body.afternoonRecess.afterPeriod,
          recessPmMins: body.afternoonRecess.mins,
        },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "schedule_configs",
        sourceId: row.id,
        reason: "Master Teacher updated the school-day schedule shape",
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json({ config: toScheduleConfig(row) });
    } catch (e) {
      next(e);
    }
  }
);

// Unlock an approved timetable for editing. Approved slots are locked
// against fills, swaps, and clears — this is the only way back to draft,
// keeping every slot's content and stopping it from being official until
// the principal approves again.
router.post(
  "/schedule/unlock",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", z.object({ sectionId: z.string() })),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "unlock timetables");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const { sectionId } = req.body as { sectionId: string };
      const section = await resolveScheduleTarget(sectionId, null);
      const unlocked = await prisma.sectionTimetableEntry.updateMany({
        where: { sectionId, termId, status: "APPROVED" },
        data: {
          status: "DRAFT",
          submittedBy: null,
          submittedAt: null,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });
      if (unlocked.count === 0) {
        throw new AppError(404, "NOTHING_LOCKED", "No approved slots to unlock for this section");
      }
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "section_timetable_entries",
        sourceId: sectionId,
        reason: `Master Teacher unlocked the approved timetable for ${section.name} (${unlocked.count} slots back to draft)`,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json({ drafted: unlocked.count });
    } catch (e) {
      next(e);
    }
  }
);

// Send draft slots to the principal for review. With a sectionId it sends one
// section; without it, every draft workspace-wide. Already-submitted and
// approved rows are untouched either way.
router.post(
  "/schedule/submit",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", z.object({ sectionId: z.string().optional() })),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "send timetables for review");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const { sectionId } = req.body as { sectionId?: string };
      let sectionName: string | null = null;
      if (sectionId) {
        const section = await resolveScheduleTarget(sectionId, null);
        sectionName = section.name;
      }
      const scope = sectionId ? { sectionId, termId } : { termId };
      // Legacy rows saved before the one-teacher-per-subject rule (e.g.
      // Mathematics 7 held by several teachers in one section) must be
      // unified before review — submitting them would carry the split into
      // SUBMITTED/APPROVED. A teacher may still own several subjects.
      const splits = await findSubjectTeacherSplits(scope);
      if (splits.length > 0) {
        const detail = splits
          .map((s) => `${s.subjectName} in ${s.sectionName} (${s.teacherNames.join(", ")})`)
          .join("; ");
        throw new AppError(
          409,
          "SUBJECT_TEACHER_SPLIT",
          `One subject takes one teacher per section — unify before sending for review: ${detail}. Clear the subject's slots first to reassign it.`,
        );
      }
      const now = new Date();
      const updated = await prisma.sectionTimetableEntry.updateMany({
        where: { ...scope, status: "DRAFT" },
        data: {
          status: "SUBMITTED",
          submittedBy: teacherId,
          submittedAt: now,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });
      if (updated.count === 0) {
        throw new AppError(
          400,
          "NOTHING_TO_SEND",
          sectionId ? "No draft slots to send for this section" : "No draft slots to send"
        );
      }
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "section_timetable_entries",
        sourceId: sectionId ?? termId,
        reason: sectionId
          ? `Master Teacher sent ${updated.count} timetable slots for principal review`
          : `Master Teacher sent ${updated.count} timetable slots workspace-wide for principal review`,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json({ submitted: updated.count });
      // Principals learn about the pending review from their bell, not from
      // a second query — best-effort, never delays this response.
      void fanoutToRole("principal", {
        sourceTable: "section_timetable_entries",
        action: "submit",
        sourceId: sectionId ?? termId,
        excludeUserId: teacherId,
        message: sectionName
          ? `Master Teacher sent ${updated.count} timetable slots for ${sectionName} — review pending.`
          : `Master Teacher sent ${updated.count} timetable slots workspace-wide — review pending.`,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Fill (or replace) one timetable slot. Idempotent for the same subject.
// The slot carries a plain catalog name for display; the derived assignment
// always belongs to the master editing the grid, so gradebook ownership
// stays with a real account.
router.post(
  "/schedule/entries",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate(
    "body",
    z.object({
      sectionId: z.string(),
      subjectId: z.string(),
      teacherNameId: z.string(),
      day: z.number().int().min(1).max(5),
      period: z.number().int().min(0).max(7),
    })
  ),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "schedule subjects");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const { sectionId, subjectId, teacherNameId, day, period } = req.body as {
        sectionId: string;
        subjectId: string;
        teacherNameId: string;
        day: number;
        period: number;
      };
      await resolveScheduleTarget(sectionId, subjectId);
      const teacherName = await prisma.teacherName.findUnique({ where: { id: teacherNameId } });
      if (!teacherName) {
        throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher name not found");
      }
      // Check + write run in one transaction so two concurrent fills for
      // the same subject with different teachers cannot both slip through
      // the sibling check: the post-write re-verification inside the same
      // transaction rolls back the loser with SUBJECT_TEACHER_SPLIT.
      const { entry, status, prevSubjectId } = await prisma.$transaction(async (tx) => {
      // A teacher cannot run two sections in the same time slot: any other
      // section holding this teacher at this day + period blocks the fill.
      // The section's own slot is excluded — replacing inside it is an update.
      const clash = await tx.sectionTimetableEntry.findFirst({
        where: { termId, day, period, teacherNameId, NOT: { sectionId } },
        include: {
          section: { select: { name: true } },
          subject: { select: { name: true } },
        },
      });
      if (clash) {
        throw new AppError(
          409,
          "TEACHER_DOUBLE_BOOKED",
          `${teacherName.name} already teaches ${clash.subject.name} in ${clash.section.name} at this time`
        );
      }
      // One subject takes one teacher per section: any OTHER slot in this
      // section holding the same subject under a different teacher blocks
      // the fill. The slot being written is excluded, so retaking the
      // subject's last remaining slot still swaps its teacher cleanly.
      // To move a subject to another teacher, clear its slots first.
      // A teacher may still own several subjects in the same section.
      const siblings = await tx.sectionTimetableEntry.findMany({
        where: { sectionId, termId, subjectId },
        select: {
          day: true,
          period: true,
          teacherNameId: true,
          subject: { select: { name: true } },
          section: { select: { name: true } },
          teacherName: { select: { name: true } },
        },
      });
      const holder = siblings.find(
        (e) =>
          e.teacherNameId &&
          e.teacherNameId !== teacherNameId &&
          !(e.day === day && e.period === period),
      );
      if (holder) {
        const subjectName = holder.subject?.name ?? "This subject";
        const sectionName = holder.section?.name ?? "this section";
        const holderName = holder.teacherName?.name ?? "another teacher";
        throw new AppError(
          409,
          "SUBJECT_TEACHER_SPLIT",
          `${subjectName} in ${sectionName} is already assigned to ${holderName} — one subject takes one teacher per section. Clear its slots first to reassign it.`
        );
      }
      const slot = { sectionId, termId, day, period };
      const existing = await tx.sectionTimetableEntry.findUnique({
        where: { sectionId_termId_day_period: slot },
      });
      let row = existing;
      let code = 200;
      // Fills are always drafts — never live. Only principal approval
      // materializes gradebook assignments, so nothing is ensured here.
      // Replacing an approved slot's content sends it back for review.
      if (!existing) {
        row = await tx.sectionTimetableEntry.create({
          data: { ...slot, subjectId, teacherNameId, status: "DRAFT" },
        });
        code = 201;
      } else if (existing.subjectId !== subjectId || existing.teacherNameId !== teacherNameId) {
        // Approved timetables are locked — content swaps must go through an
        // explicit unlock (POST /schedule/unlock), never a silent demote.
        if (existing.status === "APPROVED") {
          throw new AppError(
            409,
            "SCHEDULE_LOCKED",
            "This slot is part of an approved timetable — unlock the section to edit it"
          );
        }
        row = await tx.sectionTimetableEntry.update({
          where: { id: existing.id },
          data: {
            subjectId,
            teacherNameId,
            status: "DRAFT",
            submittedBy: null,
            submittedAt: null,
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
          },
        });
      }
        // Post-write re-verification: catches the concurrent-fill race where
        // two writers both passed the pre-check before either row committed.
        const after = await tx.sectionTimetableEntry.findMany({
          where: { sectionId, termId, subjectId },
          select: { teacherNameId: true },
        });
        const distinct = new Set(after.map((e) => e.teacherNameId).filter(Boolean));
        if (distinct.size > 1) {
          throw new AppError(
            409,
            "SUBJECT_TEACHER_SPLIT",
            "One subject takes one teacher per section — another save just claimed this subject. Reload and retry."
          );
        }
        return { entry: row, status: code, prevSubjectId: existing?.subjectId ?? null };
      });
      if (prevSubjectId && prevSubjectId !== subjectId) {
        await cleanupOrphanAssignment(teacherId, prevSubjectId, sectionId, termId);
      }
      await writeAudit({
        userId: teacherId,
        actionType: status === 201 ? "create" : "update",
        sourceTable: "section_timetable_entries",
        sourceId: entry!.id,
        reason: "Master Teacher set a timetable slot",
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.status(status).json({
        entry: {
          id: entry!.id,
          sectionId,
          subjectId,
          teacherNameId,
          termId,
          day,
          period,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

// Empty one timetable slot. Drops the requester's assignment when its last
// cell for that subject is gone.
router.delete(
  "/schedule/entries",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "unschedule subjects");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const sectionId = String(req.query.sectionId ?? "");
      const day = Number(req.query.day);
      const period = Number(req.query.period);
      if (!sectionId || !Number.isInteger(day) || day < 1 || day > 5 || !Number.isInteger(period) || period < 0 || period > 7) {
        throw new AppError(400, "INVALID_SLOT", "sectionId, day (1–5) and period (0–7) are required");
      }
      const entry = await prisma.sectionTimetableEntry.findUnique({
        where: { sectionId_termId_day_period: { sectionId, termId, day, period } },
      });
      if (!entry) {
        throw new AppError(404, "NOT_FOUND", "Timetable slot is already empty");
      }
      if (entry.status === "APPROVED") {
        throw new AppError(
          409,
          "SCHEDULE_LOCKED",
          "This slot is part of an approved timetable — unlock the section to edit it"
        );
      }
      await prisma.sectionTimetableEntry.delete({ where: { id: entry.id } });
      await cleanupOrphanAssignment(teacherId, entry.subjectId, sectionId, termId);
      await writeAudit({
        userId: teacherId,
        actionType: "delete",
        sourceTable: "section_timetable_entries",
        sourceId: entry.id,
        reason: "Master Teacher cleared a timetable slot",
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json({ deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

// Clear the whole weekly grid for one section. Drops the requester's
// assignments left without cells.
router.delete(
  "/schedule/entries/all",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "clear timetables");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const sectionId = String(req.query.sectionId ?? "");
      if (!sectionId) {
        throw new AppError(400, "INVALID_SECTION", "sectionId is required");
      }
      await resolveScheduleTarget(sectionId, null);
      // Approved slots are locked — clears skip them (unlock first to
      // remove an approved timetable) and report what was kept.
      const lockedCount = await prisma.sectionTimetableEntry.count({
        where: { sectionId, termId, status: "APPROVED" },
      });
      const subjectIds = await prisma.sectionTimetableEntry.findMany({
        where: { sectionId, termId, status: { not: "APPROVED" } },
        select: { subjectId: true },
        distinct: ["subjectId"],
      });
      const removed = await prisma.sectionTimetableEntry.deleteMany({
        where: { sectionId, termId, status: { not: "APPROVED" } },
      });
      for (const { subjectId } of subjectIds) {
        await cleanupOrphanAssignment(teacherId, subjectId, sectionId, termId);
      }
      await writeAudit({
        userId: teacherId,
        actionType: "delete",
        sourceTable: "section_timetable_entries",
        sourceId: sectionId,
        reason: `Master Teacher cleared the whole timetable (${removed.count} slots)`,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json({ deleted: removed.count, skippedApproved: lockedCount });
    } catch (e) {
      next(e);
    }
  }
);

// Clear every timetable cell workspace-wide for the active term. Entries only
// ever exist for grades 7–10 (validated on write), so no per-section band
// check is needed. Three-segment path: never shadowed by the wildcard below.
router.delete(
  "/schedule/entries/clear-all",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "clear timetables");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      // Approved slots are locked — the workspace clear skips them and
      // reports what was kept.
      const lockedCount = await prisma.sectionTimetableEntry.count({
        where: { termId, status: "APPROVED" },
      });
      const pairs = await prisma.sectionTimetableEntry.findMany({
        where: { termId, status: { not: "APPROVED" } },
        select: { subjectId: true, sectionId: true },
        distinct: ["subjectId", "sectionId"],
      });
      const removed = await prisma.sectionTimetableEntry.deleteMany({
        where: { termId, status: { not: "APPROVED" } },
      });
      for (const p of pairs) {
        await cleanupOrphanAssignment(teacherId, p.subjectId, p.sectionId, termId);
      }
      await writeAudit({
        userId: teacherId,
        actionType: "delete",
        sourceTable: "section_timetable_entries",
        sourceId: termId,
        reason: `Master Teacher cleared all timetables (${removed.count} slots)`,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json({ deleted: removed.count, skippedApproved: lockedCount });
    } catch (e) {
      next(e);
    }
  }
);

// ---------------------------------------------------------------------------
// Master-created catalog records: teacher names and subjects, created from
// the slot overlay when the needed name is missing from the lists.
// ---------------------------------------------------------------------------

router.post(
  "/schedule/teachers",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate(
    "body",
    z.object({
      fullName: z.string().min(1).max(120),
    })
  ),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "add teacher names");
      const { fullName } = req.body as { fullName: string };
      const name = fullName.trim();
      const existing = await prisma.teacherName.findUnique({ where: { name } });
      if (existing) {
        throw new AppError(409, "TEACHER_EXISTS", "This name is already listed");
      }
      // Token code from initials + digits (MS-482), retried on collision.
      const parts = name.split(/\s+/).filter(Boolean);
      const initials =
        `${parts[0]?.[0] ?? "T"}${parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "")}`
          .toUpperCase()
          .replace(/[^A-Z]/g, "") || "T";
      let code = "";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = `${initials}-${100 + randomInt(900)}`;
        const clash = await prisma.teacherName.findUnique({ where: { code: candidate } });
        if (!clash) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        throw new AppError(500, "CODE_MINT_FAILED", "Could not mint a unique code, try again");
      }
      const teacher = await prisma.teacherName.create({
        data: { name, code },
        select: { id: true, name: true, code: true },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "create",
        sourceTable: "teacher_names",
        sourceId: teacher.id,
        reason: `Master Teacher listed teacher name ${teacher.name}`,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.status(201).json(teacher);
    } catch (e) {
      next(e);
    }
  }
);

// Empty the whole teacher-name catalog. Timetable cells cascade via FK; the
// requester's assignments left without cells are swept so no dead
// gradebook owners linger.
router.delete(
  "/schedule/teachers",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "clear teacher names");
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const pairs = await prisma.sectionTimetableEntry.findMany({
        where: { termId, teacherNameId: { not: null } },
        select: { subjectId: true, sectionId: true },
        distinct: ["subjectId", "sectionId"],
      });
      const removed = await prisma.teacherName.deleteMany({});
      for (const p of pairs) {
        const remaining = await prisma.sectionTimetableEntry.count({
          where: { sectionId: p.sectionId, termId, subjectId: p.subjectId },
        });
        if (remaining === 0) {
          await prisma.teacherSubjectAssignment.deleteMany({
            where: { subjectId: p.subjectId, sectionId: p.sectionId, termId },
          });
        }
      }
      await writeAudit({
        userId: teacherId,
        actionType: "delete",
        sourceTable: "teacher_names",
        sourceId: teacherId,
        reason: `Master Teacher cleared the teacher-name list (${removed.count} names)`,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json({ deleted: removed.count });
    } catch (e) {
      next(e);
    }
  }
);

// Subjects are usable immediately (no approval concept) and auto-selected.
router.post(
  "/schedule/subjects",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate(
    "body",
    z.object({
      name: z.string().min(1).max(120),
      code: z.string().min(1).max(24),
      gradeLevel: z.enum(["G7", "G8", "G9", "G10"]),
      category: z.enum(["CORE", "ELECTIVE"]).optional().default("CORE"),
    })
  ),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await requireMasterTeacher(teacherId, "create subjects");
      const { name, code, gradeLevel, category } = req.body as {
        name: string;
        code: string;
        gradeLevel: "G7" | "G8" | "G9" | "G10";
        category: "CORE" | "ELECTIVE";
      };
      const normalizedCode = code.trim().toUpperCase();
      const existing = await prisma.subject.findUnique({
        where: {
          code_gradeLevel: {
            code: normalizedCode,
            gradeLevel: gradeLevel as "G7" | "G8" | "G9" | "G10",
          },
        },
      });
      if (existing) {
        throw new AppError(409, "SUBJECT_EXISTS", "This subject code already exists for the grade");
      }
      const subject = await prisma.subject.create({
        data: { name: name.trim(), code: normalizedCode, gradeLevel, category },
        select: { id: true, name: true, code: true, gradeLevel: true, category: true },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "create",
        sourceTable: "subjects",
        sourceId: subject.id,
        reason: `Master Teacher created subject ${subject.name}`,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.status(201).json(subject);
    } catch (e) {
      next(e);
    }
  }
);

// NOTE: the wildcard delete below stays LAST — Express matches routes in
// registration order, so every specific /schedule/* route must register
// before it, otherwise e.g. DELETE /schedule/entries lands here with
// id="entries" and 404s.
router.delete("/schedule/:id", requireAuth, requireRole("subject_teacher", "adviser"), async (req, res, next) => {
  try {
    const teacherId = req.user!.id;
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: req.params.id as string },
      include: { subject: true, section: true },
    }) as {
      id: string;
      teacherId: string;
      subjectId: string;
      sectionId: string;
      termId: string;
      subject: { name: string };
      section: { name: string };
    } | null;
    if (!assignment || assignment.teacherId !== teacherId) {
      throw new AppError(404, "NOT_FOUND", "Assignment not found");
    }
    const profile = await prisma.staffProfile.findUnique({ where: { userId: teacherId } });
    if (!profile?.isMasterTeacher) {
      throw new AppError(403, "MASTER_TEACHER_REQUIRED", "Only Master Teachers can unschedule subjects");
    }
    await writeAudit({
      userId: teacherId,
      actionType: "delete",
      sourceTable: "teacher_subject_assignments",
      sourceId: assignment.id,
      reason: `Unschedule ${assignment.subject.name} from ${assignment.section.name}`,
    });
    await prisma.teacherSubjectAssignment.delete({ where: { id: req.params.id as string } });
    // Unscheduling a subject also clears its timetable cells for this term —
    // entries reference the subject directly, so they would otherwise dangle.
    await prisma.sectionTimetableEntry.deleteMany({
      where: {
        sectionId: assignment.sectionId,
        termId: assignment.termId,
        subjectId: assignment.subjectId,
      },
    });
    await invalidateTags(["teacher", "overview", "schedule"]);
    res.json({ deleted: true });
  } catch (e) {
    next(e);
  }
});
