import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { guidanceAnecdotalQuerySchema } from "./guidance.schemas.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import {
  getAnecdotal,
  type AnecdotalCategory,
} from "../../services/guidance/anecdotal.service.js";

const router = Router();

router.get(
  "/anecdotal",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("query", guidanceAnecdotalQuerySchema),
  cache({ tags: [CACHE_TAGS.guidance, "anecdotal"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const categoryFilter =
        query.category === "behavioral" ||
        query.category === "bullying" ||
        query.category === "academic" ||
        query.category === "attendance" ||
        query.category === "health"
          ? (query.category as AnecdotalCategory)
          : null;
      const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
      const anecdotalTypeFilter =
        query.type === "adm" || query.type === "counseling" ? query.type : null;
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);

      const scopeTermId = req.termScope?.termId ?? null;

      const docsOnly = query.docs === "1";
      res.json(
        await getAnecdotal(
          { userId: req.user!.id, role: req.user!.role, termId: scopeTermId, schoolYearId: null },
          {
            categoryFilter,
            q,
            anecdotalTypeFilter,
            docsOnly,
            page,
            pageSize,
          },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
