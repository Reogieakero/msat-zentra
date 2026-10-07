import { prisma } from "../../lib/prisma.js";
import { MAX_PAGE_SIZE, resolveSourceLabels } from "../../modules/audit/audit.repository.js";

export interface AuditListQuery {
  actionType?: string;
  sourceTable?: string;
  userId?: string;
  actorRole?: string;
  from?: string;
  to?: string;
  q?: string;
  page: string;
  pageSize: string;
}

function buildWhere(query: Omit<AuditListQuery, "page" | "pageSize">) {
  const { actionType, sourceTable, userId, actorRole, from, to, q } = query;
  const where: any = {};
  if (actionType) where.actionType = String(actionType);
  if (sourceTable) where.sourceTable = String(sourceTable);
  if (userId) where.userId = String(userId);

  const and: any[] = [];
  if (actorRole) {
    and.push({ user: { role: String(actorRole) } });
  }
  if (from || to) {
    const createdAt: any = {};
    if (from) createdAt.gte = new Date(String(from));
    if (to) createdAt.lte = new Date(String(to));
    and.push({ createdAt });
  }
  if (q) {
    const term = String(q).trim();
    and.push({
      OR: [
        { reason: { contains: term, mode: "insensitive" } },
        { sourceTable: { contains: term, mode: "insensitive" } },
        { sourceId: { contains: term, mode: "insensitive" } },
        { user: { email: { contains: term, mode: "insensitive" } } },
      ],
    });
  }
  if (and.length) where.AND = and;
  return where;
}

