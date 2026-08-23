import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// Principal overview KPIs (O4): enrollment, active sections, teachers, anecdotals.
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  async (_req, res, next) => {
    try {
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true },
      });
      const termId = activeTerm?.id;

      const [enrollment, activeSections, teachers, anecdotals] = await Promise.all([
        prisma.studentProfile.count(),
        prisma.section.count({ where: { adviserId: { not: null } } }),
        prisma.staffProfile.count(),
        prisma.anecdotalRecord.count(termId ? { where: { termId } } : undefined),
      ]);

      res.json({
        kpis: { enrollment, activeSections, teachers, anecdotals },
        atRisk: null,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
