import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { GRADE_BAND_7_10 } from "../../lib/roles.js";
import type { GradeLevel } from "../../generated/prisma/client.js";

export interface MyAccessRequest {
  id: string;
  sectionId: string;
  section: string;
  gradeLevel: GradeLevel;
  reason: string;
  requestedLrns: string[];
  status: "pending" | "approved" | "denied";
  decisionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  total: number;
  has: number;
  missing: number;
}

export interface VerificationRecord {
  id: string;
  source: string;
  status: string;
  fileUrl: string | null;
  verifiedAt: string | null;
  validatedAt: string | null;
  currentVersion: number;
}

export interface HasRow {
  lrn: string;
  name: string;
  mascot: string | null;
  hasAccount: boolean;
  gradeLevel: string;
  section: string;
  sf10Status: "verified" | "validated" | "pending";
  /** Per-student grant (whole-request approval grants every row). */
  approved: boolean;
  /** ISO timestamp of the per-student grant, if granted individually. */
  approvedAt: string | null;
  record: VerificationRecord | null;
}

export interface MissingRow {
  lrn: string;
  name: string;
  mascot: string | null;
  hasAccount: boolean;
  gradeLevel: string;
  section: string;
}

function sf10StatusOf(status: string): HasRow["sf10Status"] {
  if (status === "released") return "validated";
  if (status === "available") return "verified";
  return "pending";
}

/** Pure helper (unit-tested): trim, drop empties, dedupe, cap at 200 picks. */
export function normalizePicks(input?: string[]): string[] {
  return [...new Set((input ?? []).map((l) => l.trim()).filter(Boolean))].slice(0, 200);
}

/** Pure helper (unit-tested): split LRN-matched rows into has / missing. */
export function partitionVerification(
  rows: Array<{ lrn: string; record: unknown | null }>,
): { has: number; missing: number; total: number } {
  let has = 0;
  for (const r of rows) if (r.record) has += 1;
  return { has, missing: rows.length - has, total: rows.length };
}

async function countAdvisees(
  sectionId: string,
  onlyLrns?: Set<string>,
): Promise<{ total: number; has: number; missing: number }> {
  const rows = await matchAdvisoryLrns(sectionId, onlyLrns ?? new Set(), "");
  const has = rows.filter((r) => r.rec).length;
  return { total: rows.length, has, missing: rows.length - has };
}

interface LrnMatch {
  lrn: string;
  name: string;
  mascot: string | null;
  hasAccount: boolean;
  gradeLevel: string;
  section: string;
  rec: {
    id: string;
    source: string;
    status: string;
    uploadedFileUrl: string | null;
    verifiedAt: Date | null;
    validatedAt: Date | null;
    currentVersion: number;
  } | null;
}

/**
 * LRN-first matching: advisory LRNs come from the section (profiles + roster),
 * but the SF10 lookup runs by LRN across ALL profiles — a record counts even
 * when the profile sits in another section or none. Display identity prefers
 * the advisory-section name.
 */
async function matchAdvisoryLrns(
  sectionId: string,
  onlyLrns: Set<string>,
  sectionName: string,
): Promise<LrnMatch[]> {
  const [sectionProfiles, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: { lrn: true, mascot: true, gradeLevel: true, user: { select: { fullName: true } } },
      orderBy: { lrn: "asc" },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { lrn: true, fullName: true, mascot: true, gradeLevel: true },
      orderBy: { lrn: "asc" },
    }),
  ]);

  const identity = new Map<string, { name: string; mascot: string | null; gradeLevel: string }>();
  for (const p of sectionProfiles) {
    identity.set(p.lrn, { name: p.user.fullName, mascot: p.mascot ?? null, gradeLevel: String(p.gradeLevel) });
  }
  for (const r of rosterEntries) {
    if (!identity.has(r.lrn)) {
      identity.set(r.lrn, { name: r.fullName, mascot: r.mascot ?? null, gradeLevel: String(r.gradeLevel) });
    }
  }

  let lrns = [...identity.keys()];
  if (onlyLrns.size > 0) lrns = lrns.filter((l) => onlyLrns.has(l));
  if (lrns.length === 0) return [];

  const global = await prisma.studentProfile.findMany({
    where: { lrn: { in: lrns } },
    select: {
      lrn: true,
      gradeLevel: true,
      user: { select: { fullName: true } },
      sf10Records: {
        select: {
          id: true,
          source: true,
          status: true,
          uploadedFileUrl: true,
          verifiedAt: true,
          validatedAt: true,
          currentVersion: true,
        },
      },
    },
  });
  const byGlobal = new Map(global.map((g) => [g.lrn, g]));

  return lrns.sort().map((lrn) => {
    const ident = identity.get(lrn)!;
    const g = byGlobal.get(lrn);
    return {
      lrn,
      name: ident.name ?? g?.user.fullName ?? lrn,
      mascot: ident.mascot,
      hasAccount: !!g,
      gradeLevel: ident.gradeLevel ?? (g ? String(g.gradeLevel) : "—"),
      section: sectionName,
      rec: g?.sf10Records[0] ?? null,
    };
  });
}

