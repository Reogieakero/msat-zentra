import { Router, type Request, type Response } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getRiskBoard, getRiskTrend, getSchoolsForRisk } from "./riskBoard.service.js";
import { getLowRiskStudents } from "./lowRiskStudents.service.js";
import {
  getRiskHeatmap,
  getSectionFactorStudents,
  type RiskFactor,
} from "./riskHeatmap.service.js";
import { getRiskStudents } from "./riskStudents.service.js";
import { getInterventionStudents } from "./interventions.service.js";
import {
  getBatchLevels,
  getSectionFactorCounts,
  getSingleStudentLevel,
} from "../../services/risk/riskLookups.service.js";
import { getRiskStaff } from "../../services/risk/riskStaff.service.js";
import { alertGuidance } from "../../services/risk/riskAlert.service.js";

const router = Router();

type ServiceError = { status: number; code: string; message: string };

function sendLookupResult(
  res: Response,
  next: (e: unknown) => void,
  run: () => Promise<unknown>,
) {
  run()
    .then((result) => res.json(result))
    .catch((e: unknown) => {
      if (e && typeof e === "object" && "status" in e && "code" in e) {
        const se = e as ServiceError;
        res.status(se.status).json({ error: { code: se.code, message: se.message } });
        return;
      }
      next(e);
    });
}

router.get(
  "/board",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (req, res, next) => {
    try {
      const gradeMode =
        req.query.gradeMode === "raw" || req.query.gradeMode === "final"
          ? (req.query.gradeMode as "raw" | "final")
          : "final";
      const board = await getRiskBoard(gradeMode, req.termScope ?? undefined);
      res.json(board);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/school-years",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal", "schoolyear"] }),
  async (_req, res, next) => {
    try {
      res.json(await getSchoolsForRisk());
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/trend",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (req, res, next) => {
    try {
      const schoolYearId =
        typeof req.query.schoolYearId === "string" && req.query.schoolYearId !== ""
          ? req.query.schoolYearId
          : undefined;
      const termId =
        typeof req.query.termId === "string" && req.query.termId !== ""
          ? req.query.termId
          : undefined;
      res.json(await getRiskTrend(schoolYearId, termId));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/low-risk-students",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 15));
      const result = await getLowRiskStudents(page, pageSize, req.termScope ?? undefined);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/students",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);

      const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 50));
      const section =
        typeof req.query.section === "string" ? req.query.section : undefined;
      const gradeMode =
        req.query.gradeMode === "raw" || req.query.gradeMode === "final"
          ? (req.query.gradeMode as "raw" | "final")
          : "final";
      const result = await getRiskStudents(page, pageSize, section, gradeMode, req.termScope ?? undefined);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/students/batch",
  requireAuth,
  (req: Request, res: Response, next: (e: unknown) => void) => {
    sendLookupResult(res, next, () =>
      getBatchLevels(req.query.ids, req.user!.role, req.user!.id, req),
    );
  }
);

router.get(
  "/students/:id",
  requireAuth,
  (req: Request, res: Response, next: (e: unknown) => void) => {
    sendLookupResult(res, next, () =>
      getSingleStudentLevel(String(req.params.id), req.user!.role, req.user!.id, req),
    );
  }
);

router.get(
  "/heatmap",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        return res.status(404).json({ error: { code: "NO_ACTIVE_TERM", message: "No active term" } });
      }
      const gradeMode =
        req.query.gradeMode === "raw" || req.query.gradeMode === "final"
          ? (req.query.gradeMode as "raw" | "final")
          : "final";
      const heatmap = await getRiskHeatmap(termId, gradeMode, req.termScope?.schoolYearId ?? null);
      res.json(heatmap);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/sections/:id/students",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
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

router.get(
  "/sections/:id/heatmap",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      if (!termId) return res.status(400).json({ error: { code: "MISSING_TERM", message: "termId query required" } });
      res.json(await getSectionFactorCounts(String(req.params.id), termId));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/staff",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (_req, res, next) => {
    try {
      res.json(await getRiskStaff());
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/interventions",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
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

      const result = await getInterventionStudents(
        {
          riskLevel,
          hasIntervention,
          factor,
          gradeMode,
          includeRecovered: true,
          fullCohort: true,
          page,
          pageSize,
        },
        req.termScope ?? undefined,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/interventions/:studentId/alert",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const result = await alertGuidance(
        { userId: req.user!.id },
        String(req.params.studentId),
        typeof req.body?.note === "string" ? req.body.note : "",
      );
      if (!result.alerted) {
        const status = result.code === "INTERVENTION_EXISTS" ? 409 : 404;
        return res.status(status).json({ error: { code: result.code, message: result.message } });
      }
      res.json({ alerted: true });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/interventions/stats",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (req, res, next) => {
    try {
      const gradeMode =
        typeof req.query.gradeMode === "string" &&
        (req.query.gradeMode === "raw" || req.query.gradeMode === "final")
          ? (req.query.gradeMode as "raw" | "final")
          : undefined;

      const result = await getInterventionStudents(
        {
          gradeMode,
          includeRecovered: true,
          fullCohort: true,
          page: 1,
          pageSize: 100,
        },
        req.termScope ?? undefined,
      );
      const students = result.students;
      const withIntervention = students.filter((s) => s.intervention !== null);
      const pendingApproval = withIntervention.filter(
        (s) => s.intervention?.approvalStatus === "pending"
      );
      const highRisk = students.filter((s) => s.riskLevel === "High");
      const resolved = withIntervention.filter(
        (s) => s.intervention?.outcomeStatus === "resolved"
      );
      const ongoing = withIntervention.filter(
        (s) => s.intervention?.outcomeStatus === "ongoing"
      );
      res.json({
        totalAtRisk: result.highModerate,
        withIntervention: withIntervention.length,
        pendingApproval: pendingApproval.length,
        highRisk: highRisk.length,
        resolved: resolved.length,
        ongoing: ongoing.length,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
