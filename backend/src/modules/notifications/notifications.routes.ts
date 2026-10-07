import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const where: any = { userId: req.user!.id };
    if (req.query.type) where.type = String(req.query.type);
    // Lightweight poll support: the desk realtime polls only need fresh
    // rows. `?unreadOnly=1` skips already-read inbox history and `?take=N`
    // caps the payload (default 50, max 100); `?since=ISO` returns rows
    // created after the timestamp. Legacy callers without params keep the
    // exact previous shape (latest 50, read + unread).
    if (req.query.unreadOnly === "1" || req.query.unreadOnly === "true") {
      where.isRead = false;
    }
    if (typeof req.query.since === "string" && req.query.since.trim()) {
      const since = new Date(req.query.since.trim());
      if (!Number.isNaN(since.getTime())) where.createdAt = { gt: since };
    }
    const rawTake = Number(req.query.take);
    const take =
      Number.isFinite(rawTake) && rawTake > 0
        ? Math.min(Math.floor(rawTake), 100)
        : 50;
    const notes = await prisma.notification.findMany({
      where, orderBy: { createdAt: "desc" }, take,
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
