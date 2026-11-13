import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { resolveActiveTermId } from "../../lib/term-resolve.js";
import {
  loadPortalLearner,
  listLearnerTerms,
  resolvePortalTerm,
} from "../../lib/portalAccess.js";
import {
  getLearnerAttendance,
  getLearnerGrades,
  getLearnerHome,
  getLearnerMe,
  getLearnerSchedule,
  getUpcomingSessions,
} from "../../services/portal/learnerData.service.js";

const router = Router();

function termIdOf(req: { query: Record<string, unknown> }): string | undefined {
  const raw = req.query.termId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

async function termFor(req: { query: Record<string, unknown> }) {
  return resolvePortalTerm(termIdOf(req as { query: Record<string, unknown> }), await resolveActiveTermId());
}

router.use(requireAuth, requireRole("student"));

router.get("/me", async (req, res, next) => {
  try {
    const learner = await loadPortalLearner(req.user!.id);
    const term = await termFor(req);
    res.json({ learner, term, profile: await getLearnerMe(req.user!.id) });
  } catch (e) {
    next(e);
  }
});

router.get("/terms", async (req, res, next) => {
  try {
    const activeTermId = await resolveActiveTermId();
    res.json({ terms: await listLearnerTerms(req.user!.id, activeTermId), activeTermId });
  } catch (e) {
    next(e);
  }
});

router.get("/home", async (req, res, next) => {
  try {
    const learner = await loadPortalLearner(req.user!.id);
    const term = await termFor(req);
    res.json(await getLearnerHome(req.user!.id, learner, term));
  } catch (e) {
    next(e);
  }
});

router.get("/grades", async (req, res, next) => {
  try {
    res.json(await getLearnerGrades(req.user!.id, await termFor(req)));
  } catch (e) {
    next(e);
  }
});

router.get("/attendance", async (req, res, next) => {
  try {
    res.json(await getLearnerAttendance(req.user!.id, await termFor(req)));
  } catch (e) {
    next(e);
  }
});

router.get("/schedule", async (req, res, next) => {
  try {
    res.json(await getLearnerSchedule(req.user!.id, await termFor(req)));
  } catch (e) {
    next(e);
  }
});

router.get("/sessions", async (req, res, next) => {
  try {
    res.json({ sessions: await getUpcomingSessions(req.user!.id) });
  } catch (e) {
    next(e);
  }
});

export default router;
