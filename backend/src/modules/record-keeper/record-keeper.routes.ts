import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { scopedYearId } from "../../lib/termScope.js";
import {
  GRADE_BAND_7_10,
} from "../registry/registry.repository.js";
import { RECORD_KEEPER_IDENTITY } from "../../services/registry/registry.types.js";
import {
  registryPhotoSchema,
  registryProfileSchema,
} from "../registry/registry.schemas.js";
import { getOverview } from "../../services/registry/overview.service.js";
import { listFinalGrades } from "../../services/registry/finals.service.js";
import {
  buildRecordKeeperBreakdown,
  getAccountBreakdown,
  getAccountsAudit,
} from "../../services/registry/accounts.service.js";
import {
  decideAccess,
  getAccessRecords,
  listAccessRequests,
} from "../../services/registry/access.service.js";
import {
  readProfileSettings,
  updateProfilePhoto,
  updateProfileSettings,
} from "../../services/registry/settings.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string } }) {
  return { userId: req.user!.id, role: req.user!.role, band: GRADE_BAND_7_10 };
}

router.get(
  "/overview",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "overview"] }),
  async (req, res, next) => {
    try {
      const schoolYearId = req.termScope?.schoolYearId ?? null;
      res.json(await getOverview(ctxOf(req), { attachTake: 100 }, schoolYearId));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/final-grades",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics", "overview"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 100);
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      res.json(await listFinalGrades(ctxOf(req), { page, pageSize, q }));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/account-breakdown",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "accounts"] }),
  async (req, res, next) => {
    try {
      const schoolYearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      const { roster, statusByLrn } = await getAccountBreakdown(ctxOf(req), { schoolYearId });
      res.json({ data: await buildRecordKeeperBreakdown(GRADE_BAND_7_10, roster, statusByLrn) });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/accounts-audit",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "10"), 10) || 10, 1), 50);
      res.json(await getAccountsAudit({ band: GRADE_BAND_7_10, page, pageSize }));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/adviser-access-requests",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "adviser-access"] }),
  async (req, res, next) => {
    try {
      const statusFilter = req.query.status ? String(req.query.status) : undefined;
      res.json(
        await listAccessRequests({ band: GRADE_BAND_7_10, scope: "request", status: statusFilter }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/adviser-access-requests/:id/records",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      res.json(
        await getAccessRecords({
          requestId: String(req.params.id),
          band: GRADE_BAND_7_10,
          enforceBand: true,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/adviser-access-requests/:id/approve",
  requireAuth,
  requireRole("record_keeper"),
  (req, res, next) => {
    decideAccessRequestRK(req, res, next, true).catch(next);
  }
);

router.post(
  "/adviser-access-requests/:id/deny",
  requireAuth,
  requireRole("record_keeper"),
  (req, res, next) => {
    decideAccessRequestRK(req, res, next, false).catch(next);
  }
);

async function decideAccessRequestRK(req: any, res: any, next: any, approved: boolean) {
  try {
    const result = await decideAccess(ctxOf(req), {
      requestId: String(req.params.id),
      approved,
      denyReason: (req.body as { reason?: string })?.reason,
      enforceBand: true,
      denyDefault: "Denied by record keeper",
    });
    await invalidateTags(["record-keeper", "record-keeper-access", "record-keeper-overview", "adviser-access", "overview"]);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      res.json(await readProfileSettings(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/settings/profile",
  requireAuth,
  requireRole("record_keeper"),
  validate("body", registryProfileSchema),
  async (req, res, next) => {
    try {
      const { fullName, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      const result = await updateProfileSettings(ctxOf(req), RECORD_KEEPER_IDENTITY, {
        fullName,
        primaryColor,
        secondaryColor,
      });
      await invalidateTags(["record-keeper", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/settings/photo",
  requireAuth,
  requireRole("record_keeper"),
  validate("body", registryPhotoSchema),
  async (req, res, next) => {
    try {
      const { photoUrl } = req.body as { photoUrl: string };
      const result = await updateProfilePhoto(ctxOf(req), RECORD_KEEPER_IDENTITY, photoUrl);
      await invalidateTags(["record-keeper", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
