import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
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
  cache({ tags: ["guidance", "adm"] }),
  async (req, res, next) => {
    try {
      const validStages = new Set(ADM_STAGE_FLOW.map((s) => s.stage));
      const stageFilter =
        typeof req.query.stage === "string" &&
        validStages.has(req.query.stage as (typeof ADM_STAGE_FLOW)[number]["stage"])
          ? (req.query.stage as string)
          : "";
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(req.query.page) || 1);
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
