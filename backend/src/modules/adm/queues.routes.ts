import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
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
  cache({ tags: ["adm", "adm-referrals", "adm-overview"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);

      const limit = resolvePageSize(req);
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim().toLowerCase()
          : "";
      const stageParam =
        typeof req.query.stage === "string" && req.query.stage.trim()
          ? req.query.stage.trim()
          : "";
      const eligibilityParam =
        typeof req.query.eligibility === "string" && req.query.eligibility.trim()
          ? req.query.eligibility.trim()
          : "";
      res.json(
        await listAllReferrals(
          { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
          { page, limit, q, stageParam, eligibilityParam },
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
  cache({ tags: ["adm", "adm-approvals", "adm-certifications"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = resolvePageSize(req);
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim()
          : "";
      const activeTerm = await scopedTermRow(req);
      const termId = activeTerm?.id ?? null;
      res.json(
        await listApprovals(
          { userId: req.user!.id, role: req.user!.role, termId },
          { page, limit, q },
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
