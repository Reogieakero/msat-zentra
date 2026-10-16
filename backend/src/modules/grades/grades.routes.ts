import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole, requireOwnershipOrRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { gradeBandGuard } from "../../middleware/gradeBand.js";
import { validate } from "../../middleware/validate.js";
import { computeSubjectGrade, recomputeSubjectFinal } from "../../services/grading.js";
import { recomputeRisk, recomputeRosterRisk } from "../../services/risk.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { assertAssignment } from "../teacher/grading.repository.js";
import { verifyTeacherCode } from "../../services/teacher/directory.service.js";

const router = Router();

const scoreSchema = z.object({
  studentId: z.string().min(1),
  rawScore: z.number().min(0),
});
router.post(
  "/assessments/:id/score",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", scoreSchema),
  async (req, res, next) => {
    try {
      const assessment = await prisma.assessment.findUnique({
        where: { id: String(String(req.params.id)) },
        include: { gradeComponent: { include: { assessments: { include: { studentGrades: true } } } } },
      });
      if (!assessment) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found");

      const rawStudentId = String(req.body.studentId);
      const isRoster = rawStudentId.startsWith("roster:");
      const rosterId = isRoster ? rawStudentId.slice("roster:".length) : null;
      const rosterEntry = isRoster
        ? await prisma.studentRoster.findUnique({
            where: { id: rosterId as string },
            select: { id: true, sectionId: true, section: { select: { name: true } } },
          })
        : null;
      if (isRoster && !rosterEntry) {
        throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
      }

      const profileEntry = isRoster
        ? null
        : await prisma.studentProfile.findUnique({
            where: { userId: rawStudentId },
            select: { sectionId: true, section: { select: { name: true } } },
          });
      if (!isRoster && !profileEntry) {
        throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
      }

      const sectionName = isRoster
        ? (rosterEntry!.section?.name ?? "")
        : (profileEntry?.section?.name ?? "");
      // Section-subject scope: a scoped assessment only accepts students
      // from its own section.
      if (assessment.sectionId) {
        const studentSection = isRoster ? rosterEntry!.sectionId : profileEntry!.sectionId;
        if (studentSection !== assessment.sectionId) {
          throw new AppError(403, "FORBIDDEN", "Student is not in this section's class for this assessment");
        }
      }
      const gc = assessment.gradeComponent;
      if (isRoster) {
        const coverage = await prisma.teacherSubjectAssignment.findFirst({
          where: {
            teacherId: req.user!.id,
            subjectId: gc.subjectId,
            termId: gc.termId,
            sectionId: rosterEntry!.sectionId,
          },
          select: { id: true },
        });
        if (!coverage) {
          // Fall back to the timetable link: a teacher placed on the
          // submitted/approved timetable for this subject × section × term
          // owns the class even without an assignment row.
          const linked = await prisma.sectionTimetableEntry.findFirst({
            where: {
              subjectId: gc.subjectId,
              sectionId: rosterEntry!.sectionId,
              termId: gc.termId,
              status: { in: ["SUBMITTED", "APPROVED"] },
              teacherName: { userId: req.user!.id },
            },
            select: { id: true },
          });
          if (!linked) {
            throw new AppError(403, "FORBIDDEN", "Student is not in your class for this subject");
          }
        }
      }

      const percentage = (req.body.rawScore / assessment.maxScore) * 100;
      if (isRoster) {
        await prisma.studentGrade.upsert({
          where: { assessmentId_rosterId: { assessmentId: assessment.id, rosterId: rosterId as string } },
          create: { assessmentId: assessment.id, studentId: null, rosterId: rosterId as string, rawScore: req.body.rawScore, percentageScore: percentage },
          update: { rawScore: req.body.rawScore, percentageScore: percentage },
        });
      } else {
        await prisma.studentGrade.upsert({
          where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: rawStudentId } },
          create: { assessmentId: assessment.id, studentId: rawStudentId, rawScore: req.body.rawScore, percentageScore: percentage },
          update: { rawScore: req.body.rawScore, percentageScore: percentage },
        });
      }

      const key = isRoster ? { rosterId: rosterId as string } : { studentId: rawStudentId };
      const final = await recomputeSubjectFinal(key, gc.subjectId, gc.termId);

      if (!final) {
        throw new AppError(500, "RECOMPUTE_FAILED", "Could not recompute the final grade");
      }
      const { computedAverage, transmutedGrade, remarks } = final;

      if (!isRoster) {
        const term = await prisma.term.findFirst({ where: { id: gc.termId } });
        if (term) await recomputeRisk(rawStudentId, term.id);
      } else {
        await recomputeRosterRisk(rosterId as string, gc.termId);
      }

      await invalidateTags(["teacher", "registrar", "academics", "overview", "principal", "risk", "guidance"]);

      const categoryName =
        gc.componentType === "WRITTEN_WORK"
          ? "Written Work"
          : gc.componentType === "PERFORMANCE_TASK"
            ? "Performance Task"
            : "Exam";

      res.json({ computedAverage, transmutedGrade, remarks });
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "student_grades",
        action: "score_self",
        sourceId: assessment.id,
        message: `You saved scores for ${assessment.title} (${categoryName}) in ${sectionName}.`,
      });
    } catch (e) { next(e); }
  }
);

