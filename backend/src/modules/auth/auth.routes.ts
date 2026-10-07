import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { gradeBandGuard } from "../../middleware/gradeBand.js";
import { validate } from "../../middleware/validate.js";
import { matchLrn } from "../../lib/lrnMatch.js";
import { AppError } from "../../lib/errors.js";
import {
  clearRefreshCookie,
  getRefreshCookie,
  isSecureContext,
  setRefreshCookie,
} from "../../lib/cookies.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import {
  approveSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  rejectSchema,
} from "./auth.schemas.js";
import {
  changePassword,
  login,
  refreshTokens,
  register,
} from "../../services/auth/session.service.js";
import { approveAccount, listPending, rejectAccount } from "../../services/auth/approval.service.js";

const router = Router();

router.post("/register/:kind", validate("body", registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, role, contactNumber, lrn } = req.body as {
      email: string;
      password: string;
      fullName: string;
      role: "student" | "parent" | "subject_teacher" | "adviser";
      contactNumber?: string;
      lrn?: string;
    };
    const user = await register({ email, password, fullName, role, contactNumber, lrn });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

// LRN verification engine. Given a claimed LRN + name, returns the matching
// official StudentRoster record and a side-by-side comparison verdict so the
// registrar can confirm the requester is the enrolled student.
router.get(
  "/match-lrn",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const lrn = typeof req.query.lrn === "string" ? req.query.lrn.trim() : "";
      const name = typeof req.query.name === "string" ? req.query.name : "";
      if (!lrn) throw new AppError(400, "LRN_REQUIRED", "lrn query parameter is required");
      const result = await matchLrn(lrn, name);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post("/login", validate("body", loginSchema), async (req, res, next) => {
  try {
    const { email, password, role } = req.body as {
      email: string;
      password: string;
      role: "student" | "staff" | "parent";
    };
    const { accessToken, refreshToken, role: userRole } = await login({ email, password, role });
    // Long-lived refresh token leaves only as an httpOnly cookie — it is
    // never exposed to page JavaScript. The short-lived access token stays
    // in the JSON body for the Bearer transport.
    setRefreshCookie(res, refreshToken, { secure: isSecureContext() });
    res.json({ accessToken, role: userRole });
  } catch (e) {
    next(e);
  }
});

// Self-service password change for any authenticated account (used by the
// teacher settings page, safe for all roles).
router.post(
  "/change-password",
  requireAuth,
  validate("body", changePasswordSchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };
      res.json(await changePassword(req.user!.id, currentPassword, newPassword));
    } catch (e) {
      next(e);
    }
  }
);

router.post("/refresh", async (req, res, next) => {
  try {
    const token = getRefreshCookie(req);
    if (!token) throw new AppError(401, "INVALID_REFRESH", "Invalid refresh token");
    const { accessToken, refreshToken } = await refreshTokens(token);
    // Rotate on every use: the fresh token replaces the cookie value.
    setRefreshCookie(res, refreshToken, { secure: isSecureContext() });
    res.json({ accessToken });
  } catch (e) {
    next(e);
  }
});

// Terminates the refresh-token cookie. No auth gate: the access token may
// already be expired — clearing the cookie is idempotent either way.
router.post("/logout", async (_req, res, next) => {
  try {
    clearRefreshCookie(res, { secure: isSecureContext() });
    res.json({ loggedOut: true });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/approve/:userId",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  gradeBandGuard(async (req) => String(req.params.userId)),
  validate("params", approveSchema),
  async (req, res, next) => {
    try {
      res.json(await approveAccount({ userId: req.user!.id, role: req.user!.role }, String(req.params.userId)));
    } catch (e) {
      next(e);
    }
  }
);

// List pending account requests. Registrar sees grade band G11–G12 only; record
// keeper sees G7–G10. Grade-band enforcement is server-side via the student
// profile gradeLevel. Optional ?role filters by account role (defaults student).
router.get(
  "/pending",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const band: GradeLevel[] =
        req.user!.role === "registrar" ? ["G11", "G12"] : ["G7", "G8", "G9", "G10"];
      const roleFilter = req.query.role ? String(req.query.role) : "student";
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const rawPage = req.query.page !== undefined ? Number(req.query.page) : NaN;
      const rawSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : NaN;
      const hasPaging = !!q || Number.isFinite(rawPage) || Number.isFinite(rawSize);
      res.json(
        await listPending({
          band,
          roleFilter,
          q,
          page: rawPage,
          pageSize: rawSize,
          hasPaging,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/reject/:userId",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  gradeBandGuard(async (req) => String(req.params.userId)),
  validate("params", approveSchema),
  validate("body", rejectSchema),
  async (req, res, next) => {
    try {
      res.json(
        await rejectAccount(
          { userId: req.user!.id, role: req.user!.role },
          String(req.params.userId),
          (req.body as { reason: string }).reason,
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
