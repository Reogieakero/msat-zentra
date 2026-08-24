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

// Attendance heat map: per-grade, per-day present/total rates split by AM/PM session.
router.get(
  "/heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const statusFilter =
        req.query.status === "late" ||
        req.query.status === "absent" ||
        req.query.status === "excused"
          ? (req.query.status as "late" | "absent" | "excused")
          : "present";
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true, startDate: true },
      });
      const termId = activeTerm?.id;
      const where = { session, ...(termId ? { termId } : {}) };

      const records = await prisma.attendanceRecord.findMany({
        where,
        include: { student: { select: { gradeLevel: true } } },
        orderBy: { date: "asc" },
      });

      // Authoritative denominator: number of enrolled students per year level.
      const enrolledByGrade: Record<string, number> = {};
      const enrollCounts = await prisma.studentProfile.groupBy({
        by: ["gradeLevel"],
        _count: { _all: true },
      });
      for (const e of enrollCounts) enrolledByGrade[e.gradeLevel] = e._count._all;

      // Build a continuous date axis from the term start date to today so every
      // grade card shows the same number of blocks aligned to the same dates.
      const start = activeTerm?.startDate
        ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
        : null;
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      const axisStart = start ?? records[0]?.date ?? today;
      const dayKeys: string[] = [];
      for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        dayKeys.push(d.toISOString().slice(0, 10));
      }

      // Count non-absent records per grade/day. Absent is derived so every
      // enrolled student is accounted for even when a record was never submitted.
      const gradeDayStatus: Record<string, Map<string, { present: number; late: number; excused: number }>> = {};
      for (const r of records) {
        const grade = r.student.gradeLevel;
        const key = r.date.toISOString().slice(0, 10);
        if (!gradeDayStatus[grade]) gradeDayStatus[grade] = new Map();
        if (!gradeDayStatus[grade].has(key)) {
          gradeDayStatus[grade].set(key, { present: 0, late: 0, excused: 0 });
        }
        const cell = gradeDayStatus[grade].get(key)!;
        if (r.status === "present") cell.present++;
        else if (r.status === "late") cell.late++;
        else if (r.status === "excused") cell.excused++;
      }

      const grades = GRADE_ORDER.map((grade) => {
        const statusMap = gradeDayStatus[grade] ?? new Map<string, { present: number; late: number; excused: number }>();
        const total = enrolledByGrade[grade] ?? 0;
        return {
          grade: GRADE_LABEL[grade],
          enrolled: total,
          days: dayKeys.map((key) => {
            const cell = statusMap.get(key) ?? { present: 0, late: 0, excused: 0 };
            // Absent = enrolled − (present + late + excused); never negative.
            const accounted = cell.present + cell.late + cell.excused;
            const absent = Math.max(0, total - accounted);
            const d = new Date(key + "T00:00:00Z");
            const date = d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            });
            return { date, present: cell.present, late: cell.late, absent, excused: cell.excused, total };
          }),
        };
      });

      res.json({ session, status: statusFilter, grades });
    } catch (e) {
      next(e);
    }
  }
);

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
          date: true,
          status: true,
          student: { select: { gradeLevel: true } },
        },
      });

      const gradeDayAgg: Record<string, Map<string, { present: number; total: number }>> = {};
      const gradeTermAgg: Record<string, { present: number; total: number }> = {};
      for (const r of records) {
        const grade = r.student.gradeLevel;
        const key = r.date.toISOString().slice(0, 10);
        if (!gradeDayAgg[grade]) gradeDayAgg[grade] = new Map();
        if (!gradeDayAgg[grade].has(key)) gradeDayAgg[grade].set(key, { present: 0, total: 0 });
        const agg = gradeDayAgg[grade].get(key)!;
        agg.total += 1;
        if (r.status === "present") agg.present += 1;

        if (!gradeTermAgg[grade]) gradeTermAgg[grade] = { present: 0, total: 0 };
        gradeTermAgg[grade].total += 1;
        if (r.status === "present") gradeTermAgg[grade].present += 1;
      }

      const grades = GRADE_ORDER.filter((g) => gradeTermAgg[g]).map((g) => ({
        grade: GRADE_LABEL[g],
        present: gradeTermAgg[g].present,
        total: gradeTermAgg[g].total,
        days: dayKeys.map((key) => {
          const agg = gradeDayAgg[g]?.get(key) ?? { present: 0, total: 0 };
          const d = new Date(key + "T00:00:00Z");
          const day = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          });
          return { day, present: agg.present, total: agg.total };
        }),
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
