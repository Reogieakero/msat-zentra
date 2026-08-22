import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { computeAttendanceRate } from "../../services/attendance.js";
import { recomputeRisk } from "../../services/risk.js";

const router = Router();

const bulkSchema = z.object({
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  date: z.string().datetime(),
  session: z.enum(["AM", "PM"]),
  records: z.array(z.object({ studentId: z.string().min(1), status: z.enum(["present", "absent", "late", "excused"]) })).min(1),
});
router.post(
  "/bulk",
  requireAuth,
  requireRole("adviser"),
  validate("body", bulkSchema),
  async (req, res, next) => {
    try {
      const { sectionId, termId, date, session, records } = req.body;
      const parsedDate = new Date(date);
      const created = await prisma.$transaction(
        records.map((r: any) =>
          prisma.attendanceRecord.upsert({
            where: { studentId_date_session: { studentId: r.studentId, date: parsedDate, session } },
            create: { studentId: r.studentId, sectionId, termId, date: parsedDate, session, status: r.status, recordedBy: req.user!.id },
            update: { status: r.status, sectionId, recordedBy: req.user!.id },
          })
        )
      );
      for (const r of records) await recomputeRisk(r.studentId, termId);
      res.status(201).json({ count: created.length });
    } catch (e) { next(e); }
  }
);

router.get(
  "/students/:id/attendance-rate",
  requireAuth,
  async (req, res, next) => {
    try {
      const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      if (!termId) throw new AppError(400, "MISSING_TERM", "termId query required");
      const rate = await computeAttendanceRate(String(req.params.id), termId);
      res.json(rate);
    } catch (e) { next(e); }
  }
);

export default router;
