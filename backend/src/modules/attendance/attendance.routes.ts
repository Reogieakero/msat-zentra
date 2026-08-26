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

const GRADE_NUMERIC: Record<string, string> = {
  G7: "7",
  G8: "8",
  G9: "9",
  G10: "10",
  G11: "11",
  G12: "12",
};

// Per-section daily attendance heatblocks for the active term.
// Covers every day from the term start date through today. Absent is derived
// (enrolled − present − late − excused) so all enrolled students are accounted
// for even when a record was never submitted.
router.get(
  "/section-heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";

      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true, startDate: true },
      });
      const termId = activeTerm?.id;
      if (!termId) {
        res.json({ session, sections: [] });
        return;
      }

      const sections = await prisma.section.findMany({
        where: { schoolYear: { isActive: true } },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          students: { select: { userId: true } },
        },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      const enrolledBySection: Record<string, number> = {};
      for (const s of sections) enrolledBySection[s.id] = s.students.length;

      // Continuous date axis: term start -> today.
      const start = activeTerm?.startDate
        ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
        : null;
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      const axisStart = start ?? today;
      const dayKeys: string[] = [];
      for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        dayKeys.push(d.toISOString().slice(0, 10));
      }

      const records = await prisma.attendanceRecord.findMany({
        where: { termId, session },
        select: {
          sectionId: true,
          date: true,
          status: true,
        },
      });

      const dayStatus: Record<
        string,
        Map<string, { present: number; late: number; excused: number }>
      > = {};
      for (const r of records) {
        const key = r.date.toISOString().slice(0, 10);
        if (!dayStatus[r.sectionId]) dayStatus[r.sectionId] = new Map();
        if (!dayStatus[r.sectionId].has(key)) {
          dayStatus[r.sectionId].set(key, { present: 0, late: 0, excused: 0 });
        }
        const cell = dayStatus[r.sectionId].get(key)!;
        if (r.status === "present") cell.present++;
        else if (r.status === "late") cell.late++;
        else if (r.status === "excused") cell.excused++;
      }

      const fmt = (key: string) =>
        new Date(key + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });

      const result = sections.map((s) => {
        const statusMap = dayStatus[s.id] ?? new Map();
        const total = enrolledBySection[s.id] ?? 0;
        return {
          sectionId: s.id,
          section: `Grade ${s.name}`,
          gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
          enrolled: total,
          days: dayKeys.map((key) => {
            const cell = statusMap.get(key) ?? { present: 0, late: 0, excused: 0 };
            const accounted = cell.present + cell.late + cell.excused;
            const absent = Math.max(0, total - accounted);
            return {
              date: fmt(key),
              isoDate: key,
              present: cell.present,
              late: cell.late,
              absent,
              excused: cell.excused,
              total,
            };
          }),
        };
      });

      res.json({ session, sections: result });
    } catch (e) {
      next(e);
    }
  }
);

