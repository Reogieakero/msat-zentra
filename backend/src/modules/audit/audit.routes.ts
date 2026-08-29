import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

const MAX_PAGE_SIZE = 100;

// Resolve a human-readable label for an audit entry's source record. Prefers the
// related student's name; falls back to "table #id" when not resolvable.
async function resolveSourceLabel(
  sourceTable: string,
  sourceId: string,
): Promise<string> {
  try {
    const table = sourceTable.toLowerCase();

    const studentName = async (studentId: string) => {
      const sp = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        include: { user: { select: { fullName: true } } },
      });
      return sp?.user?.fullName ?? null;
    };

    switch (table) {
      case "adm_learner_profiles": {
        const r = await prisma.admLearnerProfile.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `ADM · ${n}` : `ADM #${sourceId}`;
      }
      case "health_records": {
        const r = await prisma.healthRecord.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `Health · ${n}` : `Health #${sourceId}`;
      }
      case "home_visitation_records": {
        const r = await prisma.homeVisitationRecord.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `Home Visit · ${n}` : `Home Visit #${sourceId}`;
      }
      case "anecdotal_records": {
        const r = await prisma.anecdotalRecord.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `Anecdotal · ${n}` : `Anecdotal #${sourceId}`;
      }
      case "interventions": {
        const r = await prisma.intervention.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `Intervention · ${n}` : `Intervention #${sourceId}`;
      }
      case "referrals": {
        const r = await prisma.referral.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `Referral · ${n}` : `Referral #${sourceId}`;
      }
      case "sf10_records": {
        const r = await prisma.sf10Record.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `SF10 · ${n}` : `SF10 #${sourceId}`;
      }
      case "final_grades": {
        const r = await prisma.finalGrade.findUnique({
          where: { id: sourceId },
          select: { studentId: true },
        });
        const n = r ? await studentName(r.studentId) : null;
        return n ? `Final Grade · ${n}` : `Final Grade #${sourceId}`;
      }
      case "student_profiles":
      case "studentprofile": {
        const r = await prisma.studentProfile.findUnique({
          where: { userId: sourceId },
          include: { user: { select: { fullName: true } } },
        });
        return r?.user?.fullName ? `Student · ${r.user.fullName}` : `Student #${sourceId}`;
      }
      case "users": {
        const r = await prisma.user.findUnique({
          where: { id: sourceId },
          select: { fullName: true, email: true, studentProfile: { select: { userId: true } } },
        });
        if (!r) return `User #${sourceId}`;
        const name = r.fullName || r.email;
        return r.studentProfile ? `Student · ${name}` : name;
      }
      case "school_years": {
        const r = await prisma.schoolYear.findUnique({
          where: { id: sourceId },
          select: { name: true },
        });
        return r ? r.name : `School Year #${sourceId}`;
      }
      default:
        return `${sourceTable} #${sourceId}`;
    }
  } catch {
    return `${sourceTable} #${sourceId}`;
  }
}

// School-wide audit log for the Principal. Supports filtering, search, and
// pagination. actorRole is derived from the acting user's role (PLAN.md §8).
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const {
        actionType,
        sourceTable,
        userId,
        actorRole,
        from,
        to,
        q,
        page = "1",
        pageSize = "20",
      } = req.query as Record<string, string | undefined>;

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

      const entries = await Promise.all(
        baseEntries.map(async (e) => ({
          ...e,
          sourceLabel: await resolveSourceLabel(e.sourceTable, e.sourceId),
        })),
      );

      res.json({ entries, total, page: Math.max(parseInt(page, 10) || 1, 1), pageSize: take });
    } catch (e) {
      next(e);
    }
  },
);

// CSV export of the (filtered) audit log.
router.get(
  "/export",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const { actionType, sourceTable, userId, actorRole, from, to, q } =
        req.query as Record<string, string | undefined>;

      const where: any = {};
      if (actionType) where.actionType = String(actionType);
      if (sourceTable) where.sourceTable = String(sourceTable);
      if (userId) where.userId = String(userId);

      const and: any[] = [];
      if (actorRole) and.push({ user: { role: String(actorRole) } });
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
      const csv = [header.join(","), ...lines].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="audit-log.csv"');
      res.send(csv);
    } catch (e) {
      next(e);
    }
  },
);

// Status-only projection of the record an audit entry points at. Confidential
// clinical detail columns are NEVER returned (PLAN.md §4.3 / O1).
router.get(
  "/:id/source",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const log = await prisma.auditLog.findUnique({
        where: { id: String(req.params.id) },
        include: { user: { select: { email: true, role: true } } },
      });
      if (!log) {
        res.status(404).json({ error: "Audit entry not found" });
        return;
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

      res.json({
        sourceTable,
        sourceId,
        confidential: false,
        fields,
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