const bulkScoresSchema = z.object({
  scores: z.array(scoreSchema).min(1).max(300),
});

// Bulk save: one request + shared reads + batched writes + single
// invalidate/fanout. Per-item results with 207 semantics on partial success.
router.post(
  "/assessments/:id/scores",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", bulkScoresSchema),
  async (req, res, next) => {
    try {
      const assessment = await prisma.assessment.findUnique({
        where: { id: String(req.params.id) },
        include: { gradeComponent: true },
      });
      if (!assessment) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found");
      const gc = assessment.gradeComponent;

      // Dedupe: last write wins per studentId.
      const seen = new Map<string, number>();
      for (const s of req.body.scores as { studentId: string; rawScore: number }[]) {
        seen.set(String(s.studentId), s.rawScore);
      }
      type Item = { studentId: string; rawScore: number; rosterId: string | null; ok: boolean; error?: string };
      const items: Item[] = [...seen].map(([studentId, rawScore]) => ({
        studentId,
        rawScore,
        rosterId: studentId.startsWith("roster:") ? studentId.slice("roster:".length) : null,
        ok: true,
      }));
      // Range validation becomes per-item errors, not a whole-batch 400.
      for (const it of items) {
        if (!Number.isFinite(it.rawScore) || it.rawScore < 0 || it.rawScore > assessment.maxScore) {
          it.ok = false;
          it.error = `Score must be a number from 0 to ${assessment.maxScore}`;
        }
      }
      const candidates = items.filter((i) => i.ok);
      const rosterIds = [...new Set(candidates.filter((i) => i.rosterId).map((i) => i.rosterId as string))];
      const profileIds = [...new Set(candidates.filter((i) => !i.rosterId).map((i) => i.studentId))];

      // Shared existence reads (2 queries, not N).
      const [rosterEntries, profiles] = await Promise.all([
        rosterIds.length > 0
          ? prisma.studentRoster.findMany({
              where: { id: { in: rosterIds } },
              select: { id: true, sectionId: true, section: { select: { name: true } } },
            })
          : Promise.resolve([]),
        profileIds.length > 0
          ? prisma.studentProfile.findMany({
              where: { userId: { in: profileIds } },
              select: { userId: true, sectionId: true, section: { select: { name: true } } },
            })
          : Promise.resolve([]),
      ]);
      const rosterById = new Map(rosterEntries.map((r) => [r.id, r]));
      const profileById = new Map(profiles.map((p) => [p.userId, p]));
      const profileSet = new Set(profiles.map((p) => p.userId));
      for (const it of candidates) {
        if (it.rosterId) {
          if (!rosterById.has(it.rosterId)) { it.ok = false; it.error = "Student not found"; }
        } else if (!profileSet.has(it.studentId)) {
          it.ok = false; it.error = "Student not found";
        }
        // Section-subject scope: a scoped assessment only accepts students
        // from its own section.
        if (it.ok && assessment.sectionId) {
          const studentSection = it.rosterId
            ? rosterById.get(it.rosterId)?.sectionId
            : profileById.get(it.studentId)?.sectionId;
          if (studentSection !== assessment.sectionId) {
            it.ok = false;
            it.error = "Student is not in this section's class for this assessment";
          }
        }
      }

      // Coverage check batched per distinct section (parallel, not N sequential).
      const validAfterExist = candidates.filter((i) => i.ok);
      const sectionIds = [...new Set(validAfterExist.filter((i) => i.rosterId).map((i) => rosterById.get(i.rosterId as string)!.sectionId))];
      const coverageResults = await Promise.all(
        sectionIds.map(async (sectionId) => {
          const coverage = await prisma.teacherSubjectAssignment.findFirst({
            where: { teacherId: req.user!.id, subjectId: gc.subjectId, termId: gc.termId, sectionId },
            select: { id: true },
          });
          if (coverage) return { sectionId, ok: true };
          const linked = await prisma.sectionTimetableEntry.findFirst({
            where: {
              subjectId: gc.subjectId, sectionId, termId: gc.termId,
              status: { in: ["SUBMITTED", "APPROVED"] },
              teacherName: { userId: req.user!.id },
            },
            select: { id: true },
          });
          return { sectionId, ok: !!linked };
        }),
      );
      const unauthorizedSections = new Set(
        coverageResults.filter((c) => !c.ok).map((c) => c.sectionId),
      );
      if (unauthorizedSections.size > 0) {
        for (const it of validAfterExist) {
          if (it.rosterId && unauthorizedSections.has(rosterById.get(it.rosterId)!.sectionId)) {
            it.ok = false;
            it.error = "Student is not in your class for this subject";
          }
        }
      }

      const valid = items.filter((i) => i.ok);
      // No-op guard: one shared read of existing grades for this assessment;
      // rows identical to what's stored skip upsert, finals, and risk.
      // Additive `unchanged` flag in the response; clients ignore if unknown.
      const unchangedKeys = new Set<string>();
      if (valid.length > 0) {
        const vRosterPre = valid.filter((i) => i.rosterId).map((i) => i.rosterId as string);
        const vProfilePre = valid.filter((i) => !i.rosterId).map((i) => i.studentId);
        const existing = await prisma.studentGrade.findMany({
          where: {
            assessmentId: assessment.id,
            OR: [
              ...(vProfilePre.length > 0 ? [{ studentId: { in: vProfilePre } }] : []),
              ...(vRosterPre.length > 0 ? [{ rosterId: { in: vRosterPre } }] : []),
            ],
          },
          select: { studentId: true, rosterId: true, rawScore: true },
        });
        const existingByKey = new Map(
          existing.map((g) => [g.rosterId ? `roster:${g.rosterId}` : (g.studentId as string), g.rawScore]),
        );
        for (const it of valid) {
          if (existingByKey.get(it.studentId) === it.rawScore) unchangedKeys.add(it.studentId);
        }
      }
      const changed = valid.filter((i) => !unchangedKeys.has(i.studentId));
      if (changed.length > 0) {
        // Single transaction for all grade upserts.
        await prisma.$transaction(
          changed.map((it) => {
            const percentage = (it.rawScore / assessment.maxScore) * 100;
            return it.rosterId
              ? prisma.studentGrade.upsert({
                  where: { assessmentId_rosterId: { assessmentId: assessment.id, rosterId: it.rosterId } },
                  create: { assessmentId: assessment.id, studentId: null, rosterId: it.rosterId, rawScore: it.rawScore, percentageScore: percentage },
                  update: { rawScore: it.rawScore, percentageScore: percentage },
                })
              : prisma.studentGrade.upsert({
                  where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: it.studentId } },
                  create: { assessmentId: assessment.id, studentId: it.studentId, rawScore: it.rawScore, percentageScore: percentage },
                  update: { rawScore: it.rawScore, percentageScore: percentage },
                });
          }) as never[],
        );

        // Shared recompute read: all components + grades for changed students, once.
        // Section-subject scope: each student's evidence only draws from
        // assessments in their own section plus legacy NULL rows.
        const vRosterIds = changed.filter((i) => i.rosterId).map((i) => i.rosterId as string);
        const vProfileIds = changed.filter((i) => !i.rosterId).map((i) => i.studentId);
        const studentSectionOf = (studentKey: string): string | null => {
          if (studentKey.startsWith("roster:")) {
            return rosterById.get(studentKey.slice("roster:".length))?.sectionId ?? null;
          }
          return profileById.get(studentKey)?.sectionId ?? null;
        };
        const scopedSectionIds = [...new Set(changed.map((i) => studentSectionOf(i.studentId)).filter((s): s is string => !!s))];
        const components = await prisma.gradeComponent.findMany({
          where: { subjectId: gc.subjectId, termId: gc.termId },
          include: {
            assessments: {
              where: scopedSectionIds.length > 0
                ? { OR: [{ sectionId: { in: scopedSectionIds } }, { sectionId: null }] }
                : {},
              include: {
                studentGrades: {
                  where: {
                    OR: [
                      ...(vProfileIds.length > 0 ? [{ studentId: { in: vProfileIds } }] : []),
                      ...(vRosterIds.length > 0 ? [{ rosterId: { in: vRosterIds } }] : []),
                    ],
                  },
                },
              },
            },
          },
        });
        const gradeKey = (g: { studentId: string | null; rosterId: string | null }) =>
          g.rosterId ? `roster:${g.rosterId}` : (g.studentId as string);
        const assessmentVisible = (a: { sectionId: string | null }, studentKey: string): boolean => {
          if (!a.sectionId) return true;
          return studentSectionOf(studentKey) === a.sectionId;
        };
        const finalsOps = [];
        for (const it of changed) {
          const key = it.studentId;
          const evidence = components.map((c) => {
            const visible = c.assessments.filter((a) => assessmentVisible(a, key));
            const encoded = visible.filter((a) => a.studentGrades.some((g) => gradeKey(g) === key));
            return {
              componentType: c.componentType,
              weightPercentage: c.weightPercentage,
              earned: encoded.reduce((s, a) => s + a.studentGrades.filter((g) => gradeKey(g) === key).reduce((x, g) => x + g.rawScore, 0), 0),
              possible: encoded.reduce((s, a) => s + a.maxScore, 0),
              assessmentCount: visible.length,
              encodedCount: encoded.length,
            };
          });
          const result = computeSubjectGrade(evidence);
          if (result.computedAverage === null || result.rawGrade === null) {
            finalsOps.push(
              it.rosterId
                ? prisma.finalGrade.deleteMany({ where: { rosterId: it.rosterId, subjectId: gc.subjectId, termId: gc.termId } })
                : prisma.finalGrade.deleteMany({ where: { studentId: it.studentId, subjectId: gc.subjectId, termId: gc.termId } }),
            );
          } else {
            const { computedAverage, transmutedGrade, remarks } = result;
            finalsOps.push(
              it.rosterId
                ? prisma.finalGrade.upsert({
                    where: { rosterId_subjectId_termId: { rosterId: it.rosterId, subjectId: gc.subjectId, termId: gc.termId } },
                    create: { studentId: null, rosterId: it.rosterId, subjectId: gc.subjectId, termId: gc.termId, computedAverage, transmutedGrade, remarks },
                    update: { computedAverage, transmutedGrade, remarks },
                  })
                : prisma.finalGrade.upsert({
                    where: { studentId_subjectId_termId: { studentId: it.studentId, subjectId: gc.subjectId, termId: gc.termId } },
                    create: { studentId: it.studentId, subjectId: gc.subjectId, termId: gc.termId, computedAverage, transmutedGrade, remarks },
                    update: { computedAverage, transmutedGrade, remarks },
                  }),
            );
          }
        }
        if (finalsOps.length > 0) await prisma.$transaction(finalsOps as never[]);
      }

      const sectionName =
        rosterEntries[0]?.section?.name ?? profiles[0]?.section?.name ?? "";
      const categoryName =
        gc.componentType === "WRITTEN_WORK" ? "Written Work"
        : gc.componentType === "PERFORMANCE_TASK" ? "Performance Task" : "Exam";

      const results = items.map((it) => ({
        studentId: it.studentId,
        ok: it.ok,
        ...(it.error ? { error: it.error } : {}),
        ...(it.ok ? { rawScore: it.rawScore, percentageScore: (it.rawScore / assessment.maxScore) * 100 } : {}),
        ...(unchangedKeys.has(it.studentId) ? { unchanged: true } : {}),
      }));
      const savedCount = valid.length;
      const failedCount = items.length - savedCount;

      // Fast write path: respond as soon as grades + finals are committed.
      // Risk recompute, cache invalidation, and fanout run after-commit in
      // the background so derived analytics never block the save response.
      res.status(failedCount > 0 ? 207 : 200).json({ saved: savedCount, total: items.length, results });

      void (async () => {
        try {
          // Bounded parallelism so 40 risk recomputes don't thunder the pool.
          // Unchanged rows already match the DB: no risk work for them.
          const CONCURRENCY = 8;
          const queue = [...changed];
          const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
            while (queue.length > 0) {
              const it = queue.shift()!;
              try {
                if (it.rosterId) await recomputeRosterRisk(it.rosterId, gc.termId);
                else await recomputeRisk(it.studentId, gc.termId);
              } catch { /* background: next recompute heals */ }
            }
          });
          await Promise.all(workers);
        } catch { /* background risk must never fail the save */ }
        try {
          await invalidateTags(["teacher", "registrar", "academics", "overview", "principal", "risk", "guidance"]);
        } catch { /* cache failures are non-fatal */ }
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "student_grades",
          action: "score_self",
          sourceId: assessment.id,
          message: `You saved scores for ${assessment.title} (${categoryName}) in ${sectionName}.`,
        });
      })();
    } catch (e) { next(e); }
  }
);

