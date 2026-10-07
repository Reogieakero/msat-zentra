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

// Record Keeper overview (G7–G10 authority only).
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

// Record Keeper final-grade viewer (G7–10). View-only role in the grade pipeline.
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

// Record Keeper account breakdown (G7–10 band only). Live from the database.
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

// Record Keeper accounts audit (G7–10 band only). No cache — live state.
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

// Record Keeper adviser SF10 access requests (G7–10 band only).
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

// SF10 records for the advisees of a given access request (record-keeper G7–10).
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

// Decide (approve or deny) an adviser SF10 access request (record-keeper G7–10).
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

// GET /api/record-keeper/settings/profile — own display name, photo, palette.
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

// PATCH /api/record-keeper/settings/profile — display name + workspace palette.
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

// POST /api/record-keeper/settings/photo — profile photo upload (JSON data URL).
// PNG/JPEG/GIF/WebP only, 2MB cap so rows stay lean.
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
