import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import {
  computeRiskFactors,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import { buildDayAxis, isWeekendKey, schoolDaysToDate } from "../../services/attendance.js";
import { sectionHeadcounts } from "../../services/enrollment.js";

const router = Router();

const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

// Pure gate: adviser-only surfaces 404 unless the teacher advises ≥1 section.
// Throws AppError so it stays unit-testable without a DB.
export function requireAdvisorySections<T extends { id: string }>(sections: T[]): T[] {
  if (sections.length === 0) {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  return sections;
}

export async function adviserSectionsOr404(teacherId: string) {
  const sections = await prisma.section.findMany({
    where: { adviserId: teacherId },
    select: { id: true, name: true, gradeLevel: true },
  });
  return requireAdvisorySections(sections);
}

// GET /api/teacher/advisory/students — advisee roster with risk chips.
// Adviser-only (404 otherwise). No anecdotal content, ever — counts and
// confidentiality tiers only.
router.get(
  "/students",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sections = await adviserSectionsOr404(teacherId);
      const termId = await resolveActiveTermId();
      if (!termId) {
        return res.json({ advisorySections: sections, termId: null, students: [] });
      }

      const sectionIds = sections.map((s) => s.id);
      const [counts, advisees, rosterEntries] = await Promise.all([
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
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: { where: { termId }, select: { status: true } },
            anecdotalRecords: {
              where: { termId },
              select: { confidentialityLevel: true, category: true },
            },
            gradeFlags: { select: { status: true } },
          },
          orderBy: { user: { fullName: "asc" } },
        }),
        // Enlisted but not yet registered: roster rows with no login account.
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
      ]);
      const enrolledBySection = new Map(counts.map((c) => [c.sectionId, c._count._all]));
      // Roster-aware attendance denominators: enlisted students without
      // accounts count toward the section headcount too.
      const headcounts = await sectionHeadcounts(sectionIds);
      for (const [id, n] of headcounts) enrolledBySection.set(id, n);
      const registeredLrns = new Set(advisees.map((s) => s.lrn));
      const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
      const rosterIds = rosterOnly.map((r) => r.id);
      const profileIds = advisees.map((s) => s.userId);

      // Live inputs for roster rows: finals, attendance, anecdotal tiers, and
      // raw assessment means — the same engine inputs profiles get, so risk
      // levels respect the engine for every advisee.
      const [rosterFinals, rosterAttendance, rosterAnecdotal, rawRows] = await Promise.all([
        rosterIds.length > 0
          ? prisma.finalGrade.findMany({
              where: { rosterId: { in: rosterIds }, termId },
              select: { rosterId: true, computedAverage: true, transmutedGrade: true },
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
      // Per-student raw subject means (unweighted) for the raw-grade check.
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

      const toActiveFlags = (flags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean }) => {
        const active: ("academic" | "attendance" | "behavioral")[] = [];
        if (flags.academicFlag) active.push("academic");
        if (flags.attendanceFlag) active.push("attendance");
        if (flags.behavioralFlag) active.push("behavioral");
        return active;
      };

      const students = [
        ...advisees.map((s) => {
          const enrolled = enrolledBySection.get(s.sectionId!) ?? 0;
          const factors = computeRiskFactors({
            finalGrades: s.finalGrades,
            rawAverages: rawAveragesFor(s.userId),
            attendance: s.attendanceRecords,
            anecdotalCount: s.anecdotalRecords.length,
            enrolled,
          });
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
          };
        }),
        // Roster-only enlistments (no login account yet) — never duplicated
        // with registered profiles (matched by LRN), fully engine-scored.
        ...rosterOnly.map((r) => {
          const key = `roster:${r.id}`;
          const finals = finalsByRoster.get(r.id) ?? [];
          const att = attendanceByRoster.get(r.id) ?? [];
          const anec = anecdotalByRoster.get(r.id) ?? [];
          const enrolled = enrolledBySection.get(r.sectionId) ?? 0;
          const factors = computeRiskFactors({
            finalGrades: finals,
            rawAverages: rawAveragesFor(key),
            attendance: att,
            anecdotalCount: anec.length,
            enrolled,
          });
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
          };
        }),
      ];

      res.json({ advisorySections: sections, termId, students });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/teacher/advisory/roster — enlist a student into the adviser's
// section roster (enrolled, no login account yet). When the student later
// registers with the same LRN, the registrar's breakdown links them.
// Adviser-only (404 otherwise).
const rosterSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  lrn: z.string().trim().min(1).max(32),
  sectionId: z.string().min(1).optional(),
});

