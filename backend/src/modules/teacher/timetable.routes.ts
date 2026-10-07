import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { resolveActiveTermId } from "../../services/risk.js";
import {
  entrySchema,
  scheduleAssignSchema,
  scheduleConfigBodySchema,
  subjectSchema,
  submitSchema,
  teacherNameSchema,
  unlockSchema,
} from "./teacher.schemas.js";
import {
  assignSubject,
  clearAll,
  clearEntry,
  clearSection,
  clearTeacherNames,
  createSubject,
  createTeacherName,
  deleteAssignment,
  getMySlots,
  getSchedule,
  getScheduleConfig,
  listScheduleSubjects,
  submitTimetable,
  unlockSection,
  updateScheduleConfig,
  writeEntry,
} from "../../services/teacher/timetable.service.js";

const router = Router();

function ctxOf(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

async function termCtxOf(req: Request) {
  return { ...ctxOf(req), termId: await resolveActiveTermId(req) };
}

router.get("/schedule", requireAuth, requireRole("subject_teacher", "adviser"), async (req, res, next) => {
  try {
    res.json(await getSchedule(await termCtxOf(req)));
  } catch (e) {
    next(e);
  }
});

// The signed-in teacher's own timetable slots for the active term —
// committed slots only (approved + submitted), ordered for calendar render.
router.get(
  "/schedule/my-slots",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      res.json(await getMySlots(await termCtxOf(req)));
    } catch (e) {
      next(e);
    }
  }
);

// Subject options for the scheduling overlay — grades 7–10 only, so the
// master teacher can only pick subjects that belong to a section's grade.
router.get("/schedule/subjects", requireAuth, requireRole("subject_teacher", "adviser"), async (_req, res, next) => {
  try {
    res.json(await listScheduleSubjects());
  } catch (e) {
    next(e);
  }
});

router.post("/schedule", requireAuth, requireRole("subject_teacher", "adviser"), validate("body", scheduleAssignSchema), async (req, res, next) => {
  try {
    const { subjectId, sectionId } = req.body as { subjectId: string; sectionId: string };
    const assignment = await assignSubject(await termCtxOf(req), subjectId, sectionId);
    await invalidateTags(["teacher", "overview", "schedule"]);
    res.status(201).json(assignment);
  } catch (e) {
    next(e);
  }
});

// Day-shape config for the active term. No row yet → app defaults (same shape
// the setup view used before persistence existed). Principals can read it to
// render clock times on the review page; only masters may change it.
router.get(
  "/schedule/config",
  requireAuth,
  requireRole("subject_teacher", "adviser", "principal"),
  async (req, res, next) => {
    try {
      res.json(await getScheduleConfig(await termCtxOf(req)));
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
      const body = req.body as {
        startTime: string;
        periodMins: number;
        lunch: { afterPeriod: number; mins: number };
        morningRecess: { enabled: boolean; afterPeriod: number; mins: number };
        afternoonRecess: { enabled: boolean; afterPeriod: number; mins: number };
      };
      const result = await updateScheduleConfig(await termCtxOf(req), body);
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json(result);
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
  validate("body", unlockSchema),
  async (req, res, next) => {
    try {
      const { sectionId } = req.body as { sectionId: string };
      const result = await unlockSection(await termCtxOf(req), sectionId);
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json(result);
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
  validate("body", submitSchema),
  async (req, res, next) => {
    try {
      const { sectionId } = req.body as { sectionId?: string };
      const result = await submitTimetable(await termCtxOf(req), sectionId);
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json(result);
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
  validate("body", entrySchema),
  async (req, res, next) => {
    try {
      const { sectionId, subjectId, teacherNameId, day, period } = req.body as {
        sectionId: string;
        subjectId: string;
        teacherNameId: string;
        day: number;
        period: number;
      };
      const ctx = await termCtxOf(req);
      const { entry, status } = await writeEntry(ctx, {
        sectionId,
        subjectId,
        teacherNameId,
        day,
        period,
      });
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.status(status).json({
        entry: {
          id: entry!.id,
          sectionId,
          subjectId,
          teacherNameId,
          termId: ctx.termId!,
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
      const sectionId = String(req.query.sectionId ?? "");
      const day = Number(req.query.day);
      const period = Number(req.query.period);
      const result = await clearEntry(await termCtxOf(req), sectionId, day, period);
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json(result);
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
      const sectionId = String(req.query.sectionId ?? "");
      const result = await clearSection(await termCtxOf(req), sectionId);
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json(result);
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
      const result = await clearAll(await termCtxOf(req));
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Master-created catalog records: teacher names and subjects, created from
// the slot overlay when the needed name is missing from the lists.
router.post(
  "/schedule/teachers",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", teacherNameSchema),
  async (req, res, next) => {
    try {
      const { fullName } = req.body as { fullName: string };
      const teacher = await createTeacherName(ctxOf(req), fullName);
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
      const result = await clearTeacherNames(await termCtxOf(req));
      await invalidateTags(["teacher", "schedule", "academics", "principal"]);
      res.json(result);
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
  validate("body", subjectSchema),
  async (req, res, next) => {
    try {
      const { name, code, gradeLevel, category } = req.body as {
        name: string;
        code: string;
        gradeLevel: "G7" | "G8" | "G9" | "G10";
        category: "CORE" | "ELECTIVE";
      };
      const subject = await createSubject(ctxOf(req), { name, code, gradeLevel, category });
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
    const result = await deleteAssignment(ctxOf(req), req.params.id as string);
    await invalidateTags(["teacher", "overview", "schedule"]);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
