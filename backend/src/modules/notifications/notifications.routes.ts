import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const where: any = { userId: req.user!.id };
    if (req.query.type) where.type = String(req.query.type);
    const notes = await prisma.notification.findMany({
      where, orderBy: { createdAt: "desc" }, take: 50,
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
