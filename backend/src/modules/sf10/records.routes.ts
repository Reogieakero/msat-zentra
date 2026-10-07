import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import { invalidateTags } from "../../lib/cache.js";
import { sf10Upload } from "../../lib/upload.js";
import { resolveGradeBand } from "./sf10.repository.js";
import {
  getOcrResult,
  getSummary,
  listRecords,
  listVersions,
  releaseRecord,
  uploadRecord,
  validateRecord,
  verifyRecord,
} from "../../services/sf10/records.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string } }) {
  return { userId: req.user!.id, role: req.user!.role };
}

router.get(
  "/summary",
  requireAuth,
  requireRole("principal", "registrar", "record_keeper"),
  async (_req, res, next) => {
    try {
      res.json(await getSummary());
    } catch (e) {
      next(e);
    }
  }
);

// List SF10 records scoped to the caller's handled grade levels (registrar /
// record_keeper are banded 11–12 / 7–10 via staffProfile.handledGradeLevels).
router.get(
  "/records",
  requireAuth,
  requireRole("principal", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const band = await resolveGradeBand(req.user!.role, req.user!.id);

      // Server paging + search (list standard): `total` drives the pager
      // (filtered count); `counts` stay global (unfiltered) for the tiles.
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 15, 1), 100);
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const status =
        typeof req.query.status === "string" &&
        ["attach", "available", "released"].includes(req.query.status)
          ? (req.query.status as "attach" | "available" | "released")
          : null;
      res.json(await listRecords({ band, page, pageSize, q, status }));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/upload",
  requireAuth,
  requireRole("adviser", "registrar"),
  sf10Upload.single("file"),
  async (req, res, next) => {
    try {
      const studentId = String(req.body.studentId ?? "");
      if (!studentId) throw new AppError(400, "BAD_REQUEST", "studentId is required");
      if (!req.file) throw new AppError(400, "BAD_REQUEST", "SF10 file is required");
      const result = await uploadRecord(ctxOf(req), {
        studentId,
        file: {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        },
      });
      await invalidateTags(["registrar", "registrar-sf10", "registrar-overview", "overview", "principal"]);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