router.post(
  "/roster",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", rosterSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const body = req.body as z.infer<typeof rosterSchema>;
      const sections = await adviserSectionsOr404(teacherId);
      const section = body.sectionId
        ? sections.find((s) => s.id === body.sectionId)
        : sections[0];
      if (!section) {
        throw new AppError(404, "SECTION_NOT_FOUND", "Section is not in your advisory");
      }

      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (!activeYear) {
        throw new AppError(409, "NO_ACTIVE_YEAR", "No active school year");
      }

      const existing = await prisma.studentRoster.findUnique({
        where: { lrn_schoolYearId: { lrn: body.lrn, schoolYearId: activeYear.id } },
      });
      if (existing) {
        throw new AppError(409, "LRN_ENLISTED", "This LRN is already enlisted");
      }
      const alreadyRegistered = await prisma.studentProfile.findUnique({
        where: { lrn: body.lrn },
        select: { userId: true },
      });
      if (alreadyRegistered) {
        throw new AppError(409, "LRN_REGISTERED", "This LRN already has an account");
      }

      const entry = await prisma.studentRoster.create({
        data: {
          lrn: body.lrn,
          fullName: body.fullName,
          gradeLevel: section.gradeLevel,
          sectionId: section.id,
          schoolYearId: activeYear.id,
        },
        include: { section: { select: { name: true } } },
      });

      await writeAudit({
        userId: teacherId,
        actionType: "create",
        sourceTable: "student_roster",
        sourceId: entry.id,
        reason: `Enlisted ${entry.fullName} (${entry.lrn}) to ${entry.section.name}`,
      });
      // Enrollment headcounts are cached — a new enlistment must refresh
      // academics, overview, and teacher caches immediately.
      await invalidateTags([
        "registrar",
        "record-keeper",
        "academics",
        "overview",
        "principal",
        "teacher",
      ]);

      res.status(201).json({
        studentId: `roster:${entry.id}`,
        name: entry.fullName,
        lrn: entry.lrn,
        birthdate: null,
        gender: null,
        section: entry.section.name,
        riskLevel: "Low",
        flags: [],
        attendanceRate: 1,
        anecdotalCount: 0,
        confidentialityTiers: [],
        hasOpenFlag: false,
        openFlagCount: 0,
        hasAccount: false,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Shared advisee check: returns the profile when the student sits in one of
// the caller's advisory sections, otherwise throws 404 (uniform, no probing).
async function assertAdvisee(teacherId: string, studentId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    include: {
      user: { select: { fullName: true } },
      section: { select: { id: true, name: true, adviserId: true } },
    },
  });
  if (!student || student.section?.adviserId !== teacherId) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  }
  return student;
}

