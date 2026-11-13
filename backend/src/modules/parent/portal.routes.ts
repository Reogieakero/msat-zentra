import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { resolveActiveTermId } from "../../lib/term-resolve.js";
import { validate } from "../../middleware/validate.js";
import { studentModulesQuerySchema } from "../student/modules.schemas.js";
import type { ModuleStatus } from "../teacher/advisory-modules.schemas.js";
import {
  assertLearnerAccess,
  listLearnerTerms,
  listLinkedChildren,
  loadPortalLearner,
  resolvePortalTerm,
} from "../../lib/portalAccess.js";
import {
  getLearnerAttendance,
  getLearnerGrades,
  getLearnerHome,
  getLearnerModules,
  getLearnerSchedule,
  getUpcomingSessions,
} from "../../services/portal/learnerData.service.js";

const router = Router();

function termIdOf(req: { query: Record<string, unknown> }): string | undefined {
  const raw = req.query.termId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

async function termFor(req: { query: Record<string, unknown> }) {
  return resolvePortalTerm(termIdOf(req), await resolveActiveTermId());
}

/** Resolve + authorize the child in one step for every child-scoped route. */
async function childOf(req: Request) {
  const studentId = String(req.params.studentId);
  await assertLearnerAccess(
    { id: req.user!.id, role: req.user!.role },
    studentId,
  );
  return { studentId, learner: await loadPortalLearner(studentId) };
}

router.use(requireAuth, requireRole("parent"));

router.get("/me", async (req, res, next) => {
  try {
    res.json({ children: await listLinkedChildren(req.user!.id) });
  } catch (e) {
    next(e);
  }
});

router.get("/children", async (req, res, next) => {
  try {
    res.json({ children: await listLinkedChildren(req.user!.id) });
  } catch (e) {
    next(e);
  }
});

router.get("/children/:studentId/terms", async (req, res, next) => {
  try {
    const { studentId } = await childOf(req);
    const activeTermId = await resolveActiveTermId();
    res.json({ terms: await listLearnerTerms(studentId, activeTermId), activeTermId });
  } catch (e) {
    next(e);
  }
});

router.get("/children/:studentId/home", async (req, res, next) => {
  try {
    const { studentId, learner } = await childOf(req);
    const term = await termFor(req);
    res.json(await getLearnerHome(studentId, learner, term));
  } catch (e) {
    next(e);
  }
});

router.get("/children/:studentId/grades", async (req, res, next) => {
  try {
    const { studentId } = await childOf(req);
    res.json(await getLearnerGrades(studentId, await termFor(req)));
  } catch (e) {
    next(e);
  }
});

router.get("/children/:studentId/attendance", async (req, res, next) => {
  try {
    const { studentId } = await childOf(req);
    res.json(await getLearnerAttendance(studentId, await termFor(req)));
  } catch (e) {
    next(e);
  }
});

router.get("/children/:studentId/schedule", async (req, res, next) => {
  try {
    const { studentId } = await childOf(req);
    res.json(await getLearnerSchedule(studentId, await termFor(req)));
  } catch (e) {
    next(e);
  }
});

router.get("/children/:studentId/modules", validate("query", studentModulesQuerySchema), async (req, res, next) => {
  try {
    const { studentId } = await childOf(req);
    const { page, pageSize, status } = req.query as unknown as {
      page: number; pageSize: number; status?: ModuleStatus;
    };
    res.json(await getLearnerModules(studentId, { page, pageSize, status }));
  } catch (e) {
    next(e);
  }
});

router.get("/children/:studentId/sessions", async (req, res, next) => {
  try {
    const { studentId } = await childOf(req);
    res.json({ sessions: await getUpcomingSessions(studentId) });
  } catch (e) {
    next(e);
  }
});

export default router;
