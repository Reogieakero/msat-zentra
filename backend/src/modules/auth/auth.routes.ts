import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { gradeBandGuard } from "../../middleware/gradeBand.js";
import { validate } from "../../middleware/validate.js";
import { matchLrn } from "../../lib/lrnMatch.js";
import { AppError } from "../../lib/errors.js";
import { REALTIME_TOKEN_TTL_SECONDS, signRealtimeToken, verifyAccess, verifyRefresh } from "../../lib/jwt.js";
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
  googleCompleteSchema,
  googleCompleteStaffSchema,
  googleExchangeSchema,
  loginSchema,
  pendingAccountsQuerySchema,
  registerSchema,
  rejectSchema,
} from "./auth.schemas.js";
import {
  changePassword,
  login,
  refreshTokens,
  register,
} from "../../services/auth/session.service.js";
import {
  completeGoogleSignup,
  completeGoogleStaffSignup,
  exchangeGoogleSession,
  type GooglePortalRole,
} from "../../services/auth/google.service.js";
import { approveAccount, listPending, rejectAccount } from "../../services/auth/approval.service.js";
import { clearPresence, clientIp, recordLogout } from "../../services/presence.service.js";

const router = Router();

router.post("/register/:kind", validate("body", registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, suffix, role, contactNumber, lrn, employeeId, department } =
      req.body as {
        email: string;
        password: string;
        fullName: string;
        suffix?: string;
        role: "student" | "parent" | "subject_teacher" | "adviser";
        contactNumber?: string;
        lrn?: string;
        employeeId?: string;
        department?: string;
      };
    const user = await register({
      email,
      password,
      fullName,
      suffix,
      role,
      contactNumber,
      lrn,
      employeeId,
      department,
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

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
      role: "student" | "staff" | "parent" | "admin";
    };
    const { accessToken, refreshToken, role: userRole } = await login({
      email,
      password,
      role,
      ip: clientIp(req),
    });

    setRefreshCookie(res, refreshToken, { secure: isSecureContext() });
    res.json({ accessToken, role: userRole });
  } catch (e) {
    next(e);
  }
});

// Google sign-in/sign-up: the browser completes OAuth with Supabase Auth, then
// exchanges the Supabase access token for the app's own session here.
router.post("/google/exchange", validate("body", googleExchangeSchema), async (req, res, next) => {
  try {
    const { supabaseAccessToken, role, intent } = req.body as {
      supabaseAccessToken: string;
      role: GooglePortalRole;
      intent: "login" | "signup";
    };
    const result = await exchangeGoogleSession(supabaseAccessToken, role, intent, clientIp(req));
    if (result.status === "active") {
      setRefreshCookie(res, result.refreshToken, { secure: isSecureContext() });
      res.json({ accessToken: result.accessToken, role: result.role });
      return;
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/google/complete", validate("body", googleCompleteSchema), async (req, res, next) => {
  try {
    const { supabaseAccessToken, lrn, contactNumber } = req.body as {
      supabaseAccessToken: string;
      lrn: string;
      contactNumber?: string;
    };
    res.json(await completeGoogleSignup(supabaseAccessToken, { lrn, contactNumber }));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/google/complete-staff",
  validate("body", googleCompleteStaffSchema),
  async (req, res, next) => {
    try {
      const { supabaseAccessToken, fullName, suffix, contactNumber, employeeId, department } =
        req.body as {
          supabaseAccessToken: string;
          fullName: string;
          suffix?: string;
          contactNumber?: string;
          employeeId?: string;
          department?: string;
        };
      res.json(
        await completeGoogleStaffSignup(supabaseAccessToken, {
          fullName,
          suffix,
          contactNumber,
          employeeId,
          department,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

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
    const { accessToken, refreshToken } = await refreshTokens(token, clientIp(req));

    setRefreshCookie(res, refreshToken, { secure: isSecureContext() });
    res.json({ accessToken });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    clearRefreshCookie(res, { secure: isSecureContext() });
    // Remove the user from the admin presence globe right away instead of
    // waiting for the 5-minute activity window to lapse. The refresh cookie
    // identifies them even when the access token has already expired.
    let userId: string | null = null;
    const refresh = getRefreshCookie(req);
    if (refresh) {
      try {
        userId = verifyRefresh(refresh).sub;
      } catch {
        // Expired/invalid refresh cookie — try the access token below.
      }
    }
    if (!userId) {
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        try {
          userId = verifyAccess(header.slice(7)).sub;
        } catch {
          // Nothing identifiable left; the cookie is still cleared.
        }
      }
    }
    if (userId) {
      clearPresence(userId);
      void recordLogout(userId, clientIp(req));
    }
    res.json({ loggedOut: true });
  } catch (e) {
    next(e);
  }
});

// Short-lived Supabase-format token for authenticated realtime subscriptions.
// The app's own access token can't be reused for Supabase Realtime because its
// `role` claim carries the app role, not "authenticated".
router.get("/realtime-token", requireAuth, (req, res, next) => {
  try {
    res.json({
      token: signRealtimeToken(req.user!.id, req.user!.role),
      expiresIn: REALTIME_TOKEN_TTL_SECONDS,
    });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/approve/:userId",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  // Parents have no LRN/roster entry, so the band check only applies to
  // students; the approval service itself provisions student profiles.
  gradeBandGuard(async (req) => String(req.params.userId), { allowNonStudent: true }),
  validate("params", approveSchema),
  async (req, res, next) => {
    try {
      res.json(await approveAccount({ userId: req.user!.id, role: req.user!.role }, String(req.params.userId)));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/pending",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  validate("query", pendingAccountsQuerySchema),
  async (req, res, next) => {
    try {
      const band: GradeLevel[] =
        req.user!.role === "registrar" ? ["G11", "G12"] : ["G7", "G8", "G9", "G10"];
      const q = req.query as Record<string, unknown>;
      const roleFilter = typeof q.role === "string" && q.role ? q.role : "student";
      const search = typeof q.q === "string" ? q.q.trim().toLowerCase() : "";
      const rawPage = q.page !== undefined ? Number(q.page) : NaN;
      const rawSize = q.pageSize !== undefined ? Number(q.pageSize) : NaN;
      const hasPaging = !!search || Number.isFinite(rawPage) || Number.isFinite(rawSize);
      res.json(
        await listPending({
          band,
          roleFilter,
          q: search,
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
  // Bogus sign-ups (LRN not in any roster) can't be approved but must still
  // be rejectable with a reason — skip the band check for unresolvable grades.
  gradeBandGuard(async (req) => String(req.params.userId), { allowUnresolved: true }),
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
