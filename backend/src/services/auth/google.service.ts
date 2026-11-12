import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { getEnv } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { roleKindToRoles } from "../../modules/auth/auth.repository.js";
import { encryptContact } from "../../lib/contact-crypto.js";
import type { Role } from "../../generated/prisma/client.js";
import { issueSession, notifyPendingSignup } from "./session.service.js";
import { withNameSuffix } from "./name.js";
import { recordLogin } from "../presence.service.js";

/**
 * Google sign-in is brokered by Supabase Auth (the app keeps its own JWT). The
 * browser completes the Google round-trip with Supabase, then posts the Supabase
 * access token here. We verify it server-side and never trust an email sent by
 * the client.
 */

export type GooglePortalRole = "student" | "parent" | "staff";

export type GoogleIntent = "login" | "signup";

export type GoogleExchangeResult =
  | { status: "active"; accessToken: string; refreshToken: string; role: Role }
  | { status: "pending" }
  | { status: "needsProfile"; role: Role }
  | { status: "noAccount"; portal: GooglePortalRole };

interface SupabaseUserPayload {
  email?: unknown;
  email_confirmed_at?: unknown;
  confirmed_at?: unknown;
  user_metadata?: { full_name?: unknown; name?: unknown } | null;
  app_metadata?: { provider?: unknown } | null;
}

interface GoogleIdentity {
  email: string;
  fullName: string;
}

async function verifySupabaseToken(supabaseAccessToken: string): Promise<GoogleIdentity> {
  const env = getEnv();
  const base = env.SUPABASE_URL.replace(/\/+$/, "");

  let res: Response;
  try {
    res = await fetch(`${base}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${supabaseAccessToken}`,
      },
    });
  } catch {
    throw new AppError(502, "SUPABASE_UNREACHABLE", "Could not reach the sign-in provider. Try again.");
  }

  if (!res.ok) {
    throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Google sign-in could not be verified. Try again.");
  }

  const payload = (await res.json().catch(() => null)) as SupabaseUserPayload | null;
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) {
    throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Google sign-in returned no email address.");
  }
  if (!payload?.email_confirmed_at && !payload?.confirmed_at) {
    throw new AppError(401, "EMAIL_NOT_VERIFIED", "Your Google email is not verified.");
  }
  // Supabase can host other providers (magic link, etc.); this endpoint is for
  // the Google flow only, so refuse a non-Google identity when it advertises
  // one. Missing app_metadata is tolerated for token shapes without it.
  const provider = payload.app_metadata?.provider;
  if (typeof provider === "string" && provider !== "google") {
    throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Sign in with Google to continue.");
  }

  const fullName =
    [payload.user_metadata?.full_name, payload.user_metadata?.name]
      .find((v): v is string => typeof v === "string" && v.trim().length > 0)
      ?.trim() ?? email.split("@")[0];

  return { email, fullName };
}

function findUserByEmail(email: string) {
  // Case-insensitive: Google may report `Juan@…` while the account was created
  // as `juan@…`; matching them avoids a duplicate pending account.
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    // A pending teacher with no staff profile never submitted the personal
    // details step, so the exchange must send them back to it.
    include: { staffProfile: { select: { employeeId: true } } },
  });
}

export async function exchangeGoogleSession(
  supabaseAccessToken: string,
  portalRole: GooglePortalRole,
  intent: GoogleIntent = "login",
  ip?: string | null,
): Promise<GoogleExchangeResult> {
  const identity = await verifySupabaseToken(supabaseAccessToken);
  const user = await findUserByEmail(identity.email);

  if (!user) {
    // Sign-in never auto-creates an account. The client shows a "no account
    // for this Google session" message with a sign-up link instead.
    if (intent === "login") return { status: "noAccount", portal: portalRole };
    return createPendingGoogleUser(identity, portalRole);
  }

  if (user.status === "suspended") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is suspended. Contact the school office.");
  }

  if (user.status === "pending") {
    // A student who started with Google still owes us the LRN before the
    // registrar can verify them against the roster.
    if (user.role === "student" && !user.lrn) {
      return { status: "needsProfile", role: user.role };
    }
    // Same idea for teachers: no staff profile yet means the details step was
    // never completed, even though the account row may already exist.
    if (
      (user.role === "subject_teacher" || user.role === "adviser") &&
      !user.staffProfile
    ) {
      return { status: "needsProfile", role: user.role };
    }
    return { status: "pending" };
  }

  const allowedRoles = roleKindToRoles[portalRole] ?? [];
  if (!allowedRoles.includes(user.role)) {
    throw new AppError(403, "ROLE_MISMATCH", "This account cannot sign in through this portal.");
  }

  await recordLogin(user.id, ip ?? null);
  const { accessToken, refreshToken } = issueSession(user);
  return { status: "active", accessToken, refreshToken, role: user.role };
}

