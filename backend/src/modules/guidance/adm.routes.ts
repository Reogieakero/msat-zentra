import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { ADM_STAGE_FLOW } from "../../services/adm.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import { consultReviewSchema } from "./guidance.schemas.js";
import { getAdmQueue } from "../../services/guidance/admQueue.service.js";
import { reviewConsultation } from "../../services/guidance/review.service.js";

const router = Router();

router.get(
  "/adm",
  requireAuth,
  requireRole("guidance_counselor"),
  validate(
    "query",
    paginationQuerySchema().extend({ stage: z.string().trim().max(40).optional() }),
  ),
  cache({ tags: [CACHE_TAGS.guidance, CACHE_TAGS.adm], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const validStages = new Set(ADM_STAGE_FLOW.map((s) => s.stage));
      const stageFilter =
        typeof query.stage === "string" &&
        validStages.has(query.stage as (typeof ADM_STAGE_FLOW)[number]["stage"])
          ? (query.stage as string)
          : "";
      const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);

      const scopeTermId = req.termScope?.termId ?? null;
      const riskTermId = await resolveActiveTermId(req);
      res.json(
        await getAdmQueue(
          { userId: req.user!.id, role: req.user!.role, termId: scopeTermId, schoolYearId: null },
          { stageFilter, q, page, pageSize },
          riskTermId,
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/adm/referrals/:id/review",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", consultReviewSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        recommendation: string;
        outcome: "endorse" | "reject";
        clinicSession?: { scheduledAt?: unknown; sessionType?: unknown; venue?: unknown };
      };
      const updated = await reviewConsultation(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null, schoolYearId: null },
        String(req.params.id),
        {
          recommendation: body.recommendation,
          outcome: body.outcome,
          clinicSession: body.clinicSession,
        },
      );
      await invalidateTags([
        "guidance",
        "overview",
        "alerts",
        "referrals",
        "adm",
        "teacher",
      ]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
