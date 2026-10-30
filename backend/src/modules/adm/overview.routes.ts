import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { admMyCasesQuerySchema } from "./adm.schemas.js";
import { scopedTermRow } from "../../lib/termScope.js";
import { getDashboard, getMyCases } from "../../services/adm/overview.service.js";

const router = Router();

router.get(
  "/dashboard",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: [CACHE_TAGS.adm, CACHE_TAGS.overview], ttl: CACHE_TTLS.dashboard }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(await getDashboard(req.user!.role));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/my-cases",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  cache({
    tags: [
      "adm",
      "adm-case",
      "adm-referrals",
      "teacher",
      "teacher-adm-cases",
      "overview",
    ],
    ttl: CACHE_TTLS.list,
  }),
  etag(),
  validate("query", admMyCasesQuerySchema),
  async (req, res, next) => {
    try {

      const qRaw = req.query as Record<string, unknown>;
      const hasPaginationParams =
        typeof qRaw.q !== "undefined" ||
        typeof qRaw.page !== "undefined" ||
        typeof qRaw.pageSize !== "undefined" ||
        typeof qRaw.limit !== "undefined" ||
        typeof qRaw.highlight !== "undefined";
      const page = Math.max(1, Number(qRaw.page) || 1);
      const limitRaw =
        typeof qRaw.pageSize !== "undefined" ? Number(qRaw.pageSize) : Number(qRaw.limit);
      const pageSize =
        !Number.isFinite(limitRaw) || limitRaw <= 0
          ? 15
          : Math.min(Math.floor(limitRaw), 15);
      const q =
        typeof qRaw.q === "string" ? qRaw.q.trim().toLowerCase() : "";
      const highlightRaw = qRaw.highlight;
      const highlight =
        typeof highlightRaw === "string" && highlightRaw.trim()
          ? highlightRaw.trim()
          : "";
      const termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id ?? null;
      res.json(
        await getMyCases(
          { userId: req.user!.id, role: req.user!.role, termId },
          { q, page, pageSize, highlight, hasPaginationParams },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
