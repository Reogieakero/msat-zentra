import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const where: any = {};
      if (req.query.actionType) where.actionType = String(req.query.actionType);
      if (req.query.sourceTable) where.sourceTable = String(req.query.sourceTable);
      if (req.query.userId) where.userId = String(req.query.userId);
      const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
      res.json(logs);
    } catch (e) { next(e); }
  }
);

export default router;
