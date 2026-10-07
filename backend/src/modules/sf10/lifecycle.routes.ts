import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import {
  getOcrResult,
  listVersions,
  releaseRecord,
  validateRecord,
  verifyRecord,
} from "../../services/sf10/records.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string } }) {
  return { userId: req.user!.id, role: req.user!.role };
}

router.get(
  "/:id/versions",
  requireAuth,
  requireRole("principal", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      res.json(await listVersions(String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/ocr/:jobId",
  requireAuth,
  requireRole("adviser"),
  async (req, res, next) => {
    try {
      res.json(await getOcrResult(String(req.params.jobId)));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/verify",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const updated = await verifyRecord(ctxOf(req), String(req.params.id));
      await invalidateTags(["registrar-sf10", "registrar-overview"]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/validate",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const updated = await validateRecord(ctxOf(req), String(req.params.id));
      await invalidateTags(["registrar", "registrar-sf10", "registrar-overview", "overview", "principal"]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/release",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const updated = await releaseRecord(ctxOf(req), String(req.params.id));
      await invalidateTags(["registrar", "registrar-sf10", "registrar-overview", "overview", "principal"]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
