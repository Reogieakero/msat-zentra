import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { FILER_ROLES } from "./anecdotal.repository.js";
import { folderSchema } from "./anecdotal.schemas.js";
import {
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
} from "../../services/anecdotal/folders.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string }; termScope?: { termId: string } | null }) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
  };
}

// Teacher-owned record folders. Every route is owner-scoped: teachers only
// ever see and touch their own folders.
router.get(
  "/folders",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      res.json(await listFolders(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/folders",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", folderSchema),
  async (req, res, next) => {
    try {
      const folder = await createFolder(req.user!.id, (req.body as { name: string }).name);
      res.status(201).json(folder);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/folders/:id",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", folderSchema),
  async (req, res, next) => {
    try {
      res.json(
        await renameFolder(ctxOf(req), String(req.params.id), (req.body as { name: string }).name),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/folders/:id",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      await deleteFolder(ctxOf(req), String(req.params.id));
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
