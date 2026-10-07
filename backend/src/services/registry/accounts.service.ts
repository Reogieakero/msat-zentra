import { prisma } from "../../lib/prisma.js";
import { scopedYearId } from "../../lib/termScope.js";
import type { Request } from "express";
import { gradeLabel } from "../../modules/registry/registry.repository.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import type { RegistryContext } from "./registry.types.js";

export interface BreakdownQuery {
  schoolYearId: string | null;
}

// Accounts breakdown per grade level + section (desk band). The source
// of truth is the advisory student list: every StudentProfile in the band plus
// every active-year StudentRoster enlistment whose LRN has no profile yet
// (matched by LRN, mirroring the adviser roster list).
export async function getAccountBreakdown(ctx: RegistryContext, query: BreakdownQuery) {
  const band = ctx.band;
  const schoolYearId = query.schoolYearId;

  // Roster scope follows the session's active School Year.
  const roster = await prisma.studentRoster.findMany({
    where: { gradeLevel: { in: band }, schoolYearId: schoolYearId ?? "__none__" },
    select: { lrn: true, gradeLevel: true, section: { select: { name: true } } },
  });

  const rosteredLrns = new Set(roster.map((r) => r.lrn));

  // LRNs that actually have a student_profiles/login account, with their status.
  const lrns = roster.map((r) => r.lrn);
  const profiles = await prisma.studentProfile.findMany({
    where: { lrn: { in: lrns } },
    select: { lrn: true, user: { select: { status: true } } },
  });
  const statusByLrn = new Map<string, string>();
  for (const pr of profiles) statusByLrn.set(pr.lrn, pr.user.status);

  // Profiles in the band with no active-year roster entry yet (e.g. just
  // registered, transferred, or seeded without a roster row) still belong
  // to the advisory population, so attribute them by profile grade/section.
  // This keeps the grade chart (advisory headcount) reconciled with the
  // section rosters instead of dropping students missing a roster row.
  const profilesWithoutRoster = await prisma.studentProfile.findMany({
    where: {
      gradeLevel: { in: band },
      ...(rosteredLrns.size > 0
        ? { lrn: { notIn: Array.from(rosteredLrns) } }
        : {}),
    },
    select: {
      gradeLevel: true,
      section: { select: { name: true } },
      user: { select: { status: true } },
    },
  });

  return { roster, statusByLrn, profilesWithoutRoster };
}

export interface BreakdownResultGroup {
  id: string;
  label: string;
  grade: string;
  withAccount: number;
  pending: number;
  noAccount: number;
  total: number;
}

// Registrar variant: full advisory population with noAccount + total buckets;
// suspended counts as withAccount.
export function buildRegistrarBreakdown(
  roster: { lrn: string; gradeLevel: string; section: { name: string } | null }[],
  statusByLrn: Map<string, string>,
  profilesWithoutRoster: { gradeLevel: string; section: { name: string } | null; user: { status: string } }[],
): BreakdownResultGroup[] {
  const groups = new Map<string, Omit<BreakdownResultGroup, "id"> & { total: number }>();
  const ensureGroup = (gradeLevel: string, sectionName?: string | null) => {
    const label = `${gradeLabel(gradeLevel)} · ${sectionName ?? "Unsectioned"}`;
    if (!groups.has(label))
      groups.set(label, { label, grade: gradeLabel(gradeLevel), withAccount: 0, pending: 0, noAccount: 0, total: 0 });
    return groups.get(label)!;
  };
  for (const r of roster) {
    const g = ensureGroup(r.gradeLevel, r.section?.name);
    const status = statusByLrn.get(r.lrn);
    if (status === "active" || status === "suspended") g.withAccount++;
    else if (status === "pending") g.pending++;
    else g.noAccount++;
  }
  for (const p of profilesWithoutRoster) {
    const g = ensureGroup(p.gradeLevel, p.section?.name);
    if (p.user.status === "pending") g.pending++;
    else g.withAccount++;
  }
  return Array.from(groups.values()).map((g, i) => ({
    id: `g${i}-${g.label}`,
    ...g,
    total: g.withAccount + g.pending + g.noAccount,
  }));
}

export interface KeeperBreakdownGroup {
  id: string;
  label: string;
  grade: string;
  withAccount: number;
  pending: number;
}

