import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import type { RegistryContext } from "./registry.types.js";

export interface AccessListQuery {
  band: GradeLevel[];
  /** "section" filters on the section's grade (registrar); "request" filters on the request row grade (record keeper). */
  scope: "section" | "request";
  status?: string;
}

// List adviser SF10 access requests (desk band only). Server-side filter:
// band-scoped requests. Optional ?status filters by request status.
// Live from the database — no mocked data.
export async function listAccessRequests(query: AccessListQuery) {
  const { band, scope, status: statusFilter } = query;
  const where =
    scope === "section"
      ? {
          section: { gradeLevel: { in: band } },
          ...(statusFilter ? { status: statusFilter } : {}),
        }
      : {
          gradeLevel: { in: band },
          ...(statusFilter ? { status: statusFilter } : {}),
        };

  const rows = await prisma.adviserSf10AccessRequest.findMany({
    where: where as never,
    include: {
      adviser: {
        select: {
          id: true,
          fullName: true,
          staffProfile: { select: { employeeId: true } },
        },
      },
      section: { select: { name: true, ...(scope === "request" ? { gradeLevel: true } : {}) } },
    },
    orderBy: [{ requestedAt: "desc" }],
  });

  // Single batched advisee read across all request sections (was one
  // findMany per request). Grouped in memory by sectionId.
  const sectionIds = [...new Set(rows.map((r) => r.sectionId).filter((id): id is string => !!id))];
  const allStudents =
    sectionIds.length > 0
      ? await prisma.studentProfile.findMany({
          where: {
            sectionId: { in: sectionIds },
            ...(scope === "request" ? { gradeLevel: { in: band } } : {}),
          },
          select: {
            sectionId: true,
            lrn: true,
            user: { select: { fullName: true } },
            sf10Records: { select: { status: true } },
          },
          orderBy: { lrn: "asc" },
        })
      : [];
  const studentsBySection = new Map<string, typeof allStudents>();
  for (const s of allStudents) {
    const key = s.sectionId ?? "";
    const list = studentsBySection.get(key) ?? [];
    list.push(s);
    studentsBySection.set(key, list);
  }

  const requests = rows.map((r) => {
    const students = studentsBySection.get(r.sectionId ?? "") ?? [];
    const affectedAdvisees = students.map((s) => {
      const sf10 = s.sf10Records[0]?.status;
      return {
        lrn: s.lrn,
        name: s.user.fullName,
        gradeLevel: r.gradeLevel,
        section: r.section.name,
        sf10Status:
          sf10 === "released"
            ? "validated"
            : sf10 === "available"
              ? "verified"
              : "pending",
      };
    });
    return {
      id: r.id,
      adviserId: r.adviserId,
      adviserName: r.adviser?.fullName ?? "Unknown adviser",
      employeeId: r.adviser?.staffProfile?.employeeId ?? "—",
      section: r.section?.name ?? "Unsectioned",
      gradeLevel: r.gradeLevel,
      reason: r.reason,
      status: r.status,
      decisionReason: r.decisionReason,
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      affectedAdvisees,
    };
  });

  return { requests };
}

export interface AccessRecordsQuery {
  requestId: string;
  band: GradeLevel[];
  /** Whether to enforce the band on the request row + student scope (record keeper) or scope students to the request grade (registrar). */
  enforceBand: boolean;
}

// SF10 records for the advisees of a given access request. Used by the
// review modal before approving, so the desk can confirm each learner's SF10
// record is present and correct. Returns the real Sf10Record fields (status,
// source, file URL, verified/validated dates, version) joined to the student.
export async function getAccessRecords(query: AccessRecordsQuery) {
  const { requestId: id, band, enforceBand } = query;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id },
    select: { id: true, sectionId: true, gradeLevel: true },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }

  const students = await prisma.studentProfile.findMany({
    where: enforceBand
      ? { sectionId: request.sectionId, gradeLevel: { in: band } }
      : { sectionId: request.sectionId, gradeLevel: request.gradeLevel },
    select: {
      lrn: true,
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
    orderBy: { lrn: "asc" },
  });

  const records = students.map((s) => {
    const rec = s.sf10Records[0];
    return {
      lrn: s.lrn,
      name: s.user.fullName,
      record: rec
        ? {
            id: rec.id,
            source: rec.source,
            status: rec.status,
            fileUrl: rec.uploadedFileUrl,
            verifiedAt: rec.verifiedAt?.toISOString() ?? null,
            validatedAt: rec.validatedAt?.toISOString() ?? null,
            currentVersion: rec.currentVersion,
          }
        : null,
    };
  });

  return { requestId: id, records };
}

export interface DecideAccessInput {
  requestId: string;
  approved: boolean;
  denyReason?: string;
  /** Enforce the desk band on the request row (record keeper only). */
  enforceBand: boolean;
  /** Fallback deny reason copy when the caller sends none. */
  denyDefault: string;
}

// Decide (approve or deny) an adviser SF10 access request. Sets status +
// decision, writes an audit entry, and fans out a notification to the
// requesting adviser. 409 if the request is already decided.
export async function decideAccess(
  ctx: RegistryContext,
  input: DecideAccessInput,
) {
  const { requestId, approved, denyReason, enforceBand, denyDefault } = input;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id: requestId },
    include: {
      adviser: { select: { fullName: true } },
      section: { select: { name: true, ...(enforceBand ? { gradeLevel: true } : {}) } },
    },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !ctx.band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  if (request.status !== "pending")
    throw new AppError(409, "ALREADY_DECIDED", "Request already processed");

  const reason = approved ? null : (denyReason ?? denyDefault);

  const updated = await prisma.adviserSf10AccessRequest.update({
    where: { id: requestId },
    data: {
      status: approved ? "approved" : "denied",
      decidedBy: ctx.userId,
      decidedAt: new Date(),
      decisionReason: reason,
    },
    include: { section: { select: { name: true } } },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: approved ? "sf10_access_grant" : "sf10_access_deny",
    sourceTable: "adviser_sf10_access_requests",
    sourceId: updated.id,
    reason: approved ? "SF10 read access granted" : (reason ?? undefined),
  });

  await fanoutNotification({
    userId: updated.adviserId,
    sourceTable: "adviser_sf10_access_requests",
    action: approved ? "approve" : "deny",
    message: approved
      ? `Your request for SF10 read access (${updated.section.name}) was approved.`
      : `Your request for SF10 read access (${updated.section.name}) was denied.`,
    sourceId: updated.id,
  });

  // Own-bell receipt: the acting desk's badge bumps live (their echo
  // toast is suppressed client-side — the mutation toast already confirmed it).
  await fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adviser_sf10_access_requests",
    action: "decide_self",
    message: approved
      ? `You granted ${request.adviser?.fullName ?? "the adviser"} (${updated.section.name}) SF10 read access.`
      : `You denied ${request.adviser?.fullName ?? "the adviser"} (${updated.section.name}) SF10 read access.`,
    sourceId: updated.id,
  });

  return {
    id: updated.id,
    status: updated.status,
    decisionReason: updated.decisionReason,
    decidedAt: updated.decidedAt?.toISOString() ?? undefined,
  };
}
