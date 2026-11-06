import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { interventionsQueueQuerySchema, INTERVENTIONS_QUEUE_MAX_PAGE_SIZE } from "./interventions.schemas.js";
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
  validate("query", interventionsQueueQuerySchema),
  cache({ tags: [CACHE_TAGS.guidance, "guidance-interventions", CACHE_TAGS.interventions], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const levelFilter =
        query.level === "Moderate" || query.level === "All" ? String(query.level) : "High";
      const factorFilter =
        query.factor === "Academic" || query.factor === "Attendance" || query.factor === "Behavioral"
          ? (query.factor as "Academic" | "Attendance" | "Behavioral")
          : null;
      const mineOnly = query.mine === "true";
      const outcomeFilter =
        query.outcome === "ongoing" || query.outcome === "resolved" || query.outcome === "unresolved" || query.outcome === "all"
          ? String(query.outcome)
          : "";
      const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.max(
        1,
        Math.min(Number(query.pageSize) || INTERVENTIONS_QUEUE_MAX_PAGE_SIZE, INTERVENTIONS_QUEUE_MAX_PAGE_SIZE),
      );
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
  cache({ tags: [CACHE_TAGS.guidance, "staff"], ttl: CACHE_TTLS.lookup }),
  etag(),
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