// School-wide audit log for the Principal. Supports filtering, search, and
// pagination. actorRole is derived from the acting user's role.
export async function listAudit(query: AuditListQuery) {
  const { page = "1", pageSize = "20" } = query;
  const where = buildWhere(query);

  const take = Math.min(parseInt(pageSize, 10) || 20, MAX_PAGE_SIZE);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { user: { select: { email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const baseEntries = rows.map((r) => ({
    id: r.id,
    timestamp: r.createdAt.toISOString(),
    user: r.user?.email ?? "system",
    actorRole: r.user?.role ?? "system",
    actionType: r.actionType,
    sourceTable: r.sourceTable,
    sourceId: r.sourceId,
    reason: r.reason ?? "",
    oldValue: r.oldValue as Record<string, unknown> | null,
    newValue: r.newValue as Record<string, unknown> | null,
  }));

  // Batched: ~3-5 queries per page instead of ~40 (N+1).
  const labelMap = await resolveSourceLabels(
    baseEntries.map((e) => ({ sourceTable: e.sourceTable, sourceId: e.sourceId })),
  );
  const entries = baseEntries.map((e) => ({
    ...e,
    sourceLabel:
      labelMap.get(`${e.sourceTable.toLowerCase()}::${e.sourceId}`) ??
      `${e.sourceTable} #${e.sourceId}`,
  }));

  return { entries, total, page: Math.max(parseInt(page, 10) || 1, 1), pageSize: take };
}

// CSV export of the (filtered) audit log.
export async function exportAuditCsv(query: Omit<AuditListQuery, "page" | "pageSize">) {
  const where = buildWhere(query);

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { user: { select: { email: true, role: true } } },
  });

  const header = [
    "timestamp",
    "user",
    "actor_role",
    "action_type",
    "source_table",
    "source_id",
    "reason",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.user?.email ?? "system",
      r.user?.role ?? "system",
      r.actionType,
      r.sourceTable,
      r.sourceId,
      r.reason ?? "",
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

// Status-only projection of the record an audit entry points at. Confidential
// clinical detail columns are NEVER returned.
export async function getSourceProjection(logId: string) {
  const log = await prisma.auditLog.findUnique({
    where: { id: logId },
    include: { user: { select: { email: true, role: true } } },
  });
  if (!log) {
    return null;
  }

  const sourceTable = log.sourceTable;
  const sourceId = log.sourceId;
  const fields: { label: string; value: string }[] = [];

  const setStatus = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1);

  switch (sourceTable) {
    case "adm_learner_profiles": {
      const rec = await prisma.admLearnerProfile.findUnique({
        where: { id: sourceId },
        select: {
          eligibilityStatus: true,
          stage: true,
          approvedBy: true,
          approvedAt: true,
        },
      });
      if (rec) {
        fields.push({ label: "Eligibility", value: setStatus(rec.eligibilityStatus) });
        fields.push({ label: "Stage", value: setStatus(rec.stage) });
        fields.push({
          label: "Principal sign",
          value: rec.approvedBy ? "Signed" : "Pending",
        });
        if (rec.approvedAt) {
          fields.push({
            label: "Signed at",
            value: rec.approvedAt.toISOString().slice(0, 10),
          });
        }
      }
      break;
    }
    case "health_records": {
      const rec = await prisma.healthRecord.findUnique({
        where: { id: sourceId },
        select: { visitDatetime: true, recordedBy: true },
      });
      if (rec) {
        fields.push({ label: "Status", value: "Recorded by Nurse" });
        fields.push({
          label: "Visit date",
          value: rec.visitDatetime.toISOString().slice(0, 10),
        });
      }
      break;
    }
    case "home_visitation_records": {
      const rec = await prisma.homeVisitationRecord.findUnique({
        where: { id: sourceId },
        select: { certificationBy: true },
      });
      if (rec) {
        fields.push({ label: "Status", value: rec.certificationBy ? "Certified" : "Draft" });
      }
      break;
    }
    case "anecdotal_records": {
      const rec = await prisma.anecdotalRecord.findUnique({
        where: { id: sourceId },
        select: { observationDatetime: true },
      });
      if (rec) {
        fields.push({ label: "Status", value: "On file" });
        fields.push({
          label: "Observed",
          value: rec.observationDatetime.toISOString().slice(0, 10),
        });
      }
      break;
    }
    case "referrals": {
      const rec = await prisma.referral.findUnique({
        where: { id: sourceId },
        select: { status: true },
      });
      if (rec) fields.push({ label: "Referral status", value: setStatus(rec.status) });
      break;
    }
    case "interventions": {
      const rec = await prisma.intervention.findUnique({
        where: { id: sourceId },
        select: { approvalStatus: true, outcomeStatus: true },
      });
      if (rec) {
        fields.push({ label: "Approval", value: setStatus(rec.approvalStatus) });
        fields.push({ label: "Outcome", value: setStatus(rec.outcomeStatus) });
      }
      break;
    }
    case "final_grades": {
      const rec = await prisma.finalGrade.findUnique({
        where: { id: sourceId },
        select: { lockStatus: true, remarks: true },
      });
      if (rec) {
        fields.push({ label: "Lock", value: setStatus(rec.lockStatus) });
        if (rec.remarks) fields.push({ label: "Remarks", value: setStatus(rec.remarks) });
      }
      break;
    }
    case "sf10_records": {
      const rec = await prisma.sf10Record.findUnique({
        where: { id: sourceId },
        select: { status: true, currentVersion: true },
      });
      if (rec) {
        fields.push({ label: "Status", value: setStatus(rec.status) });
        fields.push({ label: "Version", value: String(rec.currentVersion) });
      }
      break;
    }
    case "users": {
      const rec = await prisma.user.findUnique({
        where: { id: sourceId },
        select: { status: true, role: true },
      });
      if (rec) {
        fields.push({ label: "Role", value: setStatus(rec.role) });
        fields.push({ label: "Account status", value: setStatus(rec.status) });
      }
      break;
    }
    default:
      fields.push({ label: "Source", value: `${sourceTable} #${sourceId}` });
  }

  return {
    sourceTable,
    sourceId,
    confidential: false,
    fields,
  };
}
