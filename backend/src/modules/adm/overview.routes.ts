import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { scopedTermRow } from "../../lib/termScope.js";
import { getDashboard, getMyCases } from "../../services/adm/overview.service.js";

const router = Router();

router.get(
  "/dashboard",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm", "adm-overview", "overview"] }),
  async (_req, res, next) => {
    try {
      res.json(await getDashboard());
    } catch (e) {
      next(e);
    }
  }
);

// Teacher-scoped ADM cases (read-only): only ADM cases from referrals the
// teacher filed themselves, newest first. Status-only — stage labels,
// eligibility, principal-approval flag and evidence counts only; never
// certification details, recommendation text, meeting minutes, or home-visit
// notes.
router.get(
  "/my-cases",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  cache({
    tags: [
      "adm",
      "adm-case",
      "adm-referrals",
      "teacher",
      "teacher-adm-cases",
      "overview",
    ],
  }),
  async (req, res, next) => {
    try {
      // Server-paginated + server-searched: ?q=&page=&pageSize= (legacy
      // ?limit=). Legacy callers with no params keep the bare-array shape.
      const qRaw = req.query as Record<string, unknown>;
      const hasPaginationParams =
        typeof qRaw.q !== "undefined" ||
        typeof qRaw.page !== "undefined" ||
        typeof qRaw.pageSize !== "undefined" ||
        typeof qRaw.limit !== "undefined" ||
        typeof qRaw.highlight !== "undefined";
      const page = Math.max(1, Number(qRaw.page) || 1);
      const limitRaw =
        typeof qRaw.pageSize !== "undefined" ? Number(qRaw.pageSize) : Number(qRaw.limit);
      const pageSize =
        !Number.isFinite(limitRaw) || limitRaw <= 0
          ? 15
          : Math.min(Math.floor(limitRaw), 100);
      const q =
        typeof qRaw.q === "string" ? qRaw.q.trim().toLowerCase() : "";
      const highlightRaw = qRaw.highlight;
      const highlight =
        typeof highlightRaw === "string" && highlightRaw.trim()
          ? highlightRaw.trim()
          : "";
      const termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id ?? null;
      res.json(
        await getMyCases(
          { userId: req.user!.id, role: req.user!.role, termId },
          { q, page, pageSize, highlight, hasPaginationParams },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
