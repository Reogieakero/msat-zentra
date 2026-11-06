import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { validate } from "../../middleware/validate.js";
import { resolvePageSize } from "./adm.repository.js";
import { admDevicesQuerySchema, deviceIssueSchema, deviceReturnSchema } from "./adm.schemas.js";
import { issueDevice, listDevices, returnDevice } from "../../services/adm/devices.service.js";

const router = Router();

const ADM_TAG_GROUP = ["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"];

router.post(
  "/devices/issue",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", deviceIssueSchema),
  async (req, res, next) => {
    try {
      const device = await issueDevice(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        {
          admLearnerProfileId: req.body.admLearnerProfileId as string,
          deviceType: req.body.deviceType as string,
          deviceSerial: req.body.deviceSerial as string,
          issuedDate: req.body.issuedDate as string | undefined,
          conditionNotes: req.body.conditionNotes as string | undefined,
        },
      );
      res.status(201).json(device);

      void invalidateTags(ADM_TAG_GROUP);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/devices/:id/return",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", deviceReturnSchema),
  async (req, res, next) => {
    try {
      const updated = await returnDevice(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.id),
        req.body.returnedDate as string | undefined,
      );
      res.json(updated);

      void invalidateTags(ADM_TAG_GROUP);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/devices",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  validate("query", admDevicesQuerySchema),
  cache({ tags: [CACHE_TAGS.adm, CACHE_TAGS.admDevices, CACHE_TAGS.overview], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const q = typeof query.q === "string" && query.q.trim() ? query.q.trim() : "";
      const statusParam =
        typeof query.status === "string" && query.status.trim() ? query.status.trim() : "";

      const hasPaging =
        typeof query.page !== "undefined" ||
        typeof query.pageSize !== "undefined" ||
        typeof query.limit !== "undefined";
      const limit = hasPaging ? resolvePageSize(req) : 0;
      const page = Math.max(1, Number(query.page) || 1);
      const orderOldest = query.order === "oldest";
      res.json(await listDevices({ q, statusParam, hasPaging, limit, page, orderOldest }));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
