import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  computeAttendanceRate,
  buildDayAxis,
  countSchoolDays,
  formatDateKey,
  isWeekendKey,
  groupSectionDay,
  dailyPresentPercent,
  avgPresentPercent,
  below80Days,
  attendanceTrend,
  type DayAgg,
} from "../../services/attendance.js";
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
      const session: "AM" | "PM" | undefined =
        req.query.session === "AM" || req.query.session === "PM"
          ? (req.query.session as "AM" | "PM")
          : undefined;

      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true },
      });
      const termId = activeTerm?.id;
      // Real-time date axis: the last 5 school days (Mon–Fri) ending today.
      // Anchored to the current date so the panel always shows today even when
      // no attendance record has been submitted yet for the most recent day.
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      const dayKeys: string[] = [];
      for (let d = new Date(today); dayKeys.length < 5; d.setUTCDate(d.getUTCDate() - 1)) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) dayKeys.push(d.toISOString().slice(0, 10));
      }
      dayKeys.reverse();

      const where = {
        ...(termId ? { termId } : {}),
        ...(session ? { session } : {}),
        date: { gte: new Date(dayKeys[0] + "T00:00:00Z") },
      };

      const records = await prisma.attendanceRecord.findMany({
        where,
        select: {
          date: true,
          status: true,
          student: { select: { gradeLevel: true } },
        },
      });

      const byDay = new Map<string, { present: number; total: number }>();
      const gradeDayAgg: Record<string, Map<string, { present: number; total: number }>> = {};
      const gradeTermAgg: Record<string, { present: number; total: number }> = {};
      for (const r of records) {
        const key = r.date.toISOString().slice(0, 10);

        if (!byDay.has(key)) byDay.set(key, { present: 0, total: 0 });
        const agg = byDay.get(key)!;
        agg.total += 1;
        if (r.status === "present") agg.present += 1;

        const grade = r.student.gradeLevel;
        if (!gradeDayAgg[grade]) gradeDayAgg[grade] = new Map();
        if (!gradeDayAgg[grade].has(key)) gradeDayAgg[grade].set(key, { present: 0, total: 0 });
        const gAgg = gradeDayAgg[grade].get(key)!;
        gAgg.total += 1;
        if (r.status === "present") gAgg.present += 1;

        if (!gradeTermAgg[grade]) gradeTermAgg[grade] = { present: 0, total: 0 };
        gradeTermAgg[grade].total += 1;
        if (r.status === "present") gradeTermAgg[grade].present += 1;
      }

      const trend = dayKeys.map((key) => {
        const agg = byDay.get(key) ?? { present: 0, total: 0 };
        const d = new Date(key + "T00:00:00Z");
        const day = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
        return { day, present: agg.present, total: agg.total };
      });

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

      res.json({ session: session ?? "ALL", trend, grades });
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

      // Continuous date axis: term start -> today (shared engine).
      const dayKeys = buildDayAxis(activeTerm?.startDate);
      const schoolDays = countSchoolDays(dayKeys);

      const records = await prisma.attendanceRecord.findMany({
        where: { termId, session },
        select: {
          sectionId: true,
          date: true,
          status: true,
        },
      });

      // Aggregation + formatting all come from the generic engine so every
      // attendance surface uses the same date axis, weekend handling, and
      // present/late/excused/absent accounting.
      const dayStatus = groupSectionDay(records);

      const result = sections.map((s) => {
        const statusMap = dayStatus[s.id] ?? new Map();
        const total = enrolledBySection[s.id] ?? 0;
        return {
          sectionId: s.id,
          section: `Grade ${s.name}`,
          gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
          enrolled: total,
          days: dayKeys.map((key) => {
            const cell = statusMap.get(key);
            const present = cell?.present ?? 0;
            const late = cell?.late ?? 0;
            const excused = cell?.excused ?? 0;
            const accounted = present + late + excused;
            const absent = Math.max(0, total - accounted);
            return {
              date: formatDateKey(key),
              isoDate: key,
              present,
              late,
              absent,
              excused,
              total,
              isWeekend: isWeekendKey(key),
              // Canonical daily present ratio (present ÷ headcount), 0..100.
              ratio: dailyPresentPercent(present, total),
            };
          }),
        };
      });

      res.json({ session, sections: result, schoolDays });
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
      const selectedSectionId =
        typeof req.query.sectionId === "string" && req.query.sectionId.length > 0
          ? req.query.sectionId
          : undefined;
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
      const totalEnrolled = Object.values(enrolledBySection).reduce((a, b) => a + b, 0);

      // Shared engine: date axis + weekday count from the single source of truth.
      const dayKeys = buildDayAxis(activeTerm?.startDate);
      const schoolDays = countSchoolDays(dayKeys);

      const sectionIds = sections.map((s) => s.id);
      const raw = await prisma.attendanceRecord.findMany({
        where: { termId, sectionId: { in: sectionIds } },
        select: { sectionId: true, date: true, session: true, status: true },
      });

      // Aggregate all records per section/day, then the selected session's ones.
      const all = groupSectionDay(raw);
      const sessionMap =
        session === "PM"
          ? groupSectionDay(raw.filter((r) => r.session === "PM"))
          : groupSectionDay(raw.filter((r) => r.session === "AM"));

      const result = sections.map((s) => {
        const enrolled = enrolledBySection[s.id] ?? 0;
        const sm = all[s.id];
        const amMap = groupSectionDay(raw.filter((r) => r.sectionId === s.id && r.session === "AM"))[s.id];
        const pmMap = groupSectionDay(raw.filter((r) => r.sectionId === s.id && r.session === "PM"))[s.id];
        const days: DayAgg[] = dayKeys.map((k) => sm?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });
        const amDays: DayAgg[] = dayKeys.map((k) => amMap?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });
        const pmDays: DayAgg[] = dayKeys.map((k) => pmMap?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });

        return {
          sectionId: s.id,
          section: `Grade ${s.name}`,
          gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
          enrolled,
          // Canonical attendance % — average present per day ÷ headcount (0..100).
          rate: avgPresentPercent(days, enrolled, schoolDays),
          belowDays: below80Days(days, enrolled),
          amRate: avgPresentPercent(amDays, enrolled, schoolDays),
          pmRate: avgPresentPercent(pmDays, enrolled, schoolDays),
          trend: attendanceTrend(days, enrolled),
        };
      });

      // Daily attendance % trend (present ÷ the relevant headcount, 0..100) for
      // the selected session. Section-wide when a section is selected, otherwise
      // the whole school. Matches the heatblocks' present ÷ headcount ratio.
      const trend: { date: string; rate: number }[] = dayKeys.map((key) => {
        let present = 0;
        const headcount = selectedSectionId
          ? (enrolledBySection[selectedSectionId] ?? 0)
          : totalEnrolled;
        if (selectedSectionId) {
          present = sessionMap[selectedSectionId]?.get(key)?.present ?? 0;
        } else {
          for (const sectionId of Object.keys(sessionMap)) {
            present += sessionMap[sectionId].get(key)?.present ?? 0;
          }
        }
        return {
          date: formatDateKey(key),
          rate: dailyPresentPercent(present, headcount),
        };
      });

      res.json({ sections: result, trend, schoolDays, totalEnrolled });
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
      // through today. Same engine as the section stats so the denominators
      // (schoolDays) never disagree between the overview and the roster.
      const totalSchoolDays = countSchoolDays(buildDayAxis(activeTerm?.startDate));

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

