import argon2 from "argon2";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { signAccess, signRefresh, verifyRefresh } from "../../lib/jwt.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutToRole } from "../../lib/notify.js";
import {
  KNOWN_ROLES,
  gradeBandForRole,
  roleKindToRoles,
} from "../../modules/auth/auth.repository.js";

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role: "student" | "parent" | "subject_teacher" | "adviser";
  contactNumber?: string;
  lrn?: string;
}

export async function register(input: RegisterInput) {
  const { email, password, fullName, role, contactNumber, lrn } = input;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "EMAIL_EXISTS", "Email already registered");

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role, contactNumber, lrn: role === "student" ? lrn ?? null : null, status: "pending" },
  });

  if (role === "student") {
    void (async () => {
      try {
        let gradeLevel: string | null = null;
        if (lrn) {
          const roster = await prisma.studentRoster.findFirst({
            where: { lrn },
            select: { gradeLevel: true },
            orderBy: { schoolYearId: "desc" },
          });
          gradeLevel = roster?.gradeLevel ?? null;
        }
        const bandRole =
          gradeLevel === "G7" || gradeLevel === "G8" || gradeLevel === "G9" || gradeLevel === "G10"
            ? "record_keeper"
            : "registrar";
        const gradeLabel = gradeLevel === "G11" ? "G11" : gradeLevel === "G12" ? "G12" : gradeLevel ?? "unknown grade";
        await fanoutToRole(bandRole, {
          sourceTable: "users",
          action: "pending_signup",
          message: `New ${gradeLabel} sign-up: ${fullName} (LRN ${lrn ?? "—"}) — awaiting approval.`,
          sourceId: user.id,
        });
      } catch {

      }
    })();
  }
  return { id: user.id, email: user.email, role: user.role, status: user.status };
}

export interface LoginInput {
  email: string;
  password: string;
  role: "student" | "staff" | "parent";
}

export async function login(input: LoginInput) {
  const { email, password, role } = input;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");

  const allowedRoles = roleKindToRoles[role] ?? [];
  if (!KNOWN_ROLES.includes(user.role) || !allowedRoles.includes(user.role)) {
    throw new AppError(403, "ROLE_MISMATCH", "This account cannot sign in through this portal.");
  }

  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");

  const band = gradeBandForRole(user.role);
  const access = signAccess({ sub: user.id, role: user.role, gradeBand: band as never });
  const refresh = signRefresh({ sub: user.id });
  return { accessToken: access, refreshToken: refresh, role: user.role };
}

export async function refreshTokens(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    throw new AppError(401, "INVALID_REFRESH", "Invalid refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError(401, "INVALID_REFRESH", "User not found");
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