// GET /api/teacher/advisory/students/:id/anecdotal — anecdotal records for one
// advisee (active term). Own records come back in full; anyone else's come back
// metadata-only (date, category, tier, follow-up count) — never the write-up.
router.get(
  "/students/:id/anecdotal",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const studentId = String(req.params.id);
      const termId = await resolveActiveTermId();
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

      res.json({
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
      });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/teacher/advisory/students/:id/attendance — attendance for one
// advisee (active term): summary rate plus per-day AM/PM sessions.
router.get(
  "/students/:id/attendance",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const rawId = String(req.params.id);
      const termId = await resolveActiveTermId();
      if (!termId) {
        throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
      }
      // Enlisted students without accounts resolve under `roster:<id>` — no
      // account is required to view their attendance record.
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

      const recordWhere = isRoster
        ? { rosterId: student.rosterId as string, termId }
        : { studentId: student.studentId as string, termId };
      const [records, term] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where: recordWhere,
          select: { date: true, session: true, status: true },
          orderBy: [{ date: "desc" }, { session: "asc" }],
        }),
        prisma.term.findUnique({ where: { id: termId }, select: { startDate: true } }),
      ]);

      // Denominator = every school-day session since term start (AM + PM per
      // weekday). There is no "unmarked" state on this surface: a school-day
      // session with no submitted record reads as absent — the only statuses
      // are present, absent, late, and excused.
      const schoolDays = schoolDaysToDate(term?.startDate ?? null);
      const possible = schoolDays * 2;
      // Weekday-only counts so the summary matches the calendar axis:
      // legacy seed rows exist on weekends and must not inflate the total.
      const weekdayRecords = records.filter(
        (r) => !isWeekendKey(r.date.toISOString().slice(0, 10))
      );
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const r of weekdayRecords) counts[r.status]++;
      const unrecorded = Math.max(0, possible - records.length);
      const absent = counts.absent + unrecorded;
      const rate = possible === 0 ? 1 : counts.present / possible;
      const summary = {
        present: counts.present,
        absent,
        late: counts.late,
        excused: counts.excused,
        total: possible,
        schoolDays,
        rate,
        isRisk: rate < 0.8,
      };

      // Full school-day axis from term start through today (weekdays only):
      // days without records render as unmarked, so gaps are visible instead
      // of silently collapsing the timeline.
      const byDate = new Map<string, Record<string, string>>();
      for (const r of records) {
        const key = r.date.toISOString().slice(0, 10);
        const sessions = byDate.get(key) ?? {};
        sessions[r.session] = r.status;
        byDate.set(key, sessions);
      }
      const days = buildDayAxis(term?.startDate ?? null)
        .filter((key) => !isWeekendKey(key))
        .reverse()
        .map((key) => {
          const sessions = byDate.get(key) ?? {};
          return {
            date: key,
            sessions: {
              AM: sessions.AM ?? "absent",
              PM: sessions.PM ?? "absent",
            },
          };
        });

      res.json({
        student: {
          studentId: student.userId,
          name: student.fullName,
          lrn: student.lrn,
          section: student.section?.name ?? "",
        },
        summary,
        termStart: term?.startDate ?? null,
        days,
      });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/teacher/advisory/students/:id/academic — subject grades for one
// advisee (active term), read-only. Includes a passed/failed summary.
router.get(
  "/students/:id/academic",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const rawId = String(req.params.id);
      const termId = await resolveActiveTermId();
      if (!termId) {
        throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
      }
      // Enlisted students without accounts resolve under `roster:<id>` — no
      // account is required to view their academic record.
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
        // Every subject offered in the student's section — so subjects with
        // no encoded grade yet still display (as ungraded raw rows).
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

      res.json({
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
      });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/teacher/advisory/attendance — submitted marks for one date +
// session across the caller's advisory sections (sheet prefill).
// Query: ?date=ISO-datetime & session=AM|PM. Adviser-only (404 otherwise).
router.get(
  "/attendance",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sections = await adviserSectionsOr404(teacherId);
      const sectionIds = sections.map((s) => s.id);
      const session = String(req.query.session ?? "");
      if (session !== "AM" && session !== "PM") {
        throw new AppError(400, "BAD_SESSION", "session must be AM or PM");
      }
      const date = new Date(String(req.query.date ?? ""));
      if (Number.isNaN(date.getTime())) {
        throw new AppError(400, "BAD_DATE", "date must be an ISO datetime");
      }
      const dayKey = date.toISOString().slice(0, 10);
      const dayStart = new Date(`${dayKey}T00:00:00Z`);
      const nextDay = new Date(dayStart.getTime() + 86_400_000);
      // Day-bounded match covers both UTC-midnight rows (new takes) and
      // local-noon rows (seed backfill) falling on the same UTC calendar day.
      const records = await prisma.attendanceRecord.findMany({
        where: {
          sectionId: { in: sectionIds },
          session: session as "AM" | "PM",
          date: { gte: dayStart, lt: nextDay },
        },
        select: { studentId: true, rosterId: true, status: true },
      });
      res.json({
        date: dayKey,
        session,
        marks: records.map((r) => ({
          studentId: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
          status: r.status,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/teacher/advisory/students/:id — drawer detail for one advisee.
// 404 unless the student is in the caller's advisory section. Referrals and
// ADM come back status/stage-only; anecdotal content is never included.
router.get(
  "/students/:id",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const studentId = String(req.params.id);
      const termId = await resolveActiveTermId();
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

      res.json({
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
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
