import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { scopedYearId } from "../../lib/termScope.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import {
  getStudentAcademic,
  getStudentAnecdotal,
  getStudentAttendance,
  getStudentDetail,
  getStudents,
} from "../../services/advisory/students.service.js";

const router = Router();

function ctxOf(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: null as string | null,
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

async function termCtxOf(req: Request) {
  const base = ctxOf(req);
  return { ...base, termId: await resolveActiveTermId(req) };
}

async function schoolYearCtxOf(req: Request) {
  const base = ctxOf(req);
  return {
    ...base,
    termId: await resolveActiveTermId(req),
    schoolYearId: req.termScope?.schoolYearId ?? (await scopedYearId(req)),
  };
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
      res.json(await getStudents(await schoolYearCtxOf(req)));
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/teacher/advisory/students/:id/anecdotal — anecdotal records for one
// advisee (active term). Own records come back in full; anyone else's come back
// metadata-only (date, category, tier, follow-up count) — never the write-up.
router.get(
  "/students/:id/anecdotal",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      res.json(await getStudentAnecdotal(await termCtxOf(req), String(req.params.id)));
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
      res.json(await getStudentAttendance(await termCtxOf(req), String(req.params.id)));
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
      res.json(await getStudentAcademic(await termCtxOf(req), String(req.params.id)));
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
      res.json(await getStudentDetail(await termCtxOf(req), String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
