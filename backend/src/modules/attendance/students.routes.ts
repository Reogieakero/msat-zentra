import { Router } from "express";
import { requireAuth, requireOwnershipOrRole, requireRole } from "../../middleware/auth.js";
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
      const sharedOnly =
        req.query.sharedOnly === "true" || req.query.sharedOnly === "1";
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
          sharedOnly,
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
  requireOwnershipOrRole(
    async (req) => String(String(req.params.id)),
    "principal",
    "adviser",
    "subject_teacher",
    "guidance_counselor",
    "nurse",
  ),
  async (req, res, next) => {
    try {
      const termId = req.termScope?.termId ?? undefined;
      res.json(await getStudentAttendanceRate(String(req.params.id), termId));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/students/:id/subject-rate",
  requireAuth,
  requireOwnershipOrRole(
    async (req) => String(String(req.params.id)),
    "principal",
    "adviser",
    "subject_teacher",
    "guidance_counselor",
    "nurse",
  ),
  async (req, res, next) => {
    try {
      const termId = req.termScope?.termId ?? undefined;
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
