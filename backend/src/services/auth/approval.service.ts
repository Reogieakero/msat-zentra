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

  let provisionRoster: { gradeLevel: GradeLevel; sectionId: string } | null = null;
  let carryoverRosterIds: string[] = [];
  if (target.role === "student" && target.lrn) {

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
        provisionRoster = roster;

        carryoverRosterIds = (
          await prisma.studentRoster.findMany({
            where: { lrn: target.lrn },
            select: { id: true },
          })
        ).map((r) => r.id);
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: target.id },
      data: { status: "active", approvedBy: ctx.userId, approvedAt: new Date() },
    });
    if (provisionRoster && target.lrn) {
      await tx.studentProfile.create({
        data: {
          userId: target.id,
          lrn: target.lrn,
          gradeLevel: provisionRoster.gradeLevel,
          sectionId: provisionRoster.sectionId,
        },
      });
      if (carryoverRosterIds.length > 0) {
        const carry = { studentId: target.id, rosterId: null };
        await tx.studentGrade.updateMany({
          where: { rosterId: { in: carryoverRosterIds } },
          data: carry,
        });
        await tx.finalGrade.updateMany({
          where: { rosterId: { in: carryoverRosterIds } },
          data: carry,
        });
        await tx.attendanceRecord.updateMany({
          where: { rosterId: { in: carryoverRosterIds } },
          data: carry,
        });
        await tx.anecdotalRecord.updateMany({
          where: { rosterId: { in: carryoverRosterIds } },
          data: carry,
        });
        await tx.referral.updateMany({
          where: { rosterId: { in: carryoverRosterIds } },
          data: carry,
        });
      }
    }
    return u;
  });

  await writeAudit({
    userId: ctx.userId, actionType: "account_approval",
    sourceTable: "users", sourceId: updated.id, reason: "Account activation",
  });

  await invalidateTags(APPROVAL_TAGS);
  await fanoutNotification({
    userId: updated.id, sourceTable: "users", action: "approve",
    message: "Your account has been approved.",
  });

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

  await invalidateTags(APPROVAL_TAGS);
  void (async () => {
    try {
      await fanoutNotification({
        userId: ctx.userId, sourceTable: "users", action: "reject_self",
        message: `You rejected ${target.fullName} (LRN ${target.lrn ?? "—"}).`,
        sourceId: updated.id,
      });
    } catch {

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

export async function listPending(query: PendingQuery) {
  const { band, roleFilter, q, page, pageSize, hasPaging } = query;

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
        if (!band.includes(roster.gradeLevel)) continue;
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
