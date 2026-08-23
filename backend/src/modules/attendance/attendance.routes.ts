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

const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;
const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

router.get(
  "/summary",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true },
      });
      const termId = activeTerm?.id;
      const where = termId ? { termId } : {};

      const dayRecords = await prisma.attendanceRecord.findMany({
        where,
        orderBy: { date: "desc" },
        select: { date: true, status: true },
      });

      const byDay = new Map<string, { present: number; total: number }>();
      for (const r of dayRecords) {
        const key = r.date.toISOString().slice(0, 10);
        if (!byDay.has(key)) byDay.set(key, { present: 0, total: 0 });
        const agg = byDay.get(key)!;
        agg.total += 1;
        if (r.status === "present") agg.present += 1;
      }
      const dayKeys = [...byDay.keys()].slice(0, 5).reverse();

      const trend = dayKeys.map((key) => {
        const agg = byDay.get(key)!;
        const d = new Date(key + "T00:00:00Z");
        const day = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
        return { day, present: agg.present, total: agg.total };
      });

      const records = await prisma.attendanceRecord.findMany({
        where,
        select: {
          status: true,
          student: { select: { gradeLevel: true } },
        },
      });

      const gradeAgg: Record<string, { present: number; total: number }> = {};
      for (const r of records) {
        const grade = r.student.gradeLevel;
        if (!gradeAgg[grade]) gradeAgg[grade] = { present: 0, total: 0 };
        gradeAgg[grade].total += 1;
        if (r.status === "present") gradeAgg[grade].present += 1;
      }

      const grades = GRADE_ORDER.filter((g) => gradeAgg[g]).map((g) => ({
        grade: GRADE_LABEL[g],
        present: gradeAgg[g].present,
        total: gradeAgg[g].total,
      }));

      res.json({ trend, grades });
    } catch (e) {
      next(e);
    }
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
