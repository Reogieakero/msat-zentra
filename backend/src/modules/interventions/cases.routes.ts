import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { INTERVENTION_WRITE_TAGS } from "./interventions.repository.js";
import {
  assignSchema,
  outcomeSchema,
  reviewSchema,
  startSchema,
} from "./interventions.schemas.js";
import {
  assignIntervention,
  recordOutcome,
  reviewIntervention,
  startIntervention,
} from "../../services/interventions/cases.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string }; termScope?: { termId: string } | null }) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
  };
}

router.post(
  "/start",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", startSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        studentId?: string;
        rosterId?: string;
        recommendedAction: string;
        priority: "low" | "normal" | "high";
        intakeNotes?: string;
        firstSession?: { scheduledAt: string; sessionType: string; venue?: string };
      };
      const termId = await resolveActiveTermId(req);
      const created = await startIntervention(ctxOf(req), {
        studentId: body.studentId,
        rosterId: body.rosterId,
        recommendedAction: body.recommendedAction,
        priority: body.priority,
        intakeNotes: body.intakeNotes,
        firstSession: body.firstSession,
      }, termId);
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/review",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", reviewSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        decision: "approved" | "rejected" | "modified";
        recommendedAction?: string;
      };
      const updated = await reviewIntervention(ctxOf(req), String(req.params.id), {
        decision: body.decision,
        recommendedAction: body.recommendedAction,
      });
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/assign",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", assignSchema),
  async (req, res, next) => {
    try {
      const assigneeId: string | null = (req.body as { assigneeId: string | null }).assigneeId || null;
      const updated = await assignIntervention(ctxOf(req), String(req.params.id), assigneeId);
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/outcome",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", outcomeSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        outcomeStatus: "ongoing" | "resolved" | "unresolved";
        outcomeNotes?: string;
      };
      const updated = await recordOutcome(
        ctxOf(req),
        String(req.params.id),
        { outcomeStatus: body.outcomeStatus, outcomeNotes: body.outcomeNotes },
        () => resolveActiveTermId(req),
      );
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