// Record-keeper variant: roster-driven groups ({ label, grade, withAccount,
// pending }) plus pending sign-ups with no roster entry yet. Only "active"
// counts as withAccount; suspended falls through (legacy shape preserved).
export async function buildRecordKeeperBreakdown(
  band: GradeLevel[],
  roster: { lrn: string; gradeLevel: string; section: { name: string } | null }[],
  statusByLrn: Map<string, string>,
): Promise<KeeperBreakdownGroup[]> {
  const groups = new Map<string, { label: string; grade: string; withAccount: number; pending: number }>();
  for (const r of roster) {
    const label = `${gradeLabel(r.gradeLevel)} · ${r.section?.name ?? "Unsectioned"}`;
    if (!groups.has(label))
      groups.set(label, { label, grade: gradeLabel(r.gradeLevel), withAccount: 0, pending: 0 });
    const g = groups.get(label)!;
    const status = statusByLrn.get(r.lrn);
    if (status === "active") g.withAccount++;
    else if (status === "pending") g.pending++;
  }

  // Pending sign-ups that have no roster entry yet (e.g. just registered) still
  // count toward the pending total shown in the Pending Students table, so the
  // breakdown and the table reconcile. Attribute them by their profile grade/section.
  const rosteredLrns = new Set(roster.map((r) => r.lrn));
  const pendingUsers = await prisma.studentProfile.findMany({
    where: { gradeLevel: { in: band }, user: { status: "pending" }, lrn: { notIn: Array.from(rosteredLrns) } },
    select: { gradeLevel: true, section: { select: { name: true } } },
  });
  for (const p of pendingUsers) {
    const label = `${gradeLabel(p.gradeLevel)} · ${p.section?.name ?? "Unsectioned"}`;
    if (!groups.has(label))
      groups.set(label, { label, grade: gradeLabel(p.gradeLevel), withAccount: 0, pending: 0 });
    groups.get(label)!.pending++;
  }

  return Array.from(groups.values()).map((g, i) => ({ id: `g${i}-${g.label}`, ...g }));
}

export interface StudentsQuery {
  band: GradeLevel[];
}

// Desk-band students for the SF10 upload picker. Returns lrn, name, grade
// level, and section so the desk can target a record. Live from the database.
export async function listBandStudents(band: GradeLevel[]) {
  const rows = await prisma.studentProfile.findMany({
    where: { gradeLevel: { in: band } },
    orderBy: [{ gradeLevel: "asc" }, { lrn: "asc" }],
    select: {
      userId: true,
      lrn: true,
      gradeLevel: true,
      user: { select: { fullName: true } },
      section: { select: { name: true } },
    },
  });
  return {
    students: rows.map((s) => ({
      studentId: s.userId,
      lrn: s.lrn,
      fullName: s.user.fullName,
      gradeLevel: s.gradeLevel,
      section: s.section?.name ?? "—",
    })),
  };
}

export interface AccountsAuditQuery {
  band: GradeLevel[];
  page: number;
  pageSize: number;
}

// Desk-scoped audit trail for account approvals. Restricted to the band:
// entries are limited to account_approval actions on users that have
// a StudentProfile in the desk band. The acting user and the affected
// student are both resolved so the desk can see who did what to whom.
// No cache: this reflects live auditor state.
export async function getAccountsAudit(query: AccountsAuditQuery) {
  const { band, page, pageSize } = query;
  const skip = (page - 1) * pageSize;

  // Affected users that belong to the desk band.
  const bandProfiles = await prisma.studentProfile.findMany({
    where: { gradeLevel: { in: band } },
    select: { userId: true },
  });
  const bandUserIds = bandProfiles.map((p) => p.userId);

  const where: Record<string, unknown> = {
    actionType: "account_approval",
    sourceTable: "users",
    sourceId: { in: bandUserIds },
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { email: true, role: true, fullName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Resolve the affected student's details from the source user id.
  const affectedIds = rows
    .map((r) => r.sourceId)
    .filter((id): id is string => Boolean(id));
  const affected = await prisma.user.findMany({
    where: { id: { in: affectedIds } },
    select: {
      id: true,
      fullName: true,
      status: true,
      studentProfile: { select: { lrn: true, gradeLevel: true, section: { select: { name: true } } } },
    },
  });
  const affectedByUserId = new Map(affected.map((u) => [u.id, u]));

  const entries = rows.map((r) => {
    const a = affectedByUserId.get(r.sourceId ?? "");
    const approved = (r.newValue as { status?: string } | null)?.status === "active"
      || (a?.status === "active");
    return {
      id: r.id,
      timestamp: r.createdAt.toISOString(),
      actor: r.user?.fullName ?? r.user?.email ?? "system",
      actorRole: r.user?.role ?? "system",
      studentName: a?.fullName ?? (r.reason || "Student"),
      lrn: a?.studentProfile?.lrn ?? null,
      gradeLevel: a?.studentProfile?.gradeLevel ?? null,
      section: a?.studentProfile?.section?.name ?? null,
      action: approved ? "approve" : "reject",
      reason: approved ? "Account activated" : (r.reason ?? "Account rejected"),
    };
  });

  return { entries, total, page, pageSize };
}

export async function resolveScopedYearId(req: Request, termScopeYearId: string | null) {
  return termScopeYearId ?? (await scopedYearId(req));
}
