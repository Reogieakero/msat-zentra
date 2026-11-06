import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { scopedYearId } from "../../lib/termScope.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import { attendanceSheetQuerySchema } from "./teacher.schemas.js";
import { rosterSchema, rosterUpdateSchema } from "./advisory.schemas.js";
import {
  enlistRoster,
  getAttendanceSheet,
  updateRosterStudent,
} from "../../services/advisory/roster.service.js";

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

router.patch(
  "/roster/:studentId",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", rosterUpdateSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { fullName: string; lrn: string };
      const yearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      res.json(
        await updateRosterStudent(
          ctxOf(req),
          String(req.params.studentId),
          { fullName: body.fullName, lrn: body.lrn },
          yearId,
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/attendance",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("query", attendanceSheetQuerySchema),
  cache({ ttl: CACHE_TTLS.dashboard, tags: [CACHE_TAGS.teacher, CACHE_TAGS.attendance, CACHE_TAGS.roster] }),
  etag(),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const onlySection =
        typeof q.sectionId === "string" && q.sectionId.length > 0 ? q.sectionId : undefined;
      const subjectId =
        typeof q.subjectId === "string" && q.subjectId.length > 0 ? q.subjectId : undefined;
      const slot = Math.min(Math.max(Number(q.slot) || 1, 1), 10);
      const session = typeof q.session === "string" ? q.session : "";
      const date = new Date(String(q.date ?? ""));
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
