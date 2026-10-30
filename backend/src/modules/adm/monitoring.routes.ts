import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { admModuleUpdateSchema } from "./adm.schemas.js";
import {
  getMonitoredCase,
  updateModule,
  type AdmModuleInput,
} from "../../services/adm/monitoring.service.js";

const router = Router();

const MONITORING_TAGS = [CACHE_TAGS.adm, "adm-case", "teacher", "teacher-adm-cases"];

/**
 * Adviser monitoring desk for one advisee's ADM case. Access is section-scoped
 * inside the service (`Section.adviserId`), so a subject-teacher account that
 * claimed an advisory in settings still resolves correctly.
 */
router.get(
  "/my-cases/:caseId",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  cache({ tags: [...MONITORING_TAGS, CACHE_TAGS.overview], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(await getMonitoredCase(req.user!.id, String(req.params.caseId)));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/my-cases/:caseId/modules/:moduleId",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", admModuleUpdateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateModule(
        req.user!.id,
        String(req.params.caseId),
        String(req.params.moduleId),
        req.body as AdmModuleInput,
      );
      await invalidateTags([...MONITORING_TAGS, CACHE_TAGS.overview]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
