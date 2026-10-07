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

// Attendance heat map: per-grade, per-day present/total rates split by AM/PM session.
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

// Per-section daily attendance heatblocks for the CURRENT term (calendar).
// Strict per-day basis: a student counts present for a day only when present
// in EVERY subject offered that weekday (late/absent/excused/unrecorded all
// break the day). Covers every school day from the term start date through
// today — previous terms are never mixed in. The `session` param is accepted
// but ignored on the strict path (subject-era takes carry a placeholder
// session); it only applies to the legacy fallback below when a term holds
// zero subject-era rows (e.g. archived AM/PM terms).
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

// Per-section attendance stats (rate, below-80% days, trend) and the
// school-wide daily attendance trend, for the CURRENT term (calendar) —
// previous terms are never mixed in. Strict per-day basis: a student counts
// present for a day only when present in EVERY subject offered that weekday.
// The `session` param is accepted but ignored on the strict path; it only
// applies to the legacy fallback when a term holds zero subject-era rows.
// amRate/pmRate echo the single daily rate (no session split exists anymore).
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

// School-wide AM/PM attendance pattern for the session's active term: overall AM/PM
// present rate plus the average present rate per weekday. Powers the "Patterns"
// overlay on the risk heatmaps index. Derived from real attendance records.
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

// Per-subject present rates for a section (active term). Replaces the AM/PM
// `session-pattern` comparison for subject-era data: one card per offered
// subject instead of two AM/PM bars.
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

// Per-section, per-day, per-subject heatblocks for the CURRENT term
// (calendar) — previous terms are never mixed in. Each section card renders
// one row per offered subject and one block per day, colored by the canonical
// present ratio (present ÷ headcount). Only subject-era rows (subjectId
// non-null) feed this surface — legacy AM/PM rows stay on the session
// heatmap + archive reads.
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
