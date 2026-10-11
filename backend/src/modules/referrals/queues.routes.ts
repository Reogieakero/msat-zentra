import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TTLS } from "../../lib/cacheTags.js";
import { referralsMineQuerySchema, referralsQueueQuerySchema } from "./referrals.schemas.js";
import { NURSE_CACHE_TAGS, resolveQueuePageSize } from "./referrals.repository.js";
import { listMine, listQueue } from "../../services/referrals/queues.service.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("query", referralsQueueQuerySchema),
  cache({
    tags: [
      "referrals",
      "alerts",
      "overview",
      "guidance",
      "adm",
      "teacher",
      ...NURSE_CACHE_TAGS,
    ],
    ttl: CACHE_TTLS.list,
  }),
  etag(),
  async (req, res, next) => {
    try {

      const qRaw = req.query as Record<string, unknown>;
      const hasPaginationParams =
        typeof qRaw.q !== "undefined" ||
        typeof qRaw.page !== "undefined" ||
        typeof qRaw.pageSize !== "undefined" ||
        typeof qRaw.limit !== "undefined" ||
        typeof qRaw.track !== "undefined" ||
        typeof qRaw.status !== "undefined" ||
        typeof qRaw.highlight !== "undefined";
      const page = Math.max(1, Number(qRaw.page) || 1);
      const pageSize = resolveQueuePageSize(req);
      const q =
        typeof qRaw.q === "string" ? qRaw.q.trim().toLowerCase() : "";
      const trackRaw = qRaw.track;
      const track = typeof trackRaw === "string" ? trackRaw.trim().toLowerCase() : "";
      const statusRaw = qRaw.status;
      const status = typeof statusRaw === "string" && statusRaw.trim() ? statusRaw : "";
      const highlightRaw = qRaw.highlight;
      const highlight =
        typeof highlightRaw === "string" && highlightRaw.trim()
          ? highlightRaw.trim()
          : "";
      res.json(
        await listQueue(
          { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
          { hasPaginationParams, page, pageSize, q, track, status, highlight },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/mine",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("query", referralsMineQuerySchema),
  cache({
    tags: [
      "referrals",
      "alerts",
      "overview",
      "guidance",
      "adm",
      "teacher",
      "teacher-referrals",
    ],
    ttl: CACHE_TTLS.list,
  }),
  etag(),
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
      const pageSize = resolveQueuePageSize(req);
      const q =
        typeof qRaw.q === "string" ? qRaw.q.trim().toLowerCase() : "";
      const highlight =
        typeof qRaw.highlight === "string" && qRaw.highlight.trim()
          ? qRaw.highlight.trim()
          : "";
      res.json(
        await listMine(
          { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
          { hasPaginationParams, page, pageSize, q, highlight },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
