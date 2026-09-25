import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import {
  computeRiskFactors,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";

const router = Router();

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

const COMPONENT_TYPE_LABEL: Record<string, "WW" | "PT" | "QE"> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

const ACTION_LABEL: Record<string, string> = {
  grade_lock: "Locked grades",
  grade_unlock: "Unlocked grades",
  anecdotal_edit: "Logged anecdotal",
  referral_status_change: "Updated referral",
  create: "Created record",
  update: "Updated record",
};

const EMPTY_RESPONSE = {
  teacherName: "",
  isAdviser: false,
  advisorySection: null,
  kpi: { classCount: 0, pendingAssessments: 0, openFlags: 0, studentCount: 0 },
  atRiskFactors: { academic: 0, attendance: 0, behavioral: 0 },
  atRiskStudents: 0,
  classes: [],
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
      const termId = await resolveActiveTermId();
      if (!termId) {
        return res.json(EMPTY_RESPONSE);
      }

      const [user, assignments, advisorySections] = await Promise.all([
        prisma.user.findUnique({
          where: { id: teacherId },
          select: { fullName: true },
        }),
        prisma.teacherSubjectAssignment.findMany({
          where: { teacherId, termId },
          include: { subject: true, section: true },
        }),
        prisma.section.findMany({
          where: { adviserId: teacherId },
          select: { id: true, name: true, gradeLevel: true },
        }),
      ]);

      const isAdviser = advisorySections.length > 0;
      const advisorySection = advisorySections[0] ?? null;

      const sectionIds = Array.from(new Set(assignments.map((a) => a.section.id)));
      const [sectionCounts, sectionStudents, openFlags] = await Promise.all([
        prisma.studentProfile.groupBy({
          by: ["sectionId"],
          where: { sectionId: { in: sectionIds } },
          _count: { _all: true },
        }),
        prisma.studentProfile.findMany({
          where: { sectionId: { in: sectionIds } },
          select: { userId: true, sectionId: true },
        }),
        prisma.anecdotalRecord.count({ where: { observerId: teacherId, termId } }),
      ]);

      // Roster-aware headcounts: enlisted students without accounts count too.
      const headcounts = await sectionHeadcounts(sectionIds);
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
      const classes = assignments.map((a) => {
        const subjectKey = a.subject.id;
        if (!subjectSectionIds.has(subjectKey)) subjectSectionIds.set(subjectKey, new Set());
        subjectSectionIds.get(subjectKey)!.add(a.section.id);
        if (!classLookup.has(subjectKey)) {
          classLookup.set(subjectKey, {
            subject: a.subject.name,
            section: a.section.name,
          });
        }
        return {
          id: a.id,
          subject: a.subject.name,
          gradeLevel: GRADE_LABELS[a.section.gradeLevel] ?? a.section.gradeLevel,
          section: a.section.name,
          studentCount: countBySection.get(a.section.id) ?? 0,
        };
      });
      const studentCount = Array.from(countBySection.values()).reduce((sum, n) => sum + n, 0);

      const subjectIds = Array.from(new Set(assignments.map((a) => a.subject.id)));

      // Secondary aggregations (assessments, standings, activity). Skipped
      // entirely for `critical` scope so first paint only waits on primary data.
      let assessmentsPayload: {
        id: string;
        subject: string;
        gradeLevel: string;
        section: string;
        type: "WW" | "PT" | "QE";
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
          const activeFlags: ("academic" | "attendance" | "behavioral")[] = [];
          if (flags.academicFlag) activeFlags.push("academic");
          if (flags.attendanceFlag) activeFlags.push("attendance");
          if (flags.behavioralFlag) activeFlags.push("behavioral");
          return { flags, activeFlags, flag: activeFlags[0] ?? ("none" as const) };
        };

        const enrolled = countBySection.get(advisorySection.id) ?? 0;
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
        advisorySection: advisorySection
          ? {
              id: advisorySection.id,
              name: advisorySection.name,
              gradeLevel:
                GRADE_LABELS[advisorySection.gradeLevel] ?? advisorySection.gradeLevel,
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

export default router;
