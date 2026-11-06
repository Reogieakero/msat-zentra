import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { paginationQuerySchema } from "../../lib/pagination.js";
import {
  exportAuditCsv,
  getSourceProjection,
  listAudit,
} from "../../services/audit/audit.service.js";

const router = Router();

const auditQuerySchema = paginationQuerySchema().extend({
  actionType: z.string().trim().max(80).optional(),
  sourceTable: z.string().trim().max(80).optional(),
  userId: z.string().trim().max(120).optional(),
  actorRole: z.string().trim().max(60).optional(),
  from: z.string().trim().max(30).optional(),
  to: z.string().trim().max(30).optional(),
});

router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  validate("query", auditQuerySchema),
  cache({ tags: [CACHE_TAGS.audit], ttl: CACHE_TTLS.list }),
  etag(),
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
        page,
        pageSize,
      } = req.query as Record<string, string | number | undefined>;
      res.json(
        await listAudit({
          actionType: actionType == null ? undefined : String(actionType),
          sourceTable: sourceTable == null ? undefined : String(sourceTable),
          userId: userId == null ? undefined : String(userId),
          actorRole: actorRole == null ? undefined : String(actorRole),
          from: from == null ? undefined : String(from),
          to: to == null ? undefined : String(to),
          q: q == null ? undefined : String(q),
          page: String(page ?? "1"),
          pageSize: String(pageSize ?? "15"),
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