async function createPendingGoogleUser(
  identity: GoogleIdentity,
  portalRole: GooglePortalRole,
): Promise<GoogleExchangeResult> {
  // Teachers may self-register, but the account row is only created after
  // they submit their personal details on the profile step. Every other staff
  // role is still provisioned by the school.
  if (portalRole === "staff") {
    return { status: "needsProfile", role: "subject_teacher" };
  }

  const role: Role = portalRole === "parent" ? "parent" : "student";
  // OAuth-only accounts never use a password; store a random hash so the column
  // stays required and no one can guess a usable credential.
  const passwordHash = await argon2.hash(randomUUID());

  const user = await prisma.user.create({
    data: {
      email: identity.email,
      passwordHash,
      fullName: identity.fullName,
      role,
      status: "pending",
    },
  });

  await writeAudit({
    userId: user.id,
    actionType: "create",
    sourceTable: "users",
    sourceId: user.id,
    reason: "Google sign-up",
  });

  if (role === "student") {
    // Wait for the LRN so the registrar notification includes it.
    return { status: "needsProfile", role };
  }

  void notifyPendingSignup(user);
  return { status: "pending" };
}

/**
 * Finish a Google student sign-up by attaching the LRN. Re-verifies the
 * Supabase token; the pending user is resolved from its verified email.
 */
export async function completeGoogleSignup(
  supabaseAccessToken: string,
  input: { lrn: string; contactNumber?: string },
) {
  const identity = await verifySupabaseToken(supabaseAccessToken);
  const user = await findUserByEmail(identity.email);

  if (!user) {
    throw new AppError(404, "SIGNUP_NOT_FOUND", "No pending sign-up found. Start again.");
  }
  if (user.status !== "pending" || user.role !== "student") {
    throw new AppError(409, "SIGNUP_NOT_PENDING", "This account is not awaiting student details.");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      lrn: input.lrn.trim(),
      contactNumber: encryptContact(input.contactNumber) ?? user.contactNumber,
    },
  });

  void notifyPendingSignup(updated);
  return { status: "pending" as const };
}

/**
 * Finish a Google teacher sign-up. The account is not created until this step
 * succeeds, so an abandoned Google round-trip never leaves a half-built
 * teacher in the approval queue. Re-verifies the Supabase token and only
 * trusts the email from it.
 */
export async function completeGoogleStaffSignup(
  supabaseAccessToken: string,
  input: {
    fullName: string;
    suffix?: string;
    contactNumber?: string;
    employeeId?: string;
    department?: string;
  },
) {
  const identity = await verifySupabaseToken(supabaseAccessToken);
  const existing = await findUserByEmail(identity.email);
  const displayName = withNameSuffix(input.fullName, input.suffix);
  const requestedEmployeeId = input.employeeId?.trim() || null;
  const employeeId = requestedEmployeeId ?? `T-${randomUUID().slice(0, 8)}`;
  const department = input.department?.trim() || null;

  // Employee IDs are unique across staff profiles. A clash is a data-entry
  // mistake (the field is optional), so tell the teacher to clear it instead
  // of surfacing a raw duplicate-key error.
  if (requestedEmployeeId) {
    const taken = await prisma.staffProfile.findUnique({
      where: { employeeId: requestedEmployeeId },
      select: { userId: true },
    });
    if (taken && taken.userId !== existing?.id) {
      throw new AppError(
        409,
        "EMPLOYEE_ID_TAKEN",
        "That employee ID is already registered. Leave it blank and the administrator will assign one.",
      );
    }
  }

  if (existing) {
    if (existing.status === "active") {
      throw new AppError(409, "ALREADY_ACTIVE", "This Google account is already active. Sign in instead.");
    }
    if (
      existing.status !== "pending" ||
      (existing.role !== "subject_teacher" && existing.role !== "adviser")
    ) {
      throw new AppError(409, "SIGNUP_NOT_PENDING", "This account is not awaiting teacher details.");
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: displayName,
        contactNumber: encryptContact(input.contactNumber) ?? existing.contactNumber,
      },
    });
    await prisma.staffProfile.upsert({
      where: { userId: existing.id },
      update: { ...(requestedEmployeeId ? { employeeId: requestedEmployeeId } : {}), department },
      create: { userId: existing.id, employeeId, department },
    });
    void notifyPendingSignup(updated);
    return { status: "pending" as const };
  }

  // OAuth-only accounts never use a password; store a random hash so the
  // column stays required and no one can guess a usable credential.
  const passwordHash = await argon2.hash(randomUUID());
  const created = await prisma.user.create({
    data: {
      email: identity.email,
      passwordHash,
      fullName: displayName,
      contactNumber: encryptContact(input.contactNumber),
      role: "subject_teacher",
      status: "pending",
      staffProfile: { create: { employeeId, department } },
    },
  });

  await writeAudit({
    userId: created.id,
    actionType: "create",
    sourceTable: "users",
    sourceId: created.id,
    reason: "Google teacher sign-up",
  });

  void notifyPendingSignup(created);
  return { status: "pending" as const };
}
