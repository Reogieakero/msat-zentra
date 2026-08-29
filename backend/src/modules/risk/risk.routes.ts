import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  evaluateRisk,
  resolveActiveTermId,
} from "../../services/risk.js";
import { getRiskBoard } from "./riskBoard.service.js";
import { getLowRiskStudents } from "./lowRiskStudents.service.js";
import {
  getRiskHeatmap,
  getSectionFactorStudents,
  type RiskFactor,
} from "./riskHeatmap.service.js";
import { getRiskStudents } from "./riskStudents.service.js";
import { getInterventionStudents } from "./interventions.service.js";

const router = Router();

// Principal board overview (O4): KPIs, level distribution, factor totals, trend.
router.get(
  "/board",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const gradeMode =
        req.query.gradeMode === "raw" || req.query.gradeMode === "final"
          ? (req.query.gradeMode as "raw" | "final")
          : "final";
      const board = await getRiskBoard(gradeMode);
      res.json(board);
    } catch (e) {
      next(e);
    }
  }
);

// Principal: paginated low-risk student list (LRN + name only).
router.get(
  "/low-risk-students",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 15));
      const result = await getLowRiskStudents(page, pageSize);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Principal: full at-risk student list with status-only factors (O1). Optional
// `section` filter (section name) for the heatmap drill-down.
router.get(
  "/students",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 1000));
      const section =
        typeof req.query.section === "string" ? req.query.section : undefined;
      const gradeMode =
        req.query.gradeMode === "raw" || req.query.gradeMode === "final"
          ? (req.query.gradeMode as "raw" | "final")
          : "final";
      const result = await getRiskStudents(page, pageSize, section, gradeMode);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

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

// Principal board heat map: all sections × risk-factor counts (O4, status-only).
router.get(
  "/heatmap",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId();
      if (!termId) {
        return res.status(404).json({ error: { code: "NO_ACTIVE_TERM", message: "No active term" } });
      }
      const gradeMode =
        req.query.gradeMode === "raw" || req.query.gradeMode === "final"
          ? (req.query.gradeMode as "raw" | "final")
          : "final";
      const heatmap = await getRiskHeatmap(termId, gradeMode);
      res.json(heatmap);
    } catch (e) {
      next(e);
    }
  }
);

// Per section × factor at-risk student list (principal only).
router.get(
  "/sections/:id/students",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const termId = typeof req.query.termId === "string" ? req.query.termId : null;
      const factor = req.query.factor as RiskFactor | undefined;
      const gradeMode =
        req.query.gradeMode === "raw" || req.query.gradeMode === "final"
          ? (req.query.gradeMode as "raw" | "final")
          : "final";
      if (!termId) {
        return res.status(400).json({ error: { code: "MISSING_TERM", message: "termId query required" } });
      }
      if (!factor || !["Academic", "Attendance", "Behavioral"].includes(factor)) {
        return res.status(400).json({ error: { code: "MISSING_FACTOR", message: "factor query required" } });
      }
      const students = await getSectionFactorStudents(
        String(req.params.id),
        factor,
        termId,
        gradeMode
      );
      res.json({ sectionId: String(req.params.id), termId, factor, students });
    } catch (e) {
      next(e);
    }
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
      // attendance: students with < 80% present, measured against the section's
      // enrolled headcount (consistent with the Attendance system).
      const enrolled = students.length;
      const attByStudent = new Map<string, { present: number }>();
      for (const a of attendance) {
        const cur = attByStudent.get(a.studentId) ?? { present: 0 };
        if (a.status === "present") cur.present++;
        attByStudent.set(a.studentId, cur);
      }
      for (const [, v] of attByStudent) if (enrolled > 0 && v.present / enrolled < 0.8) factors.attendance++;
      res.json({ sectionId: String(req.params.id), termId, factors });
    } catch (e) { next(e); }
  }
);

// Principal: staff directory for intervention assignment (all staff roles).
router.get(
  "/staff",
  requireAuth,
  requireRole("principal"),
  async (_req, res, next) => {
    try {
      const staff = await prisma.user.findMany({
        where: {
          role: {
            in: [
              "subject_teacher",
              "adviser",
              "nurse",
              "adm_coordinator",
              "guidance_counselor",
              "record_keeper",
              "registrar",
            ],
          },
        },
        select: { id: true, fullName: true, role: true },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      });
      res.json(staff);
    } catch (e) {
      next(e);
    }
  }
);

// Principal: at-risk students (RiskSnapshot) for the active term, each with
// their current intervention link. This is the principal's intervention queue.
router.get(
  "/interventions",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const riskLevel =
        typeof req.query.riskLevel === "string"
          ? (req.query.riskLevel as "Low" | "Moderate" | "High")
          : undefined;
      const hasIntervention =
        typeof req.query.hasIntervention === "string"
          ? req.query.hasIntervention === "true"
          : undefined;
      const factor =
        typeof req.query.factor === "string"
          ? (req.query.factor as "Academic" | "Attendance" | "Behavioral")
          : undefined;
      const gradeMode =
        typeof req.query.gradeMode === "string" &&
        (req.query.gradeMode === "raw" || req.query.gradeMode === "final")
          ? (req.query.gradeMode as "raw" | "final")
          : undefined;
      const result = await getInterventionStudents({
        riskLevel,
        hasIntervention,
        factor,
        gradeMode,
        page,
        pageSize,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Interventions are auto-created by the risk engine (recomputeRisk) and assigned to
// the Guidance Counselor. The Principal has read-only visibility (list + detail) — no
// create/assign/approve/edit endpoints are exposed. The guidance_counselor owns the
// lifecycle (outcome updates) via their own role-guarded routes if/when added.

export default router;
