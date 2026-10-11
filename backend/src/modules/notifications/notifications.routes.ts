import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { MAX_PAGE_SIZE, PAGE_SIZE } from "../../lib/pagination.js";

const router = Router();

const notificationsQuerySchema = z.object({
  type: z.string().trim().max(80).optional(),
  unreadOnly: z.enum(["0", "1", "true", "false"]).optional(),
  since: z.string().trim().max(30).optional(),
  take: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(PAGE_SIZE),
});

router.get(
  "/",
  requireAuth,
  validate("query", notificationsQuerySchema),
  cache({ tags: [CACHE_TAGS.notifications], ttl: CACHE_TTLS.dashboard }),
  etag(),
  async (req, res, next) => {
  try {
    const q = req.query as Record<string, unknown>;
    const where: any = { userId: req.user!.id };
    if (typeof q.type === "string" && q.type) where.type = q.type;

    if (q.unreadOnly === "1" || q.unreadOnly === "true") {
      where.isRead = false;
    }
    if (typeof q.since === "string" && q.since.trim()) {
      const since = new Date(q.since.trim());
      if (!Number.isNaN(since.getTime())) where.createdAt = { gt: since };
    }
    // Paginated slice (15/page); legacy `take` (≤50) preserved for badge polls.
    const rawTake = Number(q.take);
    const pageSize = Math.max(1, Math.min(Number(q.pageSize) || PAGE_SIZE, MAX_PAGE_SIZE));
    const take =
      Number.isFinite(rawTake) && rawTake > 0 ? Math.min(Math.floor(rawTake), 50) : pageSize;
    const page = Math.max(1, Number(q.page) || 1);
    const skip = (page - 1) * take;
    const notes = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        type: true,
        message: true,
        isRead: true,
        createdAt: true,
        sourceTable: true,
        sourceId: true,
      },
    });
    res.json(notes);
  } catch (e) { next(e); }
});

router.post("/read/:id", requireAuth, async (req, res, next) => {
  try {
    const note = await prisma.notification.findUnique({ where: { id: String(req.params.id) } });
    if (!note || note.userId !== req.user!.id) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
    const updated = await prisma.notification.update({ where: { id: note.id }, data: { isRead: true } });
    res.json(updated);
  } catch (e) { next(e); }
});

router.post("/read-all", requireAuth, async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ updated: result.count });
  } catch (e) { next(e); }
});

export default router;
