import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import {
  getCases,
  type ReferralStatusFilter,
} from "../../services/guidance/cases.service.js";

const router = Router();

router.get(
  "/referrals",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "referrals"] }),
  async (req, res, next) => {
    try {
      const statusFilter =
        req.query.status === "pending" ||
        req.query.status === "in_progress" ||
        req.query.status === "resolved" ||
        req.query.status === "escalated" ||
        req.query.status === "follow_up" ||
        req.query.status === "info_requested" ||
        req.query.status === "dismissed"
          ? (req.query.status as ReferralStatusFilter)
          : null;
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

      const typeFilter =
        req.query.type === "adm" || req.query.type === "counseling"
          ? (req.query.type as "adm" | "counseling")
          : null;

      const bookedFilter = req.query.booked === "1";
      const completedFilter = req.query.completed === "1";
      const openFilter = req.query.open === "1";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);

      const scopeTermId = req.termScope?.termId ?? null;
      const highlightRaw = req.query.highlight;
      const highlight =
        typeof highlightRaw === "string" && highlightRaw.trim()
          ? highlightRaw.trim()
          : "";
      res.json(
        await getCases(
          { userId: req.user!.id, role: req.user!.role, termId: scopeTermId, schoolYearId: null },
          {
            statusFilter,
            q,
            typeFilter,
            bookedFilter,
            completedFilter,
            openFilter,
            page,
            pageSize,
            highlight,
          },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
