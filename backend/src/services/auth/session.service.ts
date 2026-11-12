import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { signAccess, signRefresh, verifyRefresh } from "../../lib/jwt.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutToRole } from "../../lib/notify.js";
import { encryptContact } from "../../lib/contact-crypto.js";
import { withNameSuffix } from "./name.js";
import { recordLogin } from "../presence.service.js";
import {
  KNOWN_ROLES,
  gradeBandForRole,
  roleKindToRoles,
} from "../../modules/auth/auth.repository.js";

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  suffix?: string;
  role: "student" | "parent" | "subject_teacher" | "adviser";
  contactNumber?: string;
  lrn?: string;
  employeeId?: string;
  department?: string;
}

export async function register(input: RegisterInput) {
  const { email, password, fullName, suffix, role, contactNumber, lrn } = input;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "EMAIL_EXISTS", "Email already registered");

  const isTeacher = role === "subject_teacher" || role === "adviser";
  const requestedEmployeeId = isTeacher ? input.employeeId?.trim() || null : null;
  if (requestedEmployeeId) {
    const taken = await prisma.staffProfile.findUnique({
      where: { employeeId: requestedEmployeeId },
      select: { userId: true },
    });
    if (taken) {
      throw new AppError(
        409,
        "EMPLOYEE_ID_TAKEN",
        "That employee ID is already registered. Leave it blank and the administrator will assign one.",
      );
    }
  }

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: withNameSuffix(fullName, suffix),
      role,
      contactNumber: encryptContact(contactNumber),
      lrn: role === "student" ? lrn ?? null : null,
      status: "pending",
      // Teachers get a staff profile at sign-up so the approving desk can see
      // their employee ID and department alongside the account request.
      ...(isTeacher
        ? {
            staffProfile: {
              create: {
                employeeId: requestedEmployeeId ?? `T-${randomUUID().slice(0, 8)}`,
                department: input.department?.trim() || null,
              },
            },
          }
        : {}),
    },
  });

  void notifyPendingSignup(user);
  return { id: user.id, email: user.email, role: user.role, status: user.status };
}

/**
 * Tell the right desk(s) about a student sign-up awaiting approval. Shared by
 * the password register form and the Google sign-up flow so both route the
 * same way (grade resolved from the roster, both desks when unknown).
 */
export async function notifyPendingSignup(user: {
  id: string;
  fullName: string;
  email: string;
  role?: string;
  lrn?: string | null;
}) {
  try {
    // Teachers self-register too, but they have no LRN/grade band: both
    // accounts desks see the request and either may activate it.
    if (user.role === "subject_teacher" || user.role === "adviser") {
      const staffNotify = {
        sourceTable: "users",
        action: "pending_signup",
        message: `New teacher sign-up: ${user.fullName} (${user.email}) — awaiting administrator approval.`,
        sourceId: user.id,
      };
      await Promise.all([
        fanoutToRole("record_keeper", staffNotify),
        fanoutToRole("registrar", staffNotify),
      ]);
      return;
    }

    const lrn = user.lrn ?? null;
    let gradeLevel: string | null = null;
    if (lrn) {
      const roster = await prisma.studentRoster.findFirst({
        where: { lrn },
        select: { gradeLevel: true },
        orderBy: { schoolYearId: "desc" },
      });
      gradeLevel = roster?.gradeLevel ?? null;
    }
    const isLowerBand =
      gradeLevel === "G7" || gradeLevel === "G8" || gradeLevel === "G9" || gradeLevel === "G10";
    const message =
      user.role === "parent"
        ? `New parent/guardian sign-up: ${user.fullName} (${user.email}) — awaiting approval.`
        : gradeLevel
          ? `New ${gradeLevel} sign-up: ${user.fullName} (LRN ${lrn ?? "—"}) — awaiting approval.`
          : `New sign-up (grade unknown): ${user.fullName} (LRN ${lrn ?? "—"}) — awaiting approval. ` +
            `Check the grade & LRN against school records first.`;
    const notifyInput = {
      sourceTable: "users",
      action: "pending_signup",
      message,
      sourceId: user.id,
    };
    // Unknown grade: the sign-up also surfaces in BOTH pending lists, so
    // alert both desks instead of silently defaulting to the registrar.
    if (!gradeLevel) {
      await Promise.all([
        fanoutToRole("record_keeper", notifyInput),
        fanoutToRole("registrar", notifyInput),
      ]);
    } else {
      await fanoutToRole(isLowerBand ? "record_keeper" : "registrar", notifyInput);
    }
  } catch {
    // Notification fan-out is best-effort; the pending row still exists.
  }
}

export interface LoginInput {
  email: string;
  password: string;
  role: "student" | "staff" | "parent" | "admin";
  /** Public caller IP, when known — feeds the administrator presence globe. */
  ip?: string | null;
}

export async function login(input: LoginInput) {
  const { email, password, role, ip } = input;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");

  const allowedRoles = roleKindToRoles[role] ?? [];
  if (!KNOWN_ROLES.includes(user.role) || !allowedRoles.includes(user.role)) {
    throw new AppError(403, "ROLE_MISMATCH", "This account cannot sign in through this portal.");
  }

  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");

  await recordLogin(user.id, ip ?? null);
  return issueSession(user);
}

/**
 * Mint the app's own session for a user (access + refresh). Shared by password
 * login and Google sign-in so both issue identical tokens/claims.
 */
export function issueSession(user: { id: string; role: string }) {
  const band = gradeBandForRole(user.role);
  const accessToken = signAccess({ sub: user.id, role: user.role, gradeBand: band as never });
  const refreshToken = signRefresh({ sub: user.id });
  return { accessToken, refreshToken, role: user.role };
}

export async function refreshTokens(refreshToken: string, ip?: string | null) {
  let payload: { sub: string };
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    throw new AppError(401, "INVALID_REFRESH", "Invalid refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError(401, "INVALID_REFRESH", "User not found");
  // Refresh is the silent heartbeat of an open tab, so it also refreshes
  // presence — fire-and-forget so token rotation is never slowed down. It is
  // not a sign-in, so it does not count on the login-activity chart.
  void recordLogin(user.id, ip ?? null, false);
  const band = gradeBandForRole(user.role);
  const access = signAccess({ sub: user.id, role: user.role, gradeBand: band as never });
  const refresh = signRefresh({ sub: user.id });
  return { accessToken: access, refreshToken: refresh };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Account not found");
  const ok = await argon2.verify(user.passwordHash, currentPassword);
  if (!ok) throw new AppError(403, "WRONG_PASSWORD", "Current password is incorrect");
  if (currentPassword === newPassword) {
    throw new AppError(400, "SAME_PASSWORD", "New password must be different from the current one");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await argon2.hash(newPassword) },
  });
  await writeAudit({
    userId: user.id,
    actionType: "update",
    sourceTable: "users",
    sourceId: user.id,
    reason: "Account changed own password",
  });
  return { changed: true };
}
