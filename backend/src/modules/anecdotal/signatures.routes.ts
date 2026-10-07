import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { FILER_ROLES, OCFORM01_ROLES } from "./anecdotal.repository.js";
import { signSchema } from "./anecdotal.schemas.js";
import {
  applySignature,
  getSignature,
  removeSignature,
  saveSignature,
  signRecord,
} from "../../services/anecdotal/signatures.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string }; termScope?: { termId: string } | null }) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
  };
}

// The teacher's one reusable drawn signature (GET/PUT /signature), stamped
// onto records via POST /:id/apply-signature. Stored as a PNG data URL on
// the staff profile — no storage bucket needed.
router.get(
  "/signature",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      res.json(await getSignature(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  "/signature",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", signSchema),
  async (req, res, next) => {
    try {
      res.json(
        await saveSignature(ctxOf(req), (req.body as { signatureImage: string }).signatureImage),
      );
    } catch (e) {
      next(e);
    }
  }
);

// Stamp the teacher's saved signature onto one record (same signatory rule
// as drawing directly). 409 when the teacher hasn't saved one yet.
router.post(
  "/:id/apply-signature",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      const signed = await applySignature(ctxOf(req), String(req.params.id));
      res.status(201).json(signed);
    } catch (e) {
      next(e);
    }
  }
);

// Drawn-signature sign-off for one record. Only the signatory may sign: the
// section adviser, or the observer when no adviser is assigned (same rule
// that picks the printed name). Re-signing overwrites the previous mark.
router.post(
  "/:id/sign",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  validate("body", signSchema),
  async (req, res, next) => {
    try {
      const signed = await signRecord(
        ctxOf(req),
        String(req.params.id),
        (req.body as { signatureImage: string }).signatureImage,
      );
      res.status(201).json(signed);
    } catch (e) {
      next(e);
    }
  }
);

// Remove a signature (same signatory rule). The form returns to unsigned.
router.delete(
  "/:id/sign",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      res.json(await removeSignature(ctxOf(req), String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
