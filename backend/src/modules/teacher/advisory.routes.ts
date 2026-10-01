import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { scopedYearId } from "../../lib/termScope.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import {
  computeRiskFactors,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import {
  ATTENDANCE_RISK_CUTOFF,
  buildDayAxis,
  isWeekendKey,
  schoolDaysToDate,
  subjectAverageAttendance,
} from "../../services/attendance.js";
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

// Every section a teacher may take attendance for: advisory sections, plus
// sections from their subject assignments, plus sections from timetable
// slots attached to their linked teacher-list code (committed slots only).
// Union — never throws, so code-claimed subject teachers without advisory
// load or assignment rows still resolve their own classes.
export async function teachableSectionIds(teacherId: string, termId?: string | null): Promise<string[]> {
  const [advisory, assigned, linked] = await Promise.all([
    adviserSectionsOr404(teacherId).catch(() => [] as { id: string }[]),
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, ...(termId ? { termId } : {}) },
      select: { sectionId: true },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: {
        ...(termId ? { termId } : {}),
        status: { in: ["APPROVED", "SUBMITTED"] },
        teacherName: { userId: teacherId },
      },
      select: { sectionId: true },
      distinct: ["sectionId"],
    }),
  ]);
  return [
    ...new Set([
      ...advisory.map((s) => s.id),
      ...assigned.map((a) => a.sectionId),
      ...linked.map((l) => l.sectionId),
    ]),
  ];
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
      const termId = await resolveActiveTermId(req);
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
      // Offered subjects for these sections + term (assignments and
      // timetable rows): table headers come from here so subject-code
      // columns render even before any grade is encoded.
      const [assignSubjects, entrySubjects] = await Promise.all([
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
      ]);
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

      // Attendance at-risk follows the per-subject present average (same
      // definition as the advisory attendance display), never AM/PM
      // sessions. Students with no subject-linked takes keep the engine
      // result.
      const subjectAvgs = await subjectAverageAttendance(sectionIds, termId);
      const withSubjectAverage = <T extends { attendanceFlag: boolean }>(
        key: string,
        flags: T,
      ): T => {
        const subjAvg = subjectAvgs.get(key);
        if (subjAvg?.hasSubjectData) {
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
          };
        }),
      ];

      // Soft-delete scoping: ?archived=true lists only this adviser's
      // archived rows, default lists only active rows. Nothing is ever
      // deleted — restore brings the full record history back.
      const archivedRows = await prisma.adviserArchivedStudent.findMany({
        where: { teacherId },
        select: { studentId: true, rosterId: true },
      });
      const archivedProfiles = new Set(
        archivedRows.map((r) => r.studentId).filter((s): s is string => !!s),
      );
      const archivedRosters = new Set(
        archivedRows.map((r) => r.rosterId).filter((s): s is string => !!s),
      );
      const isArchived = (studentId: string) =>
        studentId.startsWith("roster:")
          ? archivedRosters.has(studentId.slice("roster:".length))
          : archivedProfiles.has(studentId);
      const wantArchived = String(req.query.archived ?? "") === "true";

      res.json({
        advisorySections: sections,
        termId,
        students: students.filter((s) => isArchived(s.studentId) === wantArchived),
        archivedCount: archivedRows.length,
        subjects: [...new Map(
          [...assignSubjects, ...entrySubjects].map((s) => [s.subject.name, s.subject]),
        ).values()].sort((a, b) => a.name.localeCompare(b.name)),
      });
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

      // Enlistments are saved under the session's active School Year.
      const yearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      if (!yearId) {
        throw new AppError(409, "NO_ACTIVE_YEAR", "No active school year");
      }
      const activeYear = { id: yearId };

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

      // Respond the moment the row exists — audit, cache invalidation
      // (~18 Upstash round trips), and the bell fanout all run behind the
      // response so enlisting feels instant.
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
      void (async () => {
        try {
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
          // Realtime bell row for the filing adviser (toast suppressed
          // client-side — the success toast already fired there).
          await fanoutNotification({
            userId: teacherId,
            sourceTable: "student_roster",
            action: "create",
            message: `You enlisted ${entry.fullName} (${entry.lrn}) to ${entry.section.name}.`,
            sourceId: entry.id,
          });
        } catch {
          // Logged inside fanoutNotification/audit; never throws outward.
        }
      })();
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/teacher/advisory/students/archive — soft-delete one advisee
// from the caller's advisory list (profile or `roster:<id>` enlistment).
// Adviser-only. Grades, attendance, anecdotal records, and referrals are
// never touched — restore brings the full history back.
router.post(
  "/students/archive",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", z.object({ studentId: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sections = await adviserSectionsOr404(teacherId);
      const sectionIds = new Set(sections.map((s) => s.id));
      const studentId = String((req.body as { studentId?: string }).studentId ?? "");
      let displayName = "";
      let archiveData: { teacherId: string; studentId?: string; rosterId?: string };
      if (studentId.startsWith("roster:")) {
        const row = await prisma.studentRoster.findUnique({
          where: { id: studentId.slice("roster:".length) },
          select: { id: true, sectionId: true, fullName: true, lrn: true },
        });
        if (!row || !sectionIds.has(row.sectionId)) {
          throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
        }
        displayName = `${row.fullName} (${row.lrn})`;
        archiveData = { teacherId, rosterId: row.id };
      } else {
        const student = await prisma.studentProfile.findUnique({
          where: { userId: studentId },
          select: {
            userId: true,
            lrn: true,
            user: { select: { fullName: true } },
            section: { select: { id: true } },
          },
        });
        if (!student || !student.section || !sectionIds.has(student.section.id)) {
          throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
        }
        displayName = `${student.user.fullName} (${student.lrn})`;
        archiveData = { teacherId, studentId };
      }
      const archived = await prisma.adviserArchivedStudent.upsert({
        where: studentId.startsWith("roster:")
          ? { teacherId_rosterId: { teacherId, rosterId: studentId.slice("roster:".length) } }
          : { teacherId_studentId: { teacherId, studentId } },
        update: {},
        create: archiveData,
        select: { id: true },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "adviser_archived_students",
        sourceId: archived.id,
        reason: `Archived ${displayName} from advisory list (records kept)`,
      });
      await invalidateTags(["academics", "overview", "principal", "teacher"]);
      res.status(201).json({ archived: true, id: archived.id, studentId });
      // Realtime bell row for the filing adviser (toast suppressed
      // client-side — the success toast already fired there).
      void fanoutNotification({
        userId: teacherId,
        sourceTable: "adviser_archived_students",
        action: "create",
        message: `You archived ${displayName} from your advisory list. Records are kept.`,
        sourceId: archived.id,
      });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/teacher/advisory/students/restore — bring a soft-deleted advisee
// back with their full record history intact. Adviser-only, own rows only.
router.post(
  "/students/restore",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", z.object({ studentId: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      await adviserSectionsOr404(teacherId);
      const studentId = String((req.body as { studentId?: string }).studentId ?? "");
      const where = studentId.startsWith("roster:")
        ? { teacherId, rosterId: studentId.slice("roster:".length) }
        : { teacherId, studentId };
      const existing = await prisma.adviserArchivedStudent.findFirst({
        where,
        select: { id: true },
      });
      if (!existing) {
        throw new AppError(404, "NOT_ARCHIVED", "Student is not archived");
      }
      let displayName = studentId;
      if (studentId.startsWith("roster:")) {
        const row = await prisma.studentRoster.findUnique({
          where: { id: studentId.slice("roster:".length) },
          select: { fullName: true, lrn: true },
        });
        if (row) displayName = `${row.fullName} (${row.lrn})`;
      } else {
        const profile = await prisma.studentProfile.findUnique({
          where: { userId: studentId },
          select: { lrn: true, user: { select: { fullName: true } } },
        });
        if (profile) displayName = `${profile.user.fullName} (${profile.lrn})`;
      }
      await prisma.adviserArchivedStudent.delete({ where: { id: existing.id } });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "adviser_archived_students",
        sourceId: existing.id,
        reason: `Restored ${displayName} to advisory list with record history`,
      });
      await invalidateTags(["academics", "overview", "principal", "teacher"]);
      res.json({ restored: true, studentId });
      void fanoutNotification({
        userId: teacherId,
        sourceTable: "adviser_archived_students",
        action: "delete",
        message: `You restored ${displayName} to your advisory list with full history.`,
        sourceId: studentId,
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
      const termId = await resolveActiveTermId(req);
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
      const termId = await resolveActiveTermId(req);
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
          select: {
            date: true,
            session: true,
            status: true,
            subjectId: true,
            slot: true,
            subject: { select: { name: true, code: true } },
          },
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
      const subjectsByDate = new Map<
        string,
        Record<string, { status: string; slot: number; name: string; code: string }>
      >();
      const subjectTotals = new Map<
        string,
        { name: string; code: string; present: number; total: number }
      >();
      const subjectCounts = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      for (const r of records) {
        const key = r.date.toISOString().slice(0, 10);
        if (r.subjectId) {
          if (isWeekendKey(key)) continue;
          const perDay = subjectsByDate.get(key) ?? {};
          // Same subject twice in one day (slot>1): keep the worst status so
          // a missed period is never hidden behind a present one.
          const rank = (s: string) =>
            s === "absent" ? 3 : s === "late" ? 2 : s === "excused" ? 1 : 0;
          const prev = perDay[r.subjectId];
          if (!prev || rank(r.status) > rank(prev.status)) {
            perDay[r.subjectId] = {
              status: r.status,
              slot: r.slot,
              name: r.subject?.name ?? r.subjectId,
              code: r.subject?.code ?? r.subjectId,
            };
          }
          subjectsByDate.set(key, perDay);
          subjectCounts.total += 1;
          if (r.status === "present") subjectCounts.present++;
          else if (r.status === "absent") subjectCounts.absent++;
          else if (r.status === "late") subjectCounts.late++;
          else if (r.status === "excused") subjectCounts.excused++;
          const agg = subjectTotals.get(r.subjectId) ?? {
            name: r.subject?.name ?? r.subjectId,
            code: r.subject?.code ?? r.subjectId,
            present: 0,
            total: 0,
          };
          agg.total += 1;
          if (r.status === "present") agg.present += 1;
          subjectTotals.set(r.subjectId, agg);
        } else {
          const sessions = byDate.get(key) ?? {};
          sessions[r.session] = r.status;
          byDate.set(key, sessions);
        }
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
            subjects: subjectsByDate.get(key) ?? {},
          };
        });
      // Overall subject rate + per-subject breakdown (null when the student
      // has only legacy AM/PM rows — the daily sessions view stays canonical).
      const hasSubjectRows = subjectCounts.total > 0;
      const subjectSummary = hasSubjectRows
        ? {
            present: subjectCounts.present,
            absent: subjectCounts.absent,
            late: subjectCounts.late,
            excused: subjectCounts.excused,
            total: subjectCounts.total,
            rate: subjectCounts.present / subjectCounts.total,
            isRisk: subjectCounts.present / subjectCounts.total < 0.8,
            bySubject: [...subjectTotals.entries()].map(([subjectId, agg]) => ({
              subjectId,
              name: agg.name,
              code: agg.code,
              present: agg.present,
              total: agg.total,
              rate: agg.total > 0 ? agg.present / agg.total : 1,
            })),
          }
        : null;

      res.json({
        student: {
          studentId: student.userId,
          name: student.fullName,
          lrn: student.lrn,
          section: student.section?.name ?? "",
        },
        summary,
        subjectSummary,
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
      const termId = await resolveActiveTermId(req);
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

// GET /api/teacher/advisory/attendance — submitted marks for one section +
// date (+ subject & slot) — per-subject sheet prefill.
// Query: ?date=ISO-datetime [& sectionId=..] [& session=AM|PM]
//   [& subjectId=.. & slot=N].
// Subject path (subjectId present) filters by (section, subject, day, slot);
// legacy path filters by session. Without sectionId the scope stays the
// caller's teachable sections (advisory UNION assignments UNION code-linked
// timetable sections); with sectionId the scope narrows to that section
// (403 unless teachable), so two sections sharing a subject never mix marks.
router.get(
  "/attendance",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      // Advisory UNION assignments UNION code-linked timetable sections, so
      // claimed subject teachers prefill their own classes too.
      const teachable = await teachableSectionIds(teacherId);
      if (teachable.length === 0) {
        throw new AppError(404, "NOT_ADVISER", "No advisory or teaching sections assigned");
      }
      const onlySection =
        typeof req.query.sectionId === "string" && req.query.sectionId.length > 0
          ? req.query.sectionId
          : undefined;
      if (onlySection && !teachable.includes(onlySection)) {
        throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
      }
      const sectionIds = onlySection ? [onlySection] : teachable;
      const subjectId =
        typeof req.query.subjectId === "string" && req.query.subjectId.length > 0
          ? req.query.subjectId
          : undefined;
      const slotRaw = typeof req.query.slot === "string" ? parseInt(req.query.slot, 10) : 1;
      const slot = Number.isFinite(slotRaw) ? Math.min(Math.max(slotRaw, 1), 10) : 1;
      const session = String(req.query.session ?? "");
      if (!subjectId && session !== "AM" && session !== "PM") {
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
          ...(subjectId
            ? { subjectId, slot }
            : { session: session as "AM" | "PM" }),
          date: { gte: dayStart, lt: nextDay },
        },
        select: { studentId: true, rosterId: true, status: true, subjectId: true, slot: true },
      });
      res.json({
        date: dayKey,
        ...(subjectId ? { subjectId, slot } : { session }),
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
      const termId = await resolveActiveTermId(req);
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

// Pure adviser-name match: the principal files sections under a free-text
// adviser name, and the teacher claims the section by matching their account
// name against it. Trimmed + case-insensitive so "juan dela cruz" matches
// "Juan Dela Cruz". Pure so it stays unit-testable without a DB.
export function matchesAdviserName(adviserLabel: string | null | undefined, fullName: string): boolean {
  if (!adviserLabel || !fullName) return false;
  return adviserLabel.trim().toLowerCase() === fullName.trim().toLowerCase();
}

function gradeToNumber(gradeLevel: string): number {
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

// GET /api/teacher/advisory/claim-status — first-login self-onboarding.
// Returns sections the teacher already advises plus every unclaimed section
// (adviserId null) in the session's active school year. Name matches against
// the principal's free-text label are flagged `suggested` and sorted first,
// but every unclaimed section is claimable — the listed name is sometimes
// misspelled, so it never gates the list.
router.get(
  "/claim-status",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const yearId = await scopedYearId(req);
      if (!yearId) return res.json({ alreadyAdvising: [], claimable: [] });

      const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        select: { fullName: true },
      });
      if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");

      const [advised, candidates] = await Promise.all([
        prisma.section.findMany({
          where: { schoolYearId: yearId, adviserId: teacherId },
          orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          select: { id: true, name: true, gradeLevel: true, schoolYearId: true },
        }),
        prisma.section.findMany({
          where: { schoolYearId: yearId, adviserId: null },
          orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          select: { id: true, name: true, gradeLevel: true, adviserLabel: true },
        }),
      ]);

      res.json({
        alreadyAdvising: advised.map((s) => ({
          id: s.id,
          name: s.name,
          gradeLevel: gradeToNumber(s.gradeLevel),
          schoolYearId: s.schoolYearId,
        })),
        claimable: candidates
          .map((s) => ({
            id: s.id,
            name: s.name,
            gradeLevel: gradeToNumber(s.gradeLevel),
            adviserLabel: s.adviserLabel ?? "",
            suggested: matchesAdviserName(s.adviserLabel, teacher.fullName),
          }))
          .sort(
            (a, b) =>
              Number(b.suggested) - Number(a.suggested) ||
              a.gradeLevel - b.gradeLevel ||
              a.name.localeCompare(b.name),
          ),
      });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/teacher/advisory/claim { sectionId } — link the teacher's account
// as the section adviser. Guards: section must be in the session's school
// year and currently unclaimed (any unclaimed section is claimable — the
// principal's free-text name is sometimes misspelled, so it never gates the
// claim). The write itself is a conditional updateMany (adviserId still null)
// so two teachers racing the same section resolve to exactly one winner
// (409 for the loser).
router.post(
  "/claim",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const { sectionId } = req.body as { sectionId?: string };
      if (!sectionId?.trim()) throw new AppError(400, "MISSING_FIELDS", "sectionId is required");
      const yearId = await scopedYearId(req);

      const [teacher, section] = await Promise.all([
        prisma.user.findUnique({ where: { id: teacherId }, select: { fullName: true } }),
        prisma.section.findUnique({
          where: { id: sectionId.trim() },
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            schoolYearId: true,
            adviserId: true,
            adviserLabel: true,
            schoolYear: { select: { name: true } },
          },
        }),
      ]);
      if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      if (yearId && section.schoolYearId !== yearId) {
        throw new AppError(403, "SCOPE_MISMATCH", "Section is outside the active school year");
      }
      // Idempotent re-claim of our own section.
      if (section.adviserId === teacherId) {
        return res.json({
          id: section.id,
          name: section.name,
          gradeLevel: gradeToNumber(section.gradeLevel),
          adviserId: teacherId,
          alreadyClaimed: true,
        });
      }

      const claimed = await prisma.section.updateMany({
        where: { id: section.id, adviserId: null },
        data: { adviserId: teacherId },
      });
      if (claimed.count === 0) {
        throw new AppError(
          409,
          "SECTION_ALREADY_CLAIMED",
          `Section "${section.name}" was just claimed by someone else.`
        );
      }
      // Keep the staff directory consistent when a profile row exists (no
      // create — employeeId is unique and only the registrar assigns it).
      await prisma.staffProfile.updateMany({
        where: { userId: teacherId },
        data: { isAdviser: true },
      });
      await writeAudit({
        userId: teacherId,
        actionType: "update",
        sourceTable: "sections",
        sourceId: section.id,
        reason: "Teacher claimed advisory section (self-onboarding)",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview", "teacher"]);

      res.json({
        id: section.id,
        name: section.name,
        gradeLevel: gradeToNumber(section.gradeLevel),
        adviserId: teacherId,
        alreadyClaimed: false,
      });
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /api/teacher/advisory/claim { sectionId? } — release the teacher's
// advisory section(s). With sectionId, releases only that section when owned;
// without it, releases every section this teacher advises (answering "Are you
// an adviser?" with No in Settings). Conditional writes so a section already
// taken over by someone else is never touched.
router.delete(
  "/claim",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const bodyId = ((req.body ?? {}) as { sectionId?: string }).sectionId;
      const queryId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const { sectionId } = { sectionId: bodyId ?? queryId };
      const trimmed = sectionId?.trim() || null;

      let released: { id: string; name: string }[] = [];
      if (trimmed) {
        const owned = await prisma.section.findFirst({
          where: { id: trimmed, adviserId: teacherId },
          select: { id: true, name: true },
        });
        if (!owned) {
          throw new AppError(404, "NOT_ADVISER", "You are not the adviser of this section");
        }
        await prisma.section.updateMany({
          where: { id: owned.id, adviserId: teacherId },
          data: { adviserId: null },
        });
        released = [{ id: owned.id, name: owned.name }];
      } else {
        const owned = await prisma.section.findMany({
          where: { adviserId: teacherId },
          select: { id: true, name: true },
        });
        if (owned.length === 0) {
          return res.json({ released: [], isAdviser: false });
        }
        await prisma.section.updateMany({
          where: { adviserId: teacherId },
          data: { adviserId: null },
        });
        released = owned.map((s) => ({ id: s.id, name: s.name }));
      }

      // Keep the staff directory consistent: adviser flag mirrors whether any
      // advised section remains.
      const remaining = await prisma.section.count({ where: { adviserId: teacherId } });
      await prisma.staffProfile.updateMany({
        where: { userId: teacherId },
        data: { isAdviser: remaining > 0 },
      });
      for (const s of released) {
        await writeAudit({
          userId: teacherId,
          actionType: "update",
          sourceTable: "sections",
          sourceId: s.id,
          reason: "Teacher released advisory section (Settings)",
        });
      }
      await invalidateTags(["academics", "principal", "registrar", "overview", "teacher"]);

      res.json({ released, isAdviser: remaining > 0 });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