/** LRNs enlisted in a section (profiles + roster-only), for validating picks. */
async function sectionLrns(sectionId: string): Promise<Set<string>> {
  const [profiles, roster] = await Promise.all([
    prisma.studentProfile.findMany({ where: { sectionId }, select: { lrn: true } }),
    prisma.studentRoster.findMany({ where: { sectionId }, select: { lrn: true } }),
  ]);
  return new Set([...profiles.map((p) => p.lrn), ...roster.map((r) => r.lrn)]);
}

export async function listMyRequests(userId: string): Promise<{ requests: MyAccessRequest[] }> {
  const rows = await prisma.adviserSf10AccessRequest.findMany({
    where: { adviserId: userId },
    include: { section: { select: { id: true, name: true } } },
    orderBy: [{ requestedAt: "desc" }],
  });
  const requests: MyAccessRequest[] = [];
  for (const r of rows) {
    const picked = new Set(r.requestedLrns ?? []);
    const counts = r.sectionId
      ? await countAdvisees(r.sectionId, picked)
      : { total: 0, has: 0, missing: 0 };
    requests.push({
      id: r.id,
      sectionId: r.sectionId,
      section: r.section?.name ?? "Unsectioned",
      gradeLevel: r.gradeLevel as GradeLevel,
      reason: r.reason,
      requestedLrns: [...picked],
      status: r.status as MyAccessRequest["status"],
      decisionReason: r.decisionReason,
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      total: counts.total,
      has: counts.has,
      missing: counts.missing,
    });
  }
  return { requests };
}

export async function createAccessRequest(
  userId: string,
  sectionId: string,
  reason: string,
  studentLrns?: string[],
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new AppError(400, "BAD_REQUEST", "Reason is required");
  if (trimmedReason.length > 500)
    throw new AppError(400, "BAD_REQUEST", "Reason must be 500 characters or fewer");

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true, gradeLevel: true, adviserId: true, schoolYearId: true },
  });
  if (!section) throw new AppError(404, "NOT_FOUND", "Section not found");
  if (section.adviserId !== userId)
    throw new AppError(403, "FORBIDDEN", "You can only request access for your own advisory section");

  // Checkbox picks must be advisory LRNs of this section (profiles or roster).
  const picked = normalizePicks(studentLrns);
  if (picked.length > 0) {
    const valid = await sectionLrns(sectionId);
    const stray = picked.filter((l) => !valid.has(l));
    if (stray.length > 0)
      throw new AppError(400, "BAD_REQUEST", "Selected students must belong to your advisory section");
  }

  // Teachers may request anytime, even with a pending or approved request
  // on file — every submit creates a new request for the desk to decide.

  const adviser = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  const created = await prisma.adviserSf10AccessRequest.create({
    data: {
      adviserId: userId,
      sectionId,
      gradeLevel: section.gradeLevel as GradeLevel,
      reason: trimmedReason,
      requestedLrns: picked,
    },
    select: { id: true, status: true, requestedAt: true },
  });

  await writeAudit({
    userId,
    actionType: "create",
    sourceTable: "adviser_sf10_access_requests",
    sourceId: created.id,
    reason: `SF10 access requested for ${section.name} (${picked.length > 0 ? `${picked.length} selected` : "whole section"})`,
  });

  const counts = await countAdvisees(sectionId, new Set(picked));
  const deskRole = (GRADE_BAND_7_10 as string[]).includes(String(section.gradeLevel))
    ? "record_keeper"
    : "registrar";
  await fanoutToRole(deskRole, {
    sourceTable: "adviser_sf10_access_requests",
    action: "create",
    message:
      `SF10 access requested: Adviser ${adviser?.fullName ?? "Unknown"} — ` +
      `${section.name} (${counts.total} advisees) — ${trimmedReason}`,
    sourceId: created.id,
    excludeUserId: userId,
  });
  await fanoutNotification({
    userId,
    sourceTable: "adviser_sf10_access_requests",
    action: "create",
    message: `Your SF10 access request for ${section.name} was submitted for verification.`,
    sourceId: created.id,
  });

  return {
    id: created.id,
    status: created.status,
    requestedAt: created.requestedAt.toISOString(),
  };
}

