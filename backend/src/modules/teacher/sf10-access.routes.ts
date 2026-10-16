import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import {
  createAccessRequest,
  getMyVerification,
  listMyRequests,
} from "../../services/advisory/sf10-access.service.js";

const router = Router();

const createSchema = z.object({
  sectionId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(1).max(500),
  studentLrns: z.array(z.string().trim().min(1).max(32)).max(200).optional(),
});

router.get(
  "/sf10-access-requests",
  requireAuth,
  // Any teacher with an advisory section may request (role can be
  // subject_teacher with a claim — ownership is enforced in the service).
  requireRole(...TEACHER_ROLES),
  cache({ tags: [CACHE_TAGS.teacher, "adviser-access"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(await listMyRequests(req.user!.id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/sf10-access-requests",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", createSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { sectionId: string; reason: string; studentLrns?: string[] };
      const result = await createAccessRequest(
        req.user!.id,
        body.sectionId,
        body.reason,
        body.studentLrns,
      );
      await invalidateTags([
        "adviser-access",
        "registrar",
        "registrar-access",
        "record-keeper",
        "record-keeper-access",
        "teacher",
      ]);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/sf10-access-requests/:id/records",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  cache({ tags: [CACHE_TAGS.teacher, "adviser-access"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(await getMyVerification(req.user!.id, String(req.params.id)));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
