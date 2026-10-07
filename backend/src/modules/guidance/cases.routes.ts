import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import {
  getCases,
  type ReferralStatusFilter,
} from "../../services/guidance/cases.service.js";

const router = Router();

// Guidance Counselor referrals: every behavior / incident report an adviser
// routed to guidance_counselor, newest filing first. Status-only plus the
// referrer's reason and the linked anecdotal category/date — the full
// write-up itself is opened through the case file, never listed here.
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
      // Case type: "ADM" needs ADM action (already moving toward the ADM
      // coordinator via escalation); anything else is regular guidance
      // counseling handled on this desk.
      const typeFilter =
        req.query.type === "adm" || req.query.type === "counseling"
          ? (req.query.type as "adm" | "counseling")
          : null;
      // Session/open gates for the action menus (same one-active-session
      // semantics as the nurse desk; "open" = not resolved or dismissed).
      const bookedFilter = req.query.booked === "1";
      const completedFilter = req.query.completed === "1";
      const openFilter = req.query.open === "1";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);
      // Term-scoped: prior-term cases never leak into the active term queue.
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