router.get(
  "/students/:id/final-grades",
  requireAuth,
  requireOwnershipOrRole(async (req) => String(String(req.params.id)), "principal", "adviser", "subject_teacher", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const grades = await prisma.finalGrade.findMany({
        where: { studentId: String(String(req.params.id)) },
        include: { subject: true, term: true },
        orderBy: { termId: "asc" },
      });
      res.json(grades);
    } catch (e) { next(e); }
  }
);

router.post(
  "/final-grades/:id/lock",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) } });
      if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
      if (req.termScope?.termId && fg.termId !== req.termScope.termId) {
        throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found in the active term");
      }
      const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
      if (code) await verifyTeacherCode(req.user!.id, code);
      if (fg.lockStatus !== "unlocked") throw new AppError(409, "ALREADY_LOCKED", "Final already locked");
      const updated = await prisma.finalGrade.update({
        where: { id: fg.id },
        data: { lockStatus: "locked", lockedBy: req.user!.id, lockedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "grade_lock", sourceTable: "final_grades", sourceId: fg.id, reason: "Subject teacher submitted final grade for adviser approval" });
      await invalidateTags(["registrar", "registrar-finals", "registrar-overview", "record-keeper", "record-keeper-finals", "academics", "overview", "principal", "risk", "teacher"]);
      res.json(updated);
      void (async () => {
        try {
          const full = await prisma.finalGrade.findUnique({
            where: { id: fg.id },
            select: {
              subject: { select: { name: true, code: true, gradeLevel: true } },
              term: { select: { termNumber: true, schoolYear: { select: { name: true } } } },
              student: { select: { gradeLevel: true, section: { select: { id: true, name: true, adviserId: true } }, user: { select: { fullName: true } } } },
              roster: { select: { gradeLevel: true, fullName: true, section: { select: { id: true, name: true, adviserId: true } } } },
            },
          });
          if (full) {
            const gradeLevel = full.student?.gradeLevel ?? full.roster?.gradeLevel ?? full.subject.gradeLevel ?? null;
            const bandRole = gradeLevel === "G7" || gradeLevel === "G8" || gradeLevel === "G9" || gradeLevel === "G10" ? "record_keeper" : "registrar";
            const name = full.student?.user.fullName ?? full.roster?.fullName ?? "A student";
            const sectionName = full.student?.section?.name ?? full.roster?.section?.name ?? "—";
            const termSentence = `Term ${full.term.termNumber}, ${full.term.schoolYear.name}`;
            const subjectNoun = `${full.subject.name} (${full.subject.code})`;
            const locker = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true } });
            const lockerName = locker?.fullName ?? "A subject teacher";
            const message = `${lockerName} locked ${subjectNoun} for ${name} (${sectionName}) — ${termSentence}. Awaiting adviser approval.`;
            await fanoutToRole(bandRole, { sourceTable: "final_grades", action: "grade_locked", message, sourceId: fg.id, excludeUserId: req.user!.id });
            const adviserId = full.student?.section?.adviserId ?? full.roster?.section?.adviserId ?? null;
            if (adviserId && adviserId !== req.user!.id) {
              await fanoutNotification({ userId: adviserId, sourceTable: "final_grades", action: "grade_locked", message: `${message} Review it in your advisory queue.`, sourceId: fg.id });
            }
          }
        } catch { /* best-effort */ }
      })();
    } catch (e) { next(e); }
  }
);

