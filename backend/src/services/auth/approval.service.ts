import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { invalidateTags } from "../../lib/cache.js";
import type { GradeLevel, Role } from "../../generated/prisma/client.js";
import type { AuthContext } from "./auth.types.js";

const APPROVAL_TAGS = [
  "registrar",
  "registrar-accounts",
  "registrar-overview",
  "record-keeper",
  "academics",
  "overview",
  "principal",
  "teacher",
];

export async function approveAccount(ctx: AuthContext, targetUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  if (target.status === "active") throw new AppError(409, "ALREADY_ACTIVE", "User already active");

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { status: "active", approvedBy: ctx.userId, approvedAt: new Date() },
  });

  // Auto-provision the student profile from the official roster so an
  // approved student immediately lands in their section — and therefore in
  // section counts, subject lists, and gradebooks — instead of remaining
  // invisible until a profile exists. Roster is the canonical source for
  // grade level + section, matching the pending list.
  if (target.role === "student" && target.lrn) {
    // A provisioned placeholder (auto-created by another desk from the
    // roster, e.g. ADM) already owns this LRN — adopting it needs a
    // human identity decision, so stop here instead of crashing on the
    // unique constraint.
    const lrnTaken = await prisma.studentProfile.findUnique({
      where: { lrn: target.lrn },
      select: { userId: true },
    });
    if (lrnTaken && lrnTaken.userId !== target.id) {
      throw new AppError(
        409,
        "LRN_ALREADY_PROVISIONED",
        "This LRN already has a learner record created by another desk. Ask an administrator to merge the accounts before approving.",
      );
    }
    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId: target.id },
      select: { userId: true },
    });
    if (!existingProfile) {
      const roster = await prisma.studentRoster.findFirst({
        where: { lrn: target.lrn },
        orderBy: { schoolYearId: "desc" },
        select: { gradeLevel: true, sectionId: true },
      });
      if (roster) {
        await prisma.studentProfile.create({
          data: {
            userId: target.id,
            lrn: target.lrn,
            gradeLevel: roster.gradeLevel,
            sectionId: roster.sectionId,
          },
        });
        // Carry over everything recorded under roster enlistments for this
        // LRN (scores, finals, attendance, anecdotal, referrals) onto the
        // new profile. The profile is brand-new so no unique conflicts
        // are possible.
        const rosterIds = (
          await prisma.studentRoster.findMany({
            where: { lrn: target.lrn },
            select: { id: true },
          })
        ).map((r) => r.id);
        if (rosterIds.length > 0) {
          await prisma.$transaction([
            prisma.studentGrade.updateMany({
              where: { rosterId: { in: rosterIds } },
              data: { studentId: target.id, rosterId: null },
            }),
            prisma.finalGrade.updateMany({
              where: { rosterId: { in: rosterIds } },
              data: { studentId: target.id, rosterId: null },
            }),
            prisma.attendanceRecord.updateMany({
              where: { rosterId: { in: rosterIds } },
              data: { studentId: target.id, rosterId: null },
            }),
            prisma.anecdotalRecord.updateMany({
              where: { rosterId: { in: rosterIds } },
              data: { studentId: target.id, rosterId: null },
            }),
            prisma.referral.updateMany({
              where: { rosterId: { in: rosterIds } },
              data: { studentId: target.id, rosterId: null },
            }),
          ]);
        }
      }
    }
  }

  await writeAudit({
    userId: ctx.userId, actionType: "account_approval",
    sourceTable: "users", sourceId: updated.id, reason: "Account activation",
  });
  // Approvals change enrollment composition — refresh cached headcounts.
  await invalidateTags(APPROVAL_TAGS);
  await fanoutNotification({
    userId: updated.id, sourceTable: "users", action: "approve",
    message: "Your account has been approved.",
  });
  // Own-bell receipt: the acting registrar/record keeper also gets an
  // inbox row so their badge bumps live (their echo toast is suppressed
  // client-side — the mutation toast already confirmed it).
  void (async () => {
    try {
      const profile = target.lrn
        ? await prisma.studentProfile.findUnique({
            where: { lrn: target.lrn },
            select: { gradeLevel: true },
          })
        : null;
      const grade = profile?.gradeLevel ?? "unknown grade";
      await fanoutNotification({
        userId: ctx.userId, sourceTable: "users", action: "approve_self",
        message: `You approved ${target.fullName} (LRN ${target.lrn ?? "—"}) — ${grade}.`,
        sourceId: updated.id,
      });
    } catch {
      // Best-effort only.
    }
  })();
  return { id: updated.id, status: updated.status };
}

