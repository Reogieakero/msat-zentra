import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { resolveActiveTermId } from "../../services/risk.js";
import {
  getEngineBreakdown,
  listQueue,
  listStaff,
} from "../../services/interventions/queues.service.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "guidance-interventions", "interventions"] }),
  async (req, res, next) => {
    try {
      const levelFilter =
        req.query.level === "Moderate" || req.query.level === "All"
          ? String(req.query.level)
          : "High";
      const factorFilter =
        req.query.factor === "Academic" ||
        req.query.factor === "Attendance" ||
        req.query.factor === "Behavioral"
          ? (req.query.factor as "Academic" | "Attendance" | "Behavioral")
          : null;
      const mineOnly = req.query.mine === "true";
      const outcomeFilter =
        req.query.outcome === "ongoing" ||
        req.query.outcome === "resolved" ||
        req.query.outcome === "unresolved" ||
        req.query.outcome === "all"
          ? String(req.query.outcome)
          : "";
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const qRaw = req.query as Record<string, unknown>;
      const rawSize =
        typeof qRaw.pageSize !== "undefined" ? Number(qRaw.pageSize) : Number(qRaw.limit);
      const pageSize =
        !Number.isFinite(rawSize) || rawSize <= 0
          ? 15
          : Math.min(Math.floor(rawSize), 100);
      res.json(
        await listQueue(
          { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
          {
            level: levelFilter,
            factor: factorFilter,
            mineOnly,
            outcome: outcomeFilter,
            q,
            page,
            pageSize,
          },
          req.termScope ?? undefined,
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/staff",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "staff"] }),
  async (_req, res, next) => {
    try {
      res.json(await listStaff());
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/engine",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      const studentId =
        typeof req.query.studentId === "string" && req.query.studentId
          ? req.query.studentId
          : null;
      const rosterId =
        typeof req.query.rosterId === "string" && req.query.rosterId
          ? req.query.rosterId
          : null;
      const termId = await resolveActiveTermId(req);
      res.json(await getEngineBreakdown({ studentId, rosterId, termId }));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
