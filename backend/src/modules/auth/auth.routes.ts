import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { signAccess, signRefresh } from "../../lib/jwt.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { gradeBandGuard } from "../../middleware/gradeBand.js";
import { validate } from "../../middleware/validate.js";
import { fanoutNotification } from "../../lib/notify.js";
import { writeAudit } from "../../lib/audit.js";
import type { Role } from "@prisma/client";

const router = Router();

const SELF_ROLES: Role[] = ["student", "parent", "subject_teacher", "adviser"];

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(["student", "parent", "subject_teacher", "adviser"]),
  contactNumber: z.string().optional(),
});

router.post("/register/:kind", validate("body", registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, role, contactNumber } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, "EMAIL_EXISTS", "Email already registered");

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, role, contactNumber, status: "pending" },
    });
    res.status(201).json({ id: user.id, email: user.email, role: user.role, status: user.status });
  } catch (e) { next(e); }
});

const STAFF_ROLES: Role[] = [
  "subject_teacher",
  "adviser",
  "nurse",
  "adm_coordinator",
  "guidance_counselor",
  "record_keeper",
  "registrar",
  "principal",
];

const KNOWN_ROLES: Role[] = [...STAFF_ROLES, "student", "parent"];

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["student", "staff", "parent"]),
});

const roleKindToRoles: Record<string, Role[]> = {
  student: ["student"],
  staff: STAFF_ROLES,
  parent: ["parent"],
};

router.post("/login", validate("body", loginSchema), async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "active") throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");

    const allowedRoles = roleKindToRoles[role] ?? [];
    if (!KNOWN_ROLES.includes(user.role) || !allowedRoles.includes(user.role)) {
      throw new AppError(403, "ROLE_MISMATCH", "This account cannot sign in through this portal.");
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");

    const band = user.role === "record_keeper" ? "7-10" : user.role === "registrar" ? "11-12" : null;
    const access = signAccess({ sub: user.id, role: user.role, gradeBand: band as any });
    const refresh = signRefresh({ sub: user.id });
    res.json({ accessToken: access, refreshToken: refresh, role: user.role });
  } catch (e) { next(e); }
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
router.post("/refresh", validate("body", refreshSchema), async (req, res, next) => {
  try {
    const { verifyRefresh, signAccess, signRefresh } = await import("../../lib/jwt.js");
    const { default: jwt } = await import("jsonwebtoken");
    const env = (await import("../../config/env.js")).getEnv();
    let payload: any;
    try { payload = verifyRefresh(req.body.refreshToken); }
    catch { throw new AppError(401, "INVALID_REFRESH", "Invalid refresh token"); }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError(401, "INVALID_REFRESH", "User not found");
    const band = user.role === "record_keeper" ? "7-10" : user.role === "registrar" ? "11-12" : null;
    const access = signAccess({ sub: user.id, role: user.role, gradeBand: band as any });
    const refresh = signRefresh({ sub: user.id });
    res.json({ accessToken: access, refreshToken: refresh });
    void jwt; void env;
  } catch (e) { next(e); }
});

const approveSchema = z.object({ userId: z.string().min(1) });
router.post(
  "/approve/:userId",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  gradeBandGuard(async (req) => String(req.params.userId)),
  validate("params", approveSchema),
  async (req, res, next) => {
    try {
      const target = await prisma.user.findUnique({ where: { id: String(req.params.userId) } });
      if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      if (target.status === "active") throw new AppError(409, "ALREADY_ACTIVE", "User already active");

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { status: "active", approvedBy: req.user!.id, approvedAt: new Date() },
      });
      await writeAudit({
        userId: req.user!.id, actionType: "account_approval",
        sourceTable: "users", sourceId: updated.id, reason: "Account activation",
      });
      await fanoutNotification({
        userId: updated.id, sourceTable: "users", action: "approve",
        message: "Your account has been approved.",
      });
      res.json({ id: updated.id, status: updated.status });
    } catch (e) { next(e); }
  }
);

export default router;