export async function rejectAccount(ctx: AuthContext, targetUserId: string, reason: string) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  if (target.status !== "pending")
    throw new AppError(409, "NOT_PENDING", "Only pending accounts can be rejected");

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { status: "suspended", approvedBy: ctx.userId, approvedAt: new Date() },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "account_approval",
    sourceTable: "users",
    sourceId: updated.id,
    reason,
    oldValue: { status: "pending" },
    newValue: { status: "suspended" },
  });
  await fanoutNotification({
    userId: updated.id,
    sourceTable: "users",
    action: "reject",
    message: "Your account request was not approved.",
  });
  // Own-bell receipt + cache refresh (this endpoint previously skipped
  // invalidation): the actor's badge bumps live with no refresh.
  await invalidateTags(APPROVAL_TAGS);
  void (async () => {
    try {
      await fanoutNotification({
        userId: ctx.userId, sourceTable: "users", action: "reject_self",
        message: `You rejected ${target.fullName} (LRN ${target.lrn ?? "—"}).`,
        sourceId: updated.id,
      });
    } catch {
      // Best-effort only.
    }
  })();
  return { id: updated.id, status: updated.status };
}

export interface PendingQuery {
  band: GradeLevel[];
  roleFilter: string;
  q: string;
  page?: number;
  pageSize?: number;
  hasPaging: boolean;
}

// List pending account requests. Grade-band enforcement is server-side via
// the student profile gradeLevel. Optional ?role filters by account role
// (defaults student).
export async function listPending(query: PendingQuery) {
  const { band, roleFilter, q, page, pageSize, hasPaging } = query;
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

  // Single batched roster read for bare sign-ups (was N sequential
  // findFirst calls). Latest school year wins per LRN.
  const bareLrns = [...new Set(bare.map((u) => u.lrn).filter((l): l is string => !!l))];
  const bareRosters =
    bareLrns.length > 0
      ? await prisma.studentRoster.findMany({
          where: { lrn: { in: bareLrns } },
          select: {
            lrn: true,
            gradeLevel: true,
            schoolYearId: true,
            section: { select: { name: true } },
          },
        })
      : [];
  const latestBareRoster = new Map<string, (typeof bareRosters)[number]>();
  for (const r of bareRosters) {
    const prev = latestBareRoster.get(r.lrn);
    if (!prev || r.schoolYearId > prev.schoolYearId) latestBareRoster.set(r.lrn, r);
  }

  for (const u of bare) {
    let gradeLevel: string = "—";
    let section = "—";
    if (u.lrn) {
      const roster = latestBareRoster.get(u.lrn);
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

  // Server search + pagination (strict-15 standard): ?q= filters the merged
  // list by name/LRN/section/email, then ?page=&pageSize= slice it.
  // Absent params return the full list (legacy clients).
  const unfilteredTotal = students.length;
  const matched = q
    ? students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.lrn.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q),
      )
    : students;
  if (!hasPaging) {
    return { students };
  }
  const safePage = Math.max(1, page !== undefined && Number.isFinite(page) ? Math.floor(page) : 1);
  const safeSize = Math.min(Math.max(1, pageSize !== undefined && Number.isFinite(pageSize) ? Math.floor(pageSize) : 15), 15);
  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const clamped = Math.min(safePage, totalPages);
  return {
    students: matched.slice((clamped - 1) * safeSize, clamped * safeSize),
    total,
    unfilteredTotal,
    page: clamped,
    pageSize: safeSize,
  };
}
