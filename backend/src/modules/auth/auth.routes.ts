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
import { matchLrn } from "../../lib/lrnMatch.js";
import type { Role, GradeLevel } from "../../generated/prisma/client.js";

const router = Router();

const SELF_ROLES: Role[] = ["student", "parent", "subject_teacher", "adviser"];

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(["student", "parent", "subject_teacher", "adviser"]),
  contactNumber: z.string().optional(),
  lrn: z.string().optional(),
});

router.post("/register/:kind", validate("body", registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, role, contactNumber, lrn } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, "EMAIL_EXISTS", "Email already registered");

    // LRN is captured only for student self-registration; it is verified
    // against the StudentRoster by the registrar before approval.
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, role, contactNumber, lrn: role === "student" ? lrn ?? null : null, status: "pending" },
    });
    res.status(201).json({ id: user.id, email: user.email, role: user.role, status: user.status });
  } catch (e) { next(e); }
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
    } catch (e) { next(e); }
  }
);

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

      // Two sources of pending students:
      //  1) Those with a StudentProfile already (e.g. seeded) — use profile data.
      //  2) Real sign-ups with no profile yet — read the claimed LRN from User
      //     and resolve grade band from the official StudentRoster.
      const [profiled, bare, rosterSections] = await Promise.all([
        prisma.studentProfile.findMany({
          where: { gradeLevel: { in: band }, user: { status: "pending", role: roleFilter as Role } },
          select: {
            userId: true,
            lrn: true,
            gradeLevel: true,
            birthdate: true,
            address: true,
            photoUrl: true,
            section: { select: { name: true } },
            user: {
              select: { id: true, fullName: true, email: true, contactNumber: true, status: true, createdAt: true },
            },
          },
          orderBy: { user: { createdAt: "asc" } },
        }),
        prisma.user.findMany({
          where: {
            status: "pending",
            role: roleFilter as Role,
            studentProfile: null,
          },
          select: { id: true, fullName: true, email: true, contactNumber: true, lrn: true, status: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
        // Canonical section source: the enrolled StudentRoster, not the profile.
        prisma.studentRoster.findMany({
          where: { gradeLevel: { in: band } },
          select: { lrn: true, section: { select: { name: true } } },
        }),
      ]);

      const rosterSectionByLrn = new Map<string, string>();
      for (const r of rosterSections) rosterSectionByLrn.set(r.lrn, r.section?.name ?? "—");

      const students = profiled.map((s) => ({
        id: s.user.id,
        lrn: s.lrn,
        name: s.user.fullName,
        gradeLevel: s.gradeLevel as GradeLevel | string,
        section: rosterSectionByLrn.get(s.lrn) ?? s.section?.name ?? "—",
        email: s.user.email,
        contactNumber: s.user.contactNumber ?? "—",
        birthdate: s.birthdate ? s.birthdate.toISOString().slice(0, 10) : "—",
        address: s.address ?? "—",
        imageUrl: s.photoUrl ?? null,
        status: s.user.status,
        requestedAt: s.user.createdAt.toISOString(),
      }));

      for (const u of bare) {
        let gradeLevel: string = "—";
        let section = "—";
        if (u.lrn) {
          const roster = await prisma.studentRoster.findFirst({
            where: { lrn: u.lrn },
            include: { section: { select: { name: true } } },
            orderBy: { schoolYearId: "desc" },
          });
          if (roster) {
            if (!band.includes(roster.gradeLevel)) continue; // grade-band enforcement
            gradeLevel = roster.gradeLevel;
            section = roster.section?.name ?? "—";
          }
        }
        students.push({
          id: u.id,
          lrn: u.lrn ?? "—",
          name: u.fullName,
          gradeLevel,
          section,
          email: u.email,
          contactNumber: u.contactNumber ?? "—",
          birthdate: "—",
          address: "—",
          imageUrl: null,
          status: u.status,
          requestedAt: u.createdAt.toISOString(),
        });
      }

      res.json({ students });
    } catch (e) {
      next(e);
    }
  }
);

const rejectSchema = z.object({ reason: z.string().min(1) });
router.post(
  "/reject/:userId",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  gradeBandGuard(async (req) => String(req.params.userId)),
  validate("params", approveSchema),
  validate("body", rejectSchema),
  async (req, res, next) => {
    try {
      const target = await prisma.user.findUnique({ where: { id: String(req.params.userId) } });
      if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      if (target.status !== "pending")
        throw new AppError(409, "NOT_PENDING", "Only pending accounts can be rejected");

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { status: "suspended", approvedBy: req.user!.id, approvedAt: new Date() },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "account_approval",
        sourceTable: "users",
        sourceId: updated.id,
        reason: req.body.reason,
        oldValue: { status: "pending" },
        newValue: { status: "suspended" },
      });
      await fanoutNotification({
        userId: updated.id,
        sourceTable: "users",
        action: "reject",
        message: "Your account request was not approved.",
      });
      res.json({ id: updated.id, status: updated.status });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
