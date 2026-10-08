import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { scopedYearId } from "../../lib/termScope.js";
import { roleGradeBand } from "../registry/registry.repository.js";
import { REGISTRAR_IDENTITY } from "../../services/registry/registry.types.js";
import {
  registryPhotoSchema,
  registryProfileSchema,
} from "../registry/registry.schemas.js";
import { getOverview } from "../../services/registry/overview.service.js";
import { listFinalGrades } from "../../services/registry/finals.service.js";
import {
  buildRegistrarBreakdown,
  getAccountBreakdown,
  getAccountsAudit,
  listBandStudents,
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
  return {
    userId: req.user!.id,
    role: req.user!.role,
    band: roleGradeBand(req.user?.role),
  };
}

router.get(
  "/overview",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "registrar-overview", "overview"] }),
  async (req, res, next) => {
    try {
      const schoolYearId = req.termScope?.schoolYearId ?? null;
      res.json(
        await getOverview(ctxOf(req), { attachTake: 15, missingTake: 15, pendingTake: 15, bareTake: 15 }, schoolYearId),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/final-grades",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "registrar-finals", "registrar-overview", "academics", "overview"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 15, 1), 100);
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
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "registrar-accounts", "accounts"] }),
  async (req, res, next) => {
    try {
      const schoolYearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      const { roster, statusByLrn, profilesWithoutRoster } = await getAccountBreakdown(
        ctxOf(req),
        { schoolYearId },
      );
      res.json({ data: buildRegistrarBreakdown(roster, statusByLrn, profilesWithoutRoster) });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/adviser-access-requests",
  requireAuth,
  requireRole("registrar"),
  cache({ tags: ["registrar", "registrar-access", "adviser-access"] }),
  async (req, res, next) => {
    try {
      const statusFilter = req.query.status ? String(req.query.status) : undefined;
      res.json(
        await listAccessRequests({ band: ctxOf(req).band, scope: "section", status: statusFilter }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/adviser-access-requests/:id/records",
  requireAuth,
  requireRole("registrar"),
  async (req, res, next) => {
    try {
      res.json(
        await getAccessRecords({
          requestId: String(req.params.id),
          band: ctxOf(req).band,
          enforceBand: false,
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
  requireRole("registrar"),
  (req, res, next) => {
    decideAccessRequest(req, res, next, true).catch(next);
  }
);

router.post(
  "/adviser-access-requests/:id/deny",
  requireAuth,
  requireRole("registrar"),
  (req, res, next) => {
    decideAccessRequest(req, res, next, false).catch(next);
  }
);

async function decideAccessRequest(req: any, res: any, next: any, approved: boolean) {
  try {

    const id = String(req.query.id ?? req.params.id);
    const result = await decideAccess(ctxOf(req), {
      requestId: id,
      approved,
      denyReason: (req.body as { reason?: string })?.reason,
      enforceBand: false,
      denyDefault: "Denied by registrar",
    });
    await invalidateTags(["registrar", "registrar-access", "registrar-overview", "adviser-access", "overview"]);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

router.get(
  "/students",
  requireAuth,
  requireRole("registrar"),
  async (req, res, next) => {
    try {
      res.json(await listBandStudents(ctxOf(req).band));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/accounts-audit",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "15"), 10) || 15, 1), 50);
      res.json(await getAccountsAudit({ band: ctxOf(req).band, page, pageSize }));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("registrar"),
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
  requireRole("registrar"),
  validate("body", registryProfileSchema),
  async (req, res, next) => {
    try {
      const { fullName, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      const result = await updateProfileSettings(ctxOf(req), REGISTRAR_IDENTITY, {
        fullName,
        primaryColor,
        secondaryColor,
      });
      await invalidateTags(["registrar", "registrar-overview", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/settings/photo",
  requireAuth,
  requireRole("registrar"),
  validate("body", registryPhotoSchema),
  async (req, res, next) => {
    try {
      const { photoUrl } = req.body as { photoUrl: string };
      const result = await updateProfilePhoto(ctxOf(req), REGISTRAR_IDENTITY, photoUrl);
      await invalidateTags(["registrar", "registrar-overview", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
