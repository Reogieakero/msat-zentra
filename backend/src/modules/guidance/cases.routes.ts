import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { guidanceCasesQuerySchema } from "./guidance.schemas.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import {
  getCases,
  type ReferralStatusFilter,
} from "../../services/guidance/cases.service.js";

const router = Router();

router.get(
  "/referrals",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("query", guidanceCasesQuerySchema),
  cache({ tags: [CACHE_TAGS.guidance, CACHE_TAGS.referrals], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const statusFilter =
        query.status === "pending" ||
        query.status === "in_progress" ||
        query.status === "resolved" ||
        query.status === "escalated" ||
        query.status === "follow_up" ||
        query.status === "info_requested" ||
        query.status === "dismissed"
          ? (query.status as ReferralStatusFilter)
          : null;
      const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";

      const typeFilter =
        query.type === "adm" || query.type === "counseling" ? query.type : null;

      const bookedFilter = query.booked === "1";
      const completedFilter = query.completed === "1";
      const openFilter = query.open === "1";
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);

      const scopeTermId = req.termScope?.termId ?? null;
      const highlightRaw = query.highlight;
      const highlight =
        typeof highlightRaw === "string" && highlightRaw.trim() ? highlightRaw.trim() : "";
      res.json(
        await getCases(
          { userId: req.user!.id, role: req.user!.role, termId: scopeTermId, schoolYearId: null },
          {
            statusFilter,
            q,
            typeFilter,
            bookedFilter,
            completedFilter,
            openFilter,
            page,
            pageSize,
            highlight,
          },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
