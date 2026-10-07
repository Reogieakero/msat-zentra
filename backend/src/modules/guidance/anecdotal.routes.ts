import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import {
  getAnecdotal,
  type AnecdotalCategory,
} from "../../services/guidance/anecdotal.service.js";

const router = Router();

// Guidance Counselor anecdotal records: ONLY filings an adviser referred to
// guidance_counselor — guidance can never browse the raw anecdotal table.
// Metadata only (category, observer, dates, confidentiality tier, referral
// state). Write-up content stays behind the case-file detail endpoint.
router.get(
  "/anecdotal",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "anecdotal"] }),
  async (req, res, next) => {
    try {
      const categoryFilter =
        req.query.category === "behavioral" ||
        req.query.category === "bullying" ||
        req.query.category === "academic" ||
        req.query.category === "attendance" ||
        req.query.category === "health"
          ? (req.query.category as AnecdotalCategory)
          : null;
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const anecdotalTypeFilter =
        req.query.type === "adm" || req.query.type === "counseling"
          ? (req.query.type as "adm" | "counseling")
          : null;
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);
      // Term-scoped: prior-term filings never leak into the active term view.
      const scopeTermId = req.termScope?.termId ?? null;
      // Session-documents view: only filings whose sessions carry filed
      // images (the hasDocs facet lives server-side so pages stay dense).
      const docsOnly = req.query.docs === "1";
      res.json(
        await getAnecdotal(
          { userId: req.user!.id, role: req.user!.role, termId: scopeTermId, schoolYearId: null },
          {
            categoryFilter,
            q,
            anecdotalTypeFilter,
            docsOnly,
            page,
            pageSize,
          },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
