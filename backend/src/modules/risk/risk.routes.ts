import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { evaluateRisk } from "../../services/risk.js";

const router = Router();

// Student/parent: limited projection only (O1) — risk_level + behavioral flag.
router.get(
  "/students/:id",
  requireAuth,
  async (req, res, next) => {
    try {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: String(req.params.id) },
        select: { riskLevel: true, riskCount: true, lrn: true },
      });
      if (!profile) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found" } });
      const isSelf = req.user!.id === String(req.params.id);
      const isPrincipal = req.user!.role === "principal";
      const isStaff = ["adviser", "guidance_counselor", "nurse", "adm_coordinator"].includes(req.user!.role);
      if (!isSelf && !isPrincipal && !isStaff) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Limited view only" } });
      }
      const limited = { lrn: profile.lrn, riskLevel: profile.riskLevel };
      res.json(limited);
    } catch (e) { next(e); }
  }
);

// Section heat map: section × risk_factor counts (no student identities).
router.get(
  "/sections/:id/heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      if (!termId) return res.status(400).json({ error: { code: "MISSING_TERM", message: "termId query required" } });
      const students = await prisma.studentProfile.findMany({
        where: { sectionId: String(req.params.id) },
        select: { userId: true },
      });
      const ids = students.map((s) => s.userId);
      const [anecdotals, finals, attendance] = await Promise.all([
        prisma.anecdotalRecord.groupBy({ by: ["studentId"], where: { sectionId: String(req.params.id), termId }, _count: true }),
        prisma.finalGrade.findMany({ where: { studentId: { in: ids }, termId }, select: { studentId: true, transmutedGrade: true } }),
        prisma.attendanceRecord.findMany({ where: { sectionId: String(req.params.id), termId }, select: { studentId: true, status: true } }),
      ]);
      const factors = { attendance: 0, grades: 0, behavior: 0, wellbeing: 0 };
      // behavior
      factors.behavior = anecdotals.length;
      // grades: students with any subject < 75
      const lowGradeStudents = new Set(finals.filter((f) => (f.transmutedGrade ?? 100) < 75).map((f) => f.studentId));
      factors.grades = lowGradeStudents.size;
      // attendance: students with < 80% present
      const attByStudent = new Map<string, { present: number; total: number }>();
      for (const a of attendance) {
        const cur = attByStudent.get(a.studentId) ?? { present: 0, total: 0 };
        cur.total++; if (a.status === "present") cur.present++;
        attByStudent.set(a.studentId, cur);
      }
      for (const [, v] of attByStudent) if (v.total > 0 && v.present / v.total < 0.8) factors.attendance++;
      res.json({ sectionId: String(req.params.id), termId, factors });
    } catch (e) { next(e); }
  }
);

export default router;
