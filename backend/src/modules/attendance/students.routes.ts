import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { resolveDisplayTerm } from "./attendance.repository.js";
import {
  getAtRiskStudents,
  getStudentAttendanceRate,
  getStudentSubjectRate,
} from "../../services/attendance/students.service.js";

const router = Router();

function schoolYearOf(req: { termScope?: { schoolYearId: string } | null }) {
  return req.termScope?.schoolYearId ?? null;
}

router.get(
  "/at-risk-students",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const session = (req.query.session === "PM" ? "PM" : "AM") as "AM" | "PM";
      const displayTerm = await resolveDisplayTerm(req);
      if (!displayTerm) {
        res.json({ students: [], schoolDays: 0 });
        return;
      }
      res.json(
        await getAtRiskStudents({
          session,
          schoolYearId: schoolYearOf(req),
          displayTerm,
        }),
      );
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
      res.json(await getStudentAttendanceRate(String(req.params.id), termId));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/students/:id/subject-rate",
  requireAuth,
  async (req, res, next) => {
    try {
      const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      const subjectId =
        typeof req.query.subjectId === "string" && req.query.subjectId.length > 0
          ? req.query.subjectId
          : undefined;
      res.json(await getStudentSubjectRate(String(req.params.id), termId, subjectId));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
