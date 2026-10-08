import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { scopedTermRow } from "../../lib/termScope.js";
import { resolveDisplayTerm } from "./attendance.repository.js";
import {
  getHeatmap,
  getSectionHeatmap,
  getSectionStats,
  getSessionPattern,
  getSectionSubjectHeatmap,
  getSubjectPattern,
  getSummary,
  type HeatSession,
} from "../../services/attendance/heatmaps.service.js";

const router = Router();

function ctxTerm(req: { termScope?: { termId: string; schoolYearId: string } | null }) {
  return {
    termId: req.termScope?.termId ?? null,
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

router.get(
  "/heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: HeatSession = req.query.session === "PM" ? "PM" : "AM";
      const statusFilter =
        req.query.status === "late" ||
        req.query.status === "absent" ||
        req.query.status === "excused"
          ? (req.query.status as "late" | "absent" | "excused")
          : "present";
      const activeTerm = await scopedTermRow(req);
      res.json(
        await getHeatmap({
          session,
          statusFilter,
          termId: activeTerm?.id,
          startDate: activeTerm?.startDate ?? undefined,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/summary",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const session: HeatSession | undefined =
        req.query.session === "AM" || req.query.session === "PM"
          ? (req.query.session as HeatSession)
          : undefined;
      const activeTerm = await scopedTermRow(req);
      res.json(await getSummary({ session, termId: activeTerm?.id }));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/section-heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: HeatSession = req.query.session === "PM" ? "PM" : "AM";
      const displayTerm = await resolveDisplayTerm(req);
      if (!displayTerm) {
        res.json({ session, sections: [] });
        return;
      }
      res.json(
        await getSectionHeatmap({
          session,
          schoolYearId: ctxTerm(req).schoolYearId,
          displayTerm,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/section-stats",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: HeatSession = req.query.session === "PM" ? "PM" : "AM";
      const selectedSectionId =
        typeof req.query.sectionId === "string" && req.query.sectionId.length > 0
          ? req.query.sectionId
          : undefined;
      const displayTerm = await resolveDisplayTerm(req);
      if (!displayTerm) {
        res.json({ sections: [], trend: [] });
        return;
      }
      res.json(
        await getSectionStats({
          session,
          selectedSectionId,
          schoolYearId: ctxTerm(req).schoolYearId,
          displayTerm,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/session-pattern",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const activeTerm = await scopedTermRow(req);
      res.json(
        await getSessionPattern({
          termId: activeTerm?.id,
          schoolYearId: ctxTerm(req).schoolYearId,
          startDate: activeTerm?.startDate ?? undefined,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/subject-pattern",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const activeTerm = await scopedTermRow(req);
      res.json(
        await getSubjectPattern({ sectionId, termId: activeTerm?.id }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/section-subject-heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const subjectFilter =
        typeof req.query.subjectId === "string" && req.query.subjectId.length > 0
          ? req.query.subjectId
          : undefined;
      const displayTerm = await resolveDisplayTerm(req);
      if (!displayTerm) {
        res.json({ sections: [], subjects: [], schoolDays: 0 });
        return;
      }
      res.json(
        await getSectionSubjectHeatmap({
          subjectId: subjectFilter,
          schoolYearId: ctxTerm(req).schoolYearId,
          displayTerm,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
