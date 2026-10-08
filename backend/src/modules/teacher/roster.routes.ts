import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { scopedYearId } from "../../lib/termScope.js";
import { validate } from "../../middleware/validate.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import { rosterSchema } from "./advisory.schemas.js";
import { enlistRoster, getAttendanceSheet } from "../../services/advisory/roster.service.js";

const router = Router();

function ctxOf(req: {
  user?: { id: string; role: string };
  termScope?: { termId: string; schoolYearId: string } | null;
}) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

router.post(
  "/roster",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", rosterSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { fullName: string; lrn: string; sectionId?: string };

      const yearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      const response = await enlistRoster(ctxOf(req), {
        fullName: body.fullName,
        lrn: body.lrn,
        sectionId: body.sectionId,
      }, yearId);

      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/attendance",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const onlySection =
        typeof req.query.sectionId === "string" && req.query.sectionId.length > 0
          ? req.query.sectionId
          : undefined;
      const subjectId =
        typeof req.query.subjectId === "string" && req.query.subjectId.length > 0
          ? req.query.subjectId
          : undefined;
      const slotRaw = typeof req.query.slot === "string" ? parseInt(req.query.slot, 10) : 1;
      const slot = Number.isFinite(slotRaw) ? Math.min(Math.max(slotRaw, 1), 10) : 1;
      const session = String(req.query.session ?? "");
      const date = new Date(String(req.query.date ?? ""));
      const schoolYearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      res.json(
        await getAttendanceSheet(ctxOf(req), {
          sectionId: onlySection,
          subjectId,
          slot,
          session,
          date,
          schoolYearId,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
