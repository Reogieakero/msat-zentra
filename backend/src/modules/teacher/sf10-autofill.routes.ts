import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import {
  getPreview,
  listCandidates,
  runAutofill,
} from "../../services/advisory/sf10-autofill.service.js";

const router = Router();

const previewSchema = z.object({
  sectionId: z.string().trim().min(1).max(64),
  // Comma-separated LRNs keep the URL simple; POST bodies use a real array.
  studentLrns: z.string().trim().min(1).max(7000),
});

const runSchema = z.object({
  sectionId: z.string().trim().min(1).max(64),
  studentLrns: z.array(z.string().trim().min(1).max(32)).min(1).max(200),
});

router.get(
  "/sf10-autofill/candidates",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  cache({ tags: [CACHE_TAGS.teacher, "adviser-access"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId.trim() : "";
      if (!sectionId) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "sectionId is required" } });
        return;
      }
      res.json(await listCandidates(req.user!.id, sectionId));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/sf10-autofill/preview",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("query", previewSchema),
  cache({ tags: [CACHE_TAGS.teacher, "adviser-access"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as { sectionId: string; studentLrns: string };
      const lrns = query.studentLrns.split(",");
      res.json(await getPreview(req.user!.id, query.sectionId, lrns));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/sf10-autofill",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", runSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { sectionId: string; studentLrns: string[] };
      const result = await runAutofill(
        { userId: req.user!.id, role: req.user!.role },
        body.sectionId,
        body.studentLrns,
      );
      // Same desk tags the SF10 record routes bust after a write.
      await invalidateTags([
        "teacher",
        "adviser-access",
        "registrar",
        "registrar-sf10",
        "registrar-overview",
        "record-keeper",
        "overview",
        "principal",
      ]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