export interface VerificationResult {
  requestId: string;
  section: string;
  gradeLevel: string;
  status: string;
  requestedLrns: string[];
  canDownload: boolean;
  canEdit: boolean;
  summary: { total: number; has: number; missing: number };
  hasSf10: HasRow[];
  missingSf10: MissingRow[];
}

export async function getMyVerification(userId: string, requestId: string): Promise<VerificationResult> {
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id: requestId },
    include: { section: { select: { id: true, name: true } } },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (request.adviserId !== userId)
    throw new AppError(403, "FORBIDDEN", "Not your access request");

  const sectionId = request.sectionId;
  const wholeApproved = request.status === "approved";
  const approvedLrns = new Set(request.approvedLrns ?? []);
  const approvedLrnAt =
    request.approvedLrnAt && typeof request.approvedLrnAt === "object" && !Array.isArray(request.approvedLrnAt)
      ? (request.approvedLrnAt as Record<string, unknown>)
      : {};
  // Empty picks = whole section (pre-selection behavior).
  const picked = new Set(request.requestedLrns ?? []);
  const sectionName = request.section?.name ?? "Unsectioned";

  const rows = await matchAdvisoryLrns(sectionId, picked, sectionName);
  const hasSf10: HasRow[] = [];
  const missingSf10: MissingRow[] = [];

  for (const row of rows) {
    if (row.rec) {
      const rec = row.rec;
      const granted = wholeApproved || approvedLrns.has(row.lrn);
      const at = approvedLrnAt[row.lrn];
      hasSf10.push({
        lrn: row.lrn,
        name: row.name,
        mascot: row.mascot,
        hasAccount: row.hasAccount,
        gradeLevel: row.gradeLevel,
        section: row.section,
        sf10Status: sf10StatusOf(String(rec.status)),
        approved: granted,
        approvedAt:
          typeof at === "string" && at
            ? at
            : wholeApproved && request.decidedAt
              ? request.decidedAt.toISOString()
              : null,
        record: {
          id: rec.id,
          source: String(rec.source),
          status: String(rec.status),
          fileUrl: granted ? (rec.uploadedFileUrl ?? null) : null,
          verifiedAt: rec.verifiedAt?.toISOString() ?? null,
          validatedAt: rec.validatedAt?.toISOString() ?? null,
          currentVersion: rec.currentVersion,
        },
      });
    } else {
      missingSf10.push({
        lrn: row.lrn,
        name: row.name,
        mascot: row.mascot,
        hasAccount: row.hasAccount,
        gradeLevel: row.gradeLevel,
        section: row.section,
      });
    }
  }

  return {
    requestId: request.id,
    section: request.section?.name ?? "Unsectioned",
    gradeLevel: String(request.gradeLevel),
    status: request.status,
    requestedLrns: [...picked],
    canDownload: wholeApproved || approvedLrns.size > 0,
    canEdit: wholeApproved || approvedLrns.size > 0,
    summary: { total: hasSf10.length + missingSf10.length, has: hasSf10.length, missing: missingSf10.length },
    hasSf10,
    missingSf10,
  };
}
