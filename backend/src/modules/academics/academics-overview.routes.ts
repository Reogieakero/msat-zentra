import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { getAcademicsSummary } from "./academics.service.js";
import { getLiveHonorRoll } from "./honor-roll-live.service.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"], ttl: 900 }),
  async (req, res, next) => {
    try {
      const mode = req.query.mode === "raw" ? "raw" : "final";
      const scope = req.termScope;
      const summary = await getAcademicsSummary(mode, {
        schoolYearId: scope?.schoolYearId ?? null,
        termId: scope?.termId ?? null,
      });
      res.json(summary);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/honor-roll-live",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"], ttl: 120 }),
  async (req, res, next) => {
    try {
      const scope = req.termScope;
      const result = await getLiveHonorRoll({
        schoolYearId: scope?.schoolYearId ?? null,
        termId: scope?.termId ?? null,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.get("/school-years", requireAuth, async (_req, res, next) => {
  try {
    const now = Date.now();
    const years = await prisma.schoolYear.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        startDate: true,
        endDate: true,
        terms: {
          orderBy: { termNumber: "asc" },
          select: { id: true, termNumber: true, startDate: true, endDate: true },
        },
      },
    });
    res.json({
      schoolYears: years.map((y) => ({
        id: y.id,
        name: y.name,
        isActive: y.isActive,
        isCurrent:
          new Date(y.startDate).getTime() <= now && now <= new Date(y.endDate).getTime(),
        startDate: y.startDate,
        endDate: y.endDate,
        terms: y.terms,
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
