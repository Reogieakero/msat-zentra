import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  exportAuditCsv,
  getSourceProjection,
  listAudit,
} from "../../services/audit/audit.service.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const {
        actionType,
        sourceTable,
        userId,
        actorRole,
        from,
        to,
        q,
        page = "1",
        pageSize = "20",
      } = req.query as Record<string, string | undefined>;
      res.json(
        await listAudit({
          actionType,
          sourceTable,
          userId,
          actorRole,
          from,
          to,
          q,
          page,
          pageSize,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/export",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const { actionType, sourceTable, userId, actorRole, from, to, q } =
        req.query as Record<string, string | undefined>;
      const csv = await exportAuditCsv({
        actionType,
        sourceTable,
        userId,
        actorRole,
        from,
        to,
        q,
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="audit-log.csv"');
      res.send(csv);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/source",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const projection = await getSourceProjection(String(req.params.id));
      if (!projection) {
        res.status(404).json({ error: "Audit entry not found" });
        return;
      }
      res.json(projection);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
