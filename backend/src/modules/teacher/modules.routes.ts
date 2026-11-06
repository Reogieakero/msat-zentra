import { Router, type Request } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { AppError } from "../../lib/errors.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import {
  advisoryModuleCreateSchema,
  advisoryModuleUpdateSchema,
  advisoryModulesQuerySchema,
  advisorySubmissionSchema,
  advisorySubmissionsQuerySchema,
  type ModuleStatus,
} from "./advisory-modules.schemas.js";
import {
  createModule,
  deleteModule,
  getModuleSubmissions,
  listModules,
  MODULE_TAGS,
  recordSubmission,
  updateModule,
  uploadSubmissionFile,
  type SubmissionFile,
} from "../../services/advisory/modules.service.js";
import type { AdvisoryContext } from "../../services/advisory/advisory.types.js";

const router = Router();

/** Answered modules usually arrive as PDF or Word; 10 MB per file. */
const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    const ok =
      [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(file.mimetype) || ["pdf", "doc", "docx"].includes(ext);
    if (ok) cb(null, true);
    else cb(new Error("Only PDF, DOC, or DOCX files are allowed for module submissions."));
  },
});

async function ctxOf(req: Request): Promise<AdvisoryContext> {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: await resolveActiveTermId(req),
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

type ModulesQuery = { page: number; pageSize: number; sectionId?: string; status?: ModuleStatus };
type SubmissionsQuery = { page: number; pageSize: number; status?: ModuleStatus };

router.get(
  "/modules",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("query", advisoryModulesQuerySchema),
  cache({ tags: [...MODULE_TAGS], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(await listModules(await ctxOf(req), req.query as unknown as ModulesQuery));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/modules",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", advisoryModuleCreateSchema),
  async (req, res, next) => {
    try {
      const id = await createModule(
        await ctxOf(req),
        req.body as {
          sectionId?: string;
          kind?: "general" | "adm";
          moduleName: string;
          moduleUrl?: string | null;
          description?: string | null;
          dueDate?: string | null;
        },
      );
      res.status(201).json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/modules/:moduleId",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", advisoryModuleUpdateSchema),
  async (req, res, next) => {
    try {
      const id = await updateModule(
        await ctxOf(req),
        String(req.params.moduleId),
        req.body as {
          moduleName?: string;
          moduleUrl?: string | null;
          description?: string | null;
          dueDate?: string | null;
        },
      );
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/modules/:moduleId",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      await deleteModule(await ctxOf(req), String(req.params.moduleId));
      await invalidateTags([...MODULE_TAGS]);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/modules/:moduleId/submissions",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("query", advisorySubmissionsQuerySchema),
  cache({ tags: [...MODULE_TAGS], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(
        await getModuleSubmissions(
          await ctxOf(req),
          String(req.params.moduleId),
          req.query as unknown as SubmissionsQuery,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/modules/:moduleId/submissions",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", advisorySubmissionSchema),
  async (req, res, next) => {
    try {
      const id = await recordSubmission(
        await ctxOf(req),
        String(req.params.moduleId),
        req.body as {
          studentId?: string;
          rosterId?: string;
          submissionKind?: "link" | "file" | "physical";
          submissionUrl?: string | null;
          submitted?: boolean;
          remarks?: string | null;
        },
      );
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

/** Upload the learner's answered module (PDF/Word) as the submission itself. */
router.post(
  "/modules/:moduleId/submissions/upload",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  submissionUpload.single("file"),
  async (req, res, next) => {
    try {
      const body = req.body as {
        studentId?: string;
        rosterId?: string;
        remarks?: string;
      };
      if (Boolean(body.studentId) === Boolean(body.rosterId)) {
        throw new AppError(400, "VALIDATION_ERROR", "Provide exactly one of studentId or rosterId");
      }
      const file = (req as unknown as { file?: SubmissionFile }).file;
      const id = await uploadSubmissionFile(
        await ctxOf(req),
        String(req.params.moduleId),
        {
          ...(body.studentId ? { studentId: body.studentId } : { rosterId: body.rosterId }),
          remarks: body.remarks ?? null,
        },
        file,
      );
      res.status(201).json({ id });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