const lockBatchSchema = z.object({
  assignmentId: z.string().min(1),
  code: z.string().trim().min(1).max(32),
  termId: z.string().min(1).optional(),
});

router.post(
  "/final-grades/lock-batch",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", lockBatchSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const requestedTermId = typeof req.body.termId === "string" && req.body.termId.trim()
        ? String(req.body.termId)
        : null;
      const scopeTermId = req.termScope?.termId ?? null;
      const termId = requestedTermId ?? scopeTermId;
      if (!termId) throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      await verifyTeacherCode(teacherId, String(req.body.code));
      const rawAssignmentId = String(req.body.assignmentId);
      // The printable record URL carries a composite `subjectId|sectionId` id.
      // Some clients send the pipe percent-encoded (`%7C`) inside the JSON
      // body (path params get decoded by Express, JSON bodies do not).
      let assignmentId = rawAssignmentId;
      try {
        if (rawAssignmentId.includes("%")) assignmentId = decodeURIComponent(rawAssignmentId);
      } catch { assignmentId = rawAssignmentId; }
      let assignment;
      try {
        assignment = await assertAssignment(teacherId, assignmentId, termId);
      } catch (e) {
        // Header scope may point at a different term than the class on screen
        // (e.g. record tab opened from an older workspace state). Fall back to
        // the term where this teacher actually owns the class.
        if (!(e instanceof AppError) || e.code !== "CLASS_NOT_FOUND" || assignmentId.indexOf("|") < 0) throw e;
        const sep = assignmentId.indexOf("|");
        const subjectId = assignmentId.slice(0, sep);
        const sectionId = assignmentId.slice(sep + 1);
        const [altAssignment, altLink] = await Promise.all([
          prisma.teacherSubjectAssignment.findFirst({
            where: { teacherId, subjectId, sectionId },
            orderBy: { termId: "asc" },
            select: { termId: true },
          }),
          prisma.sectionTimetableEntry.findFirst({
            where: { subjectId, sectionId, status: { in: ["APPROVED", "SUBMITTED"] }, teacherName: { userId: teacherId } },
            orderBy: { termId: "asc" },
            select: { termId: true },
          }),
        ]);
        const altTermId = altAssignment?.termId ?? altLink?.termId;
        if (!altTermId) throw e;
        assignment = await assertAssignment(teacherId, assignmentId, altTermId);
      }
      const effectiveTermId: string = assignment.termId;
      const targets = await prisma.finalGrade.findMany({
        where: {
          subjectId: assignment.subjectId,
          termId: effectiveTermId,
          lockStatus: "unlocked",
          NOT: { computedAverage: null },
          OR: [
            { student: { sectionId: assignment.sectionId } },
            { roster: { sectionId: assignment.sectionId } },
          ],
        },
        select: { id: true },
      });
      if (targets.length === 0) throw new AppError(409, "NOTHING_TO_LOCK", "Nothing to lock — all grades are already locked or have no average yet");
      await prisma.finalGrade.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data: { lockStatus: "locked", lockedBy: teacherId, lockedAt: new Date() },
      });
      await writeAudit({ userId: teacherId, actionType: "grade_lock", sourceTable: "final_grades", sourceId: assignmentId, reason: `Subject teacher locked ${targets.length} grades ${assignment.subject.code} ${assignment.section.name}` });
      await invalidateTags(["registrar", "registrar-finals", "registrar-overview", "record-keeper", "record-keeper-finals", "academics", "overview", "principal", "risk", "teacher"]);
      res.json({ locked: targets.length, skipped: 0 });
      void (async () => {
        try {
          const gradeLevel = assignment.subject.gradeLevel ?? assignment.section.gradeLevel ?? null;
          const bandRole = gradeLevel === "G7" || gradeLevel === "G8" || gradeLevel === "G9" || gradeLevel === "G10" ? "record_keeper" : "registrar";
          const termSentence = `Term ${assignment.term.termNumber}, ${assignment.term.schoolYear.name}`;
          const teacher = await prisma.user.findUnique({ where: { id: teacherId }, select: { fullName: true } });
          const teacherName = teacher?.fullName ?? "A subject teacher";
          const unit = targets.length === 1 ? "grade" : "grades";
          const subjectNoun = `${assignment.subject.name} (${assignment.subject.code})`;
          const message = `${teacherName} locked ${targets.length} ${subjectNoun} ${unit} for ${assignment.section.name} — ${termSentence}. They are awaiting adviser approval.`;
          const adviserMessage = `${message} Review them in your advisory queue.`;
          await fanoutToRole(bandRole, { sourceTable: "final_grades", action: "grade_locked", message, sourceId: assignmentId, excludeUserId: teacherId });
          const section = await prisma.section.findUnique({ where: { id: assignment.sectionId }, select: { adviserId: true } });
          if (section?.adviserId && section.adviserId !== teacherId) {
            await fanoutNotification({ userId: section.adviserId, sourceTable: "final_grades", action: "grade_locked", message: adviserMessage, sourceId: assignmentId });
          }
        } catch { /* best-effort */ }
      })();
    } catch (e) { next(e); }
  }
);

