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
import { fanoutToRole } from "../../lib/notify.js";
import {
  getBatchLevels,
  getSectionFactorCounts,
  getSingleStudentLevel,
} from "../../services/risk/riskLookups.service.js";
import { getRiskStaff } from "../../services/risk/riskStaff.service.js";
import { alertGuidance } from "../../services/risk/riskAlert.service.js";

const router = Router();

type ServiceError = { status: number; code: string; message: string };

// The lookup service signals expected denials (403/404) as plain error
// objects so routes render the exact legacy shape { error: { code, message } }
// (no `fields` key) instead of the AppError envelope.
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

// Principal board overview (O4): KPIs, level distribution, factor totals, trend.
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

// School years (with nested terms) to power the Risk Trend filters.
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

// School-year/term-scoped risk trend for the Risk Trend chart.
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

// Principal: paginated low-risk student list (LRN + name only).
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

// Principal: full at-risk student list with status-only factors (O1). Optional
// `section` filter (section name) for the heatmap drill-down.
router.get(
  "/students",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["risk", "principal"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      // Default 50 (Teacher-aligned small pages); cap 1000 preserved for
      // explicit export/full-scan callers. Tables render ≤20 rows/page.
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

// Batch risk levels for desk queues (nurse/alerts, guidance, ADM).
// Single HTTP round-trip replacing the per-student N+1 fan-out:
//   GET /api/risk/students/batch?ids=a,b,c → { levels: { [id]: "High"|"Moderate"|"Low" } }
// Profiles return the stored riskLevel (same as the single endpoint — one
// query); roster-enlisted students are evaluated live in bulk (bulk grades +
// attendance + anecdotal groupBy + section headcounts, then the pure
// computeRiskFactors — constant queries regardless of N). Unknown ids are
// omitted (caller renders "—"). Auth mirrors the single endpoint: staff +
// principal broad read, advisers scoped to their own advisees.
router.get(
  "/students/batch",
  requireAuth,
  (req: Request, res: Response, next: (e: unknown) => void) => {
    sendLookupResult(res, next, () =>
      getBatchLevels(req.query.ids, req.user!.role, req.user!.id, req),
    );
  }
);

// Student/parent: limited projection only (O1) — risk_level + behavioral flag.
router.get(
  "/students/:id",
  requireAuth,
  (req: Request, res: Response, next: (e: unknown) => void) => {
    sendLookupResult(res, next, () =>
      getSingleStudentLevel(String(req.params.id), req.user!.role, req.user!.id, req),
    );
  }
);

// Principal board heat map: all sections × risk-factor counts (O4, status-only).
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

// Per section × factor at-risk student list (principal only).
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

// Section heat map: section × risk_factor counts (no student identities).
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

// Principal: staff directory for intervention assignment (all staff roles).
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

// Principal: at-risk students (RiskSnapshot) for the active term, each with
// their current intervention link. This is the principal's intervention queue.
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
      // Same queue as the guidance desk: full live enrollment (profiles +
      // roster) plus recovered students with open cases, so both desks track
      // the same at-risk students.
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

// Principal: alert guidance counselors about an at-risk student with no
// intervention action yet. Read-only tracking otherwise — the principal never
// edits interventions. Fans out to every active guidance counselor.
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

// Principal: intervention stats for the carousel/sidebar widgets.
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
      // Service clamps to 100 internally; pass 100 explicitly instead of
      // 1000 so the intent is honest. Follow-up: dedicated groupBy/count
      // stats query to avoid materializing student rows for 6 ints.
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

// Interventions are auto-created by the risk engine (recomputeRisk) and assigned to
// the Guidance Counselor. The Principal has read-only visibility (list + detail) — no
// create/assign/approve/edit endpoints are exposed. The guidance_counselor owns the
// lifecycle (outcome updates) via their own role-guarded routes if/when added.

export default router;
