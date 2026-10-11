import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { admApprovalsQuerySchema, admReferralsQuerySchema } from "./adm.schemas.js";
import { scopedTermRow } from "../../lib/termScope.js";
import { resolvePageSize } from "./adm.repository.js";
import {
  getHistory,
  listAllReferrals,
  listApprovals,
  listReferrals,
} from "../../services/adm/queues.service.js";

const router = Router();

router.get(
  "/referrals/all",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  validate("query", admReferralsQuerySchema),
  cache({ tags: [CACHE_TAGS.adm, CACHE_TAGS.referrals, CACHE_TAGS.overview], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const page = Math.max(1, Number(q.page) || 1);
      const limit = resolvePageSize(req);
      const search =
        typeof q.q === "string" && q.q.trim() ? q.q.trim().toLowerCase() : "";
      const stageParam = typeof q.stage === "string" && q.stage.trim() ? q.stage.trim() : "";
      const eligibilityParam =
        typeof q.eligibility === "string" && q.eligibility.trim() ? q.eligibility.trim() : "";
      res.json(
        await listAllReferrals(
          { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
          { page, limit, q: search, stageParam, eligibilityParam },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/approvals",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  validate("query", admApprovalsQuerySchema),
  cache({ tags: [CACHE_TAGS.adm, "adm-approvals", "adm-certifications"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const page = Math.max(1, Number(q.page) || 1);
      const limit = resolvePageSize(req);
      const search = typeof q.q === "string" && q.q.trim() ? q.q.trim() : "";
      const activeTerm = await scopedTermRow(req);
      const termId = activeTerm?.id ?? null;
      res.json(
        await listApprovals(
          { userId: req.user!.id, role: req.user!.role, termId },
          { page, limit, q: search },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/referrals",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm", "adm-referrals"] }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(
        await listReferrals({
          userId: req.user!.id,
          role: req.user!.role,
          termId: req.termScope?.termId ?? null,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/history",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm", "adm-case"] }),
  etag(),
  async (req, res, next) => {
    try {
      const profileId =
        typeof req.query.profileId === "string" && req.query.profileId.trim()
          ? req.query.profileId.trim()
          : null;
      const referralId =
        typeof req.query.referralId === "string" && req.query.referralId.trim()
          ? req.query.referralId.trim()
          : null;
      res.json(await getHistory({ profileId, referralId }));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