// Sections for the active school year — id, name, and grade level.
// Powers the "Grades & sections" navigation card on the heatmap pages.
router.get(
  "/sections",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      const where = activeYear ? { schoolYearId: activeYear.id } : {};
      const sections = await prisma.section.findMany({
        where,
        select: { id: true, name: true, gradeLevel: true },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      res.json({
        sections: sections.map((s) => ({
          id: s.id,
          section: `Grade ${s.name}`,
          grade: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// Per-section attendance stats (rate, below-80% days, AM/PM, trend) and the
// school-wide daily attendance trend, for the active term.
router.get(
  "/section-stats",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true, startDate: true },
      });
      const termId = activeTerm?.id;
      if (!termId) {
        res.json({ sections: [], trend: [] });
        return;
      }

      const sections = await prisma.section.findMany({
        where: { schoolYear: { isActive: true } },
        select: { id: true, name: true, gradeLevel: true, students: { select: { userId: true } } },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      const enrolledBySection: Record<string, number> = {};
      for (const s of sections) enrolledBySection[s.id] = s.students.length;

      const start = activeTerm?.startDate
        ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
        : null;
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      const axisStart = start ?? today;
      const dayKeys: string[] = [];
      for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        dayKeys.push(d.toISOString().slice(0, 10));
      }

      const raw = await prisma.attendanceRecord.findMany({
        where: { termId },
        select: { sectionId: true, date: true, session: true, status: true },
      });

      type Cell = { present: number; late: number; excused: number; total: number };
      const buildSessions = () => {
        const map: Record<string, Map<string, Cell>> = {};
        for (const r of raw) {
          const key = r.date.toISOString().slice(0, 10);
          if (!map[r.sectionId]) map[r.sectionId] = new Map();
          if (!map[r.sectionId].has(key)) map[r.sectionId].set(key, { present: 0, late: 0, excused: 0, total: 0 });
          const cell = map[r.sectionId].get(key)!;
          cell.total += 1;
          if (r.status === "present") cell.present++;
          else if (r.status === "late") cell.late++;
          else if (r.status === "excused") cell.excused++;
        }
        return map;
      };
      const all = buildSessions();
      const amMap = new Map<string, Cell>();
      const pmMap = new Map<string, Cell>();
      for (const r of raw) {
        if (r.session !== "AM" && r.session !== "PM") continue;
        const key = r.date.toISOString().slice(0, 10);
        const target = r.session === "AM" ? amMap : pmMap;
        if (!target.has(key)) target.set(key, { present: 0, late: 0, excused: 0, total: 0 });
        const cell = target.get(key)!;
        cell.total += 1;
        if (r.status === "present") cell.present++;
        else if (r.status === "late") cell.late++;
        else if (r.status === "excused") cell.excused++;
      }

      const rateOf = (cell: Cell | undefined, enrolled: number) => {
        if (!cell || cell.total === 0 || enrolled <= 0) return 0;
        return Math.round((cell.present / enrolled) * 1000) / 10;
      };
      const avgOf = (map: Record<string, Map<string, Cell>>, id: string) => {
        const m = map[id];
        if (!m) return 0;
        let p = 0;
        let t = 0;
        for (const c of m.values()) {
          p += c.present;
          t += c.total;
        }
        return t > 0 ? Math.round((p / t) * 1000) / 10 : 0;
      };

      const result = sections.map((s) => {
        const enrolled = enrolledBySection[s.id] ?? 0;
        const sm = all[s.id];
        const days: Cell[] = dayKeys.map((k) => sm?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });
        const present = days.reduce((a, d) => a + d.present, 0);
        const rate = days.length > 0 ? Math.round((present / days.length) * 10) / 10 : 0;
        const belowDays = days.filter((d) => d.total > 0 && enrolled > 0 && d.present / enrolled < 0.8).length;

        const half = Math.floor(days.length / 2);
        const firstHalf = days.slice(0, half);
        const secondHalf = days.slice(half);
        const avgRate = (arr: Cell[]) => {
          const pp = arr.reduce((a, d) => a + d.present, 0);
          const tt = arr.reduce((a, d) => a + d.total, 0);
          return tt > 0 ? (pp / tt) * 100 : 0;
        };
        const diff = avgRate(secondHalf) - avgRate(firstHalf);
        const trend: "up" | "down" | "flat" = diff > 1.5 ? "up" : diff < -1.5 ? "down" : "flat";

        return {
          sectionId: s.id,
          section: `Grade ${s.name}`,
          gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
          enrolled,
          rate,
          belowDays,
          amRate: rateOf(amMap.get(s.id), enrolled),
          pmRate: rateOf(pmMap.get(s.id), enrolled),
          trend,
        };
      });

      // School-wide daily trend: present-student count for the selected session,
      // per day, from the term start to today.
      const sessionMap = session === "PM" ? pmMap : amMap;
      const trend: { date: string; present: number }[] = dayKeys.map((key) => {
        const cell = sessionMap.get(key);
        const d = new Date(key + "T00:00:00Z");
        const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        return { date, present: cell?.present ?? 0 };
      });

      // Counted school days: weekdays (Mon–Fri) from the term start to today.
      const schoolDays = dayKeys.reduce((acc, key) => {
        const wd = new Date(key + "T00:00:00Z").getUTCDay();
        return wd !== 0 && wd !== 6 ? acc + 1 : acc;
      }, 0);

      res.json({ sections: result, trend, schoolDays });
    } catch (e) {
      next(e);
    }
  }
);

// Students in a section with their attendance for the active term.
// Surfaces the roster and per-student present/late/absent/excused counts plus
// an average-present-per-day rate, so the principal can drill into one section.
router.get(
  "/sections/:id/students",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = String(req.params.id);
      const session: "AM" | "PM" = req.query.session === "PM" ? "PM" : "AM";
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true, startDate: true },
      });
      const termId = activeTerm?.id;
      if (!termId) {
        res.json({ sectionId, students: [] });
        return;
      }

      // Total ongoing school days: weekdays (Mon–Fri) from the term start date
      // through today. Weekends are excluded so the denominator reflects actual
      // instruction days, not every calendar day.
      const start = activeTerm?.startDate
        ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
        : null;
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      const axisStart = start ?? today;
      let totalSchoolDays = 0;
      for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) totalSchoolDays += 1;
      }

      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { id: true, name: true, gradeLevel: true },
      });
      if (!section) {
        throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      }

      const students = await prisma.studentProfile.findMany({
        where: { sectionId },
        select: {
          userId: true,
          lrn: true,
          user: { select: { fullName: true } },
          attendanceRecords: {
            where: { termId, session },
            select: { status: true },
          },
        },
        orderBy: { user: { fullName: "asc" } },
      });

      const result = students.map((st) => {
        const counts = { present: 0, late: 0, absent: 0, excused: 0 };
        for (const r of st.attendanceRecords) {
          if (r.status === "present") counts.present++;
          else if (r.status === "late") counts.late++;
          else if (r.status === "absent") counts.absent++;
          else if (r.status === "excused") counts.excused++;
        }
        const total = st.attendanceRecords.length;
        const rate =
          totalSchoolDays > 0
            ? Math.round((counts.present / totalSchoolDays) * 1000) / 10
            : 0;
        return {
          id: st.userId,
          lrn: st.lrn,
          name: st.user.fullName,
          present: counts.present,
          late: counts.late,
          absent: counts.absent,
          excused: counts.excused,
          rate,
        };
      });

      res.json({
        sectionId,
        section: `Grade ${section.name}`,
        gradeLevel: GRADE_NUMERIC[section.gradeLevel] ?? section.gradeLevel,
        schoolDays: totalSchoolDays,
        students: result,
      });
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