router.post(
  "/final-grades/:id/adviser-approve",
  requireAuth,
  requireRole("adviser"),
  gradeBandGuard(async (req) => {
    const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) }, select: { studentId: true, rosterId: true } });
    if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
    return fg.studentId ?? (fg.rosterId ? `roster:${fg.rosterId}` : "");
  }),
  async (req, res, next) => {
    try {
      const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) } });
      if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
      if (req.termScope?.termId && fg.termId !== req.termScope.termId) {
        throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found in the active term");
      }
      if (fg.lockStatus !== "locked") throw new AppError(409, "NOT_LOCKED", "Final must be locked by the subject teacher before adviser approval");
      const updated = await prisma.finalGrade.update({
        where: { id: fg.id },
        data: { lockStatus: "adviser_approved", adviserApprovedBy: req.user!.id, adviserApprovedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "grade_lock", sourceTable: "final_grades", sourceId: fg.id, reason: "Adviser approved final grade" });
      await invalidateTags(["registrar", "registrar-finals", "registrar-overview", "academics", "overview", "principal", "risk", "teacher"]);
      res.json(updated);

      void (async () => {
        try {
          const full = await prisma.finalGrade.findUnique({
            where: { id: fg.id },
            select: {
              termId: true,
              studentId: true,
              rosterId: true,
              lockedBy: true,
              subject: { select: { name: true, code: true } },
              term: { select: { termNumber: true, schoolYear: { select: { name: true } } } },
              student: {
                select: {
                  gradeLevel: true,
                  lrn: true,
                  section: { select: { name: true } },
                  user: { select: { fullName: true } },
                },
              },
              roster: { select: { gradeLevel: true, lrn: true, fullName: true, section: { select: { name: true } } } },
            },
          });
          if (!full) return;
          const gradeLevel = full.student?.gradeLevel ?? full.roster?.gradeLevel ?? null;
          const name = full.student?.user.fullName ?? full.roster?.fullName ?? "A student";
          const section = full.student?.section?.name ?? full.roster?.section?.name ?? "—";
          const remaining = await prisma.finalGrade.count({
            where: {
              termId: full.termId,
              ...(full.studentId ? { studentId: full.studentId } : { rosterId: full.rosterId }),
              NOT: { lockStatus: "adviser_approved" },
            },
          });
          if (remaining > 0) return;
          const bandRole =
            gradeLevel === "G7" || gradeLevel === "G8" || gradeLevel === "G9" || gradeLevel === "G10"
              ? "record_keeper"
              : "registrar";
          const termSentence = `Term ${full.term.termNumber}, ${full.term.schoolYear.name}`;
          const approver = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true } });
          const approverName = approver?.fullName ?? "The adviser";
          const subjectNoun = full.subject ? ` ${full.subject.name} (${full.subject.code})` : "";
          if (full.lockedBy && full.lockedBy !== req.user!.id) {
            try {
              await fanoutNotification({
                userId: full.lockedBy,
                sourceTable: "final_grades",
                action: "adviser_approved",
                message: `${approverName} approved${subjectNoun} for ${name} (${section}) — ${termSentence}.`,
                sourceId: fg.id,
              });
            } catch { /* best-effort */ }
          }
          if (remaining > 0) return;
          await fanoutToRole(bandRole, {
            sourceTable: "final_grades",
            action: "adviser_approved",
            message: `${approverName} approved all subjects for ${name} (${section}) — ${termSentence}. The record is complete and ready for your review.`,
            sourceId: fg.id,
            excludeUserId: req.user!.id,
          });
        } catch {

        }
      })();
    } catch (e) { next(e); }
  }
);

export default router;
