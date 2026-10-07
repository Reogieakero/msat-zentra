import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { scopedTermRow } from "../../lib/termScope.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { FILER_ROLES, OCFORM01_ROLES } from "./anecdotal.repository.js";
import {
  createSchema,
  fileFolderSchema,
  followupSchema,
  referSchema,
} from "./anecdotal.schemas.js";
import {
  addFollowup,
  createRecord,
  exportRecord,
  fileIntoFolder,
  getRecordDetail,
  getRecordsHeatmap,
  getRecordsSummary,
  getReferable,
  referRecord,
} from "../../services/anecdotal/records.service.js";
import { listMine } from "../../services/anecdotal/folders.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string }; termScope?: { termId: string } | null }) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
  };
}

router.post(
  "/",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", createSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        studentId: string;
        sectionId: string;
        termId?: string;
        observationDatetime: string;
        descriptionOfIncident: string;
        descriptionOfLocation?: string;
        notesRecommendationsActions?: string;
        classPerformance?: string;
        attendanceSummary?: string;
        category: "behavioral" | "bullying" | "academic" | "attendance" | "health";
        confidentialityLevel: "restricted" | "confidential";
        folderId?: string;
      };
      const result = await createRecord(ctxOf(req), {
        studentId: body.studentId,
        sectionId: body.sectionId,
        termId: body.termId,
        observationDatetime: body.observationDatetime,
        descriptionOfIncident: body.descriptionOfIncident,
        descriptionOfLocation: body.descriptionOfLocation,
        notesRecommendationsActions: body.notesRecommendationsActions,
        classPerformance: body.classPerformance,
        attendanceSummary: body.attendanceSummary,
        category: body.category,
        confidentialityLevel: body.confidentialityLevel,
        folderId: body.folderId,
      });
      await invalidateTags(["risk", "principal", "teacher", "overview", "guidance", "guidance-anecdotal", "guidance-risk", "nurse", "nurse-risk", "alerts", "referrals", "adm"]);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/followups",
  requireAuth,
  requireRole("adviser", "guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", followupSchema),
  async (req, res, next) => {
    try {
      const followup = await addFollowup(
        ctxOf(req),
        String(req.params.id),
        (req.body as { notes: string }).notes,
      );
      await invalidateTags(["risk", "principal", "teacher", "overview", "guidance", "guidance-risk", "nurse", "nurse-risk"]);
      res.status(201).json(followup);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/refer",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", referSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        referredToRole: "nurse" | "guidance_counselor" | "adm_coordinator" | "principal";
        reason: string;
        consultReviewer?: "nurse" | "guidance_counselor" | "lrpc";
      };
      const termId = await resolveActiveTermId(req);
      const referral = await referRecord(ctxOf(req), String(req.params.id), {
        referredToRole: body.referredToRole,
        reason: body.reason,
        consultReviewer: body.consultReviewer,
      }, termId);
      // A new referral must surface on the ADM board + teacher cases +
      // guidance overview at once (otherwise the guidance page serves a stale
      // cached empty response right after an adviser refers).
      await invalidateTags(["adm", "teacher", "guidance", "overview", "referrals", "alerts", "nurse", "nurse-overview", "nurse-alerts", "nurse-referrals", "nurse-clinic", "nurse-adm", "nurse-risk"]);
      res.status(201).json(referral);
    } catch (e) {
      next(e);
    }
  }
);

// Principal: records heatmap source — every section with its students that have
// anecdotal records, including each record's category/severity/follow-up. The
// categories returned here are the canonical backend AnecdotalCategory enum, so
// the heatmap legend and block colors stay wired to the backend. Records filed
// for students with no current account/section slot (transferred out,
// deactivated, or otherwise unenrolled) are included too, grouped under
// per-grade "Unassigned" sections instead of being silently dropped.
router.get(
  "/records",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const activeTerm = await scopedTermRow(req);
      res.json(
        await getRecordsHeatmap({
          termId: activeTerm?.id,
          schoolYearId: activeTerm?.schoolYearId ?? null,
          schoolYearName: activeTerm?.schoolYearName ?? "",
        }),
      );
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
      const activeTerm = await scopedTermRow(req);
      res.json(await getRecordsSummary({ termId: activeTerm?.id }));
    } catch (e) {
      next(e);
    }
  }
);

// The teacher's own filed records (any term) — backs the folder pages and
// the filing chat's folder picker. Own rows only, so no advisee gate needed.
router.get(
  "/mine",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      res.json(await listMine(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

// All eligible anecdotal records for the referrals composer, grouped by the
// frontend into one folder per student. Each record carries hasReferral so
// already-referred reports render disabled instead of disappearing. For
// advisers, includes records created by subject teachers about students in
// the adviser's sections. Subject teachers only see their own records.
router.get(
  "/referable",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      res.json(
        await getReferable({
          isAdviser: req.user!.role === "adviser",
          userId: req.user!.id,
          termId: req.termScope?.termId ?? null,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

// File one of your records into (or out of) your folders. Allowed for the
// observer and the section adviser (the form's signatory).
router.patch(
  "/:id/folder",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", fileFolderSchema),
  async (req, res, next) => {
    try {
      res.json(
        await fileIntoFolder(ctxOf(req), String(req.params.id), {
          folderId: (req.body as { folderId: string | null }).folderId,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

// JSON payload backing the frontend printable OCForm-01 sheet.
router.get(
  "/:id/detail",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      res.json(await getRecordDetail(ctxOf(req), String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

// Official .xlsx export byte-matching the OCForm-01 template layout.
router.get(
  "/:id/export",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      const { buffer, filename } = await exportRecord(ctxOf(req), String(req.params.id));
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(buffer.length));
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