// School-wide AM/PM attendance pattern for the active term: overall AM/PM
// present rate plus the average present rate per weekday. Powers the "Patterns"
// overlay on the risk heatmaps index. Derived from real attendance records.
router.get(
  "/session-pattern",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true, startDate: true },
      });
      const termId = activeTerm?.id;
      if (!termId) {
        res.json({ amRate: 0, pmRate: 0, byDay: [] });
        return;
      }

      const start = activeTerm?.startDate
        ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
        : null;
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      const axisStart = start ?? today;
      const dayKeys: string[] = [];
      for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        dayKeys.push(d.toISOString().slice(0, 10));
      }

      const sections = await prisma.section.findMany({
        where: { schoolYear: { isActive: true } },
        select: { id: true, students: { select: { userId: true } } },
      });
      const enrolledBySection: Record<string, number> = {};
      for (const s of sections) enrolledBySection[s.id] = s.students.length;
      const totalEnrolled = Object.values(enrolledBySection).reduce((a, b) => a + b, 0);

      const records = await prisma.attendanceRecord.findMany({
        where: { termId },
        select: { sectionId: true, date: true, session: true, status: true },
      });

      type Cell = { present: number; total: number };
      const am: Record<string, Cell> = {};
      const pm: Record<string, Cell> = {};
      const byWeekday: Record<number, { present: number; total: number }> = {};
      for (const r of records) {
        const key = r.date.toISOString().slice(0, 10);
        const target = r.session === "AM" ? am : r.session === "PM" ? pm : null;
        if (target) {
          if (!target[key]) target[key] = { present: 0, total: 0 };
          target[key].total += 1;
          if (r.status === "present") target[key].present += 1;
        }
        const wd = new Date(key + "T00:00:00Z").getUTCDay();
        if (wd === 0 || wd === 6) continue;
        if (!byWeekday[wd]) byWeekday[wd] = { present: 0, total: 0 };
        byWeekday[wd].total += 1;
        if (r.status === "present") byWeekday[wd].present += 1;
      }

      const expected = totalEnrolled * dayKeys.length;
      const amPresent = Object.values(am).reduce((a, c) => a + c.present, 0);
      const pmPresent = Object.values(pm).reduce((a, c) => a + c.present, 0);
      const amRate = expected > 0 ? Math.round((amPresent / expected) * 1000) / 10 : 0;
      const pmRate = expected > 0 ? Math.round((pmPresent / expected) * 1000) / 10 : 0;

      const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const byDay = DAY_NAMES.map((day, i) => {
        const wd = i + 1;
        const cell = byWeekday[wd] ?? { present: 0, total: 0 };
        return {
          day,
          rate: cell.total > 0 ? Math.round((cell.present / cell.total) * 1000) / 10 : 0,
        };
      });

      res.json({ amRate, pmRate, byDay });
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
