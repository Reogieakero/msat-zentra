import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { invalidateTags } from "../../lib/cache.js";
import {
  getOcrResult,
  getRecordDetail,
  getSubjectMap,
  listVersions,
  releaseRecord,
  updateOcrSubjects,
  validateRecord,
  verifyRecord,
} from "../../services/sf10/records.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string } }) {
  return { userId: req.user!.id, role: req.user!.role };
}

router.get(
  "/:id/versions",
  requireAuth,
  requireRole("principal", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      res.json(await listVersions(ctxOf(req), String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/ocr/:jobId",
  requireAuth,
  requireRole("adviser", "registrar", "record_keeper", "principal"),
  async (req, res, next) => {
    try {
      res.json(await getOcrResult(ctxOf(req), String(req.params.jobId)));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/:id/subject-map",
  requireAuth,
  requireRole("adviser", "registrar", "record_keeper", "principal"),
  async (req, res, next) => {
    try {
      res.json(
        await getSubjectMap(
          { userId: req.user!.id, role: req.user!.role },
          String(req.params.id),
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/:id/detail",
  requireAuth,
  requireRole("adviser", "registrar", "record_keeper", "principal"),
  async (req, res, next) => {
    try {
      res.json(
        await getRecordDetail(
          { userId: req.user!.id, role: req.user!.role },
          String(req.params.id),
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/:id/ocr",
  requireAuth,
  requireRole("adviser", "registrar", "record_keeper"),
  validate(
    "body",
    z.object({
      subjects: z
        .array(
          z.object({
            rawName: z.string().trim().min(1).max(120),
            grade: z.number().min(0).max(100).nullable().optional(),
            rating: z.number().min(0).max(100).nullable().optional(),
            gradeLevel: z.enum(["G7", "G8", "G9", "G10", "G11", "G12"]).nullable().optional(),
            quarters: z.array(z.number().min(0).max(100).nullable()).length(4).nullable().optional(),
            remarks: z.string().trim().max(20).nullable().optional(),
          }),
        )
        .min(1)
        .max(120),
    }),
  ),
  async (req, res, next) => {
    try {
      const body = req.body as {
        subjects: Array<{
          rawName: string;
          grade?: number | null;
          rating?: number | null;
          gradeLevel?: string | null;
          quarters?: Array<number | null> | null;
          remarks?: string | null;
        }>;
      };
      const result = await updateOcrSubjects(
        { userId: req.user!.id, role: req.user!.role },
        String(req.params.id),
        body.subjects,
      );
      await invalidateTags(["registrar-sf10", "registrar-overview", "overview", "principal"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/verify",
  requireAuth,
  requireRole("subject_teacher", "adviser", "record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const updated = await verifyRecord(ctxOf(req), String(req.params.id));
      await invalidateTags([
        "registrar",
        "registrar-sf10",
        "registrar-overview",
        "record-keeper",
        "record-keeper-overview",
        "overview",
        "principal",
      ]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/validate",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const updated = await validateRecord(ctxOf(req), String(req.params.id));
      await invalidateTags([
        "registrar",
        "registrar-sf10",
        "registrar-overview",
        "record-keeper",
        "record-keeper-overview",
        "overview",
        "principal",
      ]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/release",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const updated = await releaseRecord(ctxOf(req), String(req.params.id));
      await invalidateTags(["registrar", "registrar-sf10", "registrar-overview", "overview", "principal"]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
