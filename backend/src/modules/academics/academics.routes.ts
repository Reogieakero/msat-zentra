import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { getAcademicsSummary } from "./academics.service.js";

const router = Router();

// Principal academics KPIs (O4): section summaries, pass/fail by grade, honor roll.
// ?mode=raw includes every graded row (locked or not); ?mode=final (default)
// restricts to locked/finalized grades only.
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  // Heavy, unpaginated compute (every student + every subject grade, plus
  // live risk/honor-roll). Grades only change through the Registrar write
  // routes, which invalidate the "academics" tag, so a longer TTL is safe and
  // avoids a cold recompute on every principal navigation.
  cache({ tags: ["academics", "principal"], ttl: 900 }),
  async (req, res, next) => {
    try {
      const mode = req.query.mode === "raw" ? "raw" : "final";
      const summary = await getAcademicsSummary(mode);
      res.json(summary);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
