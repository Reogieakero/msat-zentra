import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { resolvePageSize } from "./adm.repository.js";
import { deviceIssueSchema, deviceReturnSchema } from "./adm.schemas.js";
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
  cache({ tags: ["adm", "adm-devices", "adm-overview"] }),
  async (req, res, next) => {
    try {
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim()
          : "";
      const statusParam =
        typeof req.query.status === "string" && req.query.status.trim()
          ? req.query.status.trim()
          : "";

      const hasPaging =
        typeof req.query.page !== "undefined" ||
        typeof req.query.pageSize !== "undefined" ||
        typeof req.query.limit !== "undefined";
      const limit = hasPaging ? resolvePageSize(req) : 0;
      const page = Math.max(1, Number(req.query.page) || 1);
      const orderOldest = req.query.order === "oldest";
      res.json(await listDevices({ q, statusParam, hasPaging, limit, page, orderOldest }));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
