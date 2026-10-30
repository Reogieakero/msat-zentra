import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { AppError } from "../../lib/errors.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TTLS } from "../../lib/cacheTags.js";
import { MODULE_TAGS } from "../../services/advisory/modules.service.js";
import {
  listStudentModules,
  submitStudentLink,
  submitStudentPhysical,
  uploadStudentSubmission,
  type SubmissionFile,
  type StudentCtx,
} from "../../services/student/modules.service.js";
import {
  studentLinkSubmissionSchema,
  studentModulesQuerySchema,
  studentUploadSchema,
} from "./modules.schemas.js";
import type { ModuleStatus } from "../teacher/advisory-modules.schemas.js";
import type { Request } from "express";

const router = Router();

/**
 * Answered modules are PDF/Word; a physical hand-in proof may also be a photo.
 * 10 MB per file, matching the adviser desk's upload limit.
 */
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
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.mimetype) || ["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"].includes(ext);
    if (ok) cb(null, true);
    else cb(new AppError(400, "INVALID_FILE", "Only PDF, Word, or image files are accepted"));
  },
});

function ctxOf(req: Request): StudentCtx {
  return { userId: req.user!.id };
}

router.get(
  "/modules",
  requireAuth,
  requireRole("student"),
  validate("query", studentModulesQuerySchema),
  cache({ tags: [...MODULE_TAGS], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as {
        page: number;
        pageSize: number;
        status?: ModuleStatus;
      };
      res.json(
        await listStudentModules(ctxOf(req), {
          page: query.page,
          pageSize: query.pageSize,
          status: query.status,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

/** Link answer: saving the link records the submission automatically. */
router.put(
  "/modules/:moduleId/submission",
  requireAuth,
  requireRole("student"),
  validate("body", studentLinkSubmissionSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { submissionUrl: string; remarks?: string | null };
      const id = await submitStudentLink(ctxOf(req), String(req.params.moduleId), {
        submissionUrl: body.submissionUrl,
        remarks: body.remarks ?? null,
      });
      res.status(201).json({ id });
    } catch (e) {
      next(e);
    }
  },
);

/** "Passed in person" — the learner handed the paper module over. */
router.post(
  "/modules/:moduleId/submission/physical",
  requireAuth,
  requireRole("student"),
  async (req, res, next) => {
    try {
      const id = await submitStudentPhysical(ctxOf(req), String(req.params.moduleId), {
        remarks: null,
      });
      res.status(201).json({ id });
    } catch (e) {
      next(e);
    }
  },
);

/** Upload the answered module (kind=file) or proof of a physical hand-in. */
router.post(
  "/modules/:moduleId/submission/upload",
  requireAuth,
  requireRole("student"),
  submissionUpload.single("file"),
  async (req, res, next) => {
    try {
      const parsed = studentUploadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          parsed.error.issues[0]?.message ?? "Invalid submission",
        );
      }
      const file = (req as unknown as { file?: SubmissionFile }).file;
      const id = await uploadStudentSubmission(
        ctxOf(req),
        String(req.params.moduleId),
        {
          kind: parsed.data.kind ?? "file",
          remarks: parsed.data.remarks ? parsed.data.remarks.trim() : null,
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
