import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { GradeLevel } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { invalidateTags } from "../../lib/cache.js";
import { AppError } from "../../lib/errors.js";

const GRADE_BAND: GradeLevel[] = ["G11", "G12"];

const router = Router();

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

function gradeLabel(gradeLevel: string): string {
  return GRADE_LABELS[gradeLevel] ?? gradeLevel;
}

// Registrar overview (G11–G12 authority only). Every query is scoped to the
// registrar grade band so counts/lists never leak lower-grade data. All values
// are computed live from the database — no mocked data.
router.get(
  "/overview",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "overview"] }),
  async (_req, res, next) => {
    try {
      const GRADE_BAND: GradeLevel[] = ["G11", "G12"];

      // pendingAccounts: total pending users awaiting account approval.
      const pendingAccounts = await prisma.user.count({
        where: { status: "pending" },
      });

      // pendingAdviserAccess: adviser staff accounts whose User is still pending.
      const pendingAdviserAccess = await prisma.staffProfile.count({
        where: { isAdviser: true, user: { status: "pending" } },
      });

      // lockedFinalsAwaiting: adviser-approved final grades for G11–12 students
      // that are awaiting registrar final approval.
      const lockedFinalsAwaiting = await prisma.finalGrade.count({
        where: { lockStatus: "adviser_approved", student: { gradeLevel: { in: GRADE_BAND } } },
      });

      // sf10Released: released SF10 records for G11–12 students.
      const sf10Released = await prisma.sf10Record.count({
        where: { status: "released", student: { gradeLevel: { in: GRADE_BAND } } },
      });

      // sections: active-year G11–12 sections.
      const sections = await prisma.section.count({
        where: { gradeLevel: { in: GRADE_BAND }, schoolYear: { isActive: true } },
      });

      // subjects: G11–12 subjects.
      const subjects = await prisma.subject.count({
        where: { gradeLevel: { in: GRADE_BAND } },
      });

      // reportCards: every final-grade row for G11–12 students (one row ≈ one
      // report-card subject entry). Used as a proxy since there is no dedicated
      // "report card" model.
      const reportCards = await prisma.finalGrade.count({
        where: { student: { gradeLevel: { in: GRADE_BAND } } },
      });

      // latestAttachments: most recent SF10 records in "attach" status (G11–12).
      // Sf10Record has no updatedAt, so order by validatedAt (nullable) desc.
      const latestAttachRows = await prisma.sf10Record.findMany({
        where: { status: "attach", student: { gradeLevel: { in: GRADE_BAND } } },
        orderBy: { validatedAt: "desc" },
        take: 7,
        select: {
          validatedAt: true,
          student: {
            select: { lrn: true, gradeLevel: true, user: { select: { fullName: true } } },
          },
        },
      });
      const latestAttachments = latestAttachRows.map((r) => ({
        student: r.student.user.fullName,
        lrn: r.student.lrn,
        grade: gradeLabel(r.student.gradeLevel),
        // ISO timestamp — frontend formats it relative ("2m ago").
        when: (r.validatedAt ?? new Date(0)).toISOString(),
      }));

      // missingSf10: G11–12 students with NO sf10Record at all.
      const missingRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, sf10Records: { none: {} } },
        select: {
          lrn: true,
          gradeLevel: true,
          user: { select: { fullName: true } },
        },
      });
      const missingSf10 = missingRows.map((s) => ({
        student: s.user.fullName,
        lrn: s.lrn,
        grade: gradeLabel(s.gradeLevel),
      }));

      // pendingStudents: G11–12 students whose User is still pending (newly
      // enrolled awaiting approval). Include first linked parent fullName.
      const pendingStudentRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, user: { status: "pending" } },
        select: {
          lrn: true,
          gradeLevel: true,
          user: { select: { fullName: true } },
          parentLinks: {
            take: 1,
            select: { parent: { select: { user: { select: { fullName: true } } } } },
          },
        },
      });
      const pendingStudents = pendingStudentRows.map((s) => ({
        name: s.user.fullName,
        lrn: s.lrn,
        grade: gradeLabel(s.gradeLevel),
        parent: s.parentLinks[0]?.parent.user.fullName ?? "—",
      }));

      // sf10Students: G11–12 students who have an SF10 record (any status), take 5.
      const sf10StudentRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, sf10Records: { some: {} } },
        take: 5,
        select: {
          lrn: true,
          gradeLevel: true,
          user: { select: { fullName: true } },
        },
      });
      const sf10Students = sf10StudentRows.map((s) => ({
        name: s.user.fullName,
        lrn: s.lrn,
        grade: gradeLabel(s.gradeLevel),
      }));

      res.json({
        pendingAccounts,
        pendingAdviserAccess,
        lockedFinalsAwaiting,
        sf10Released,
        sections,
        subjects,
        reportCards,
        latestAttachments,
        missingSf10,
        pendingStudents,
        sf10Students,
      });
    } catch (e) {
      next(e);
    }
  }
);

// List of G11–G12 final-grade rows scoped to the registrar grade band, for the
// Final Grade Approvals screen. Only finals the adviser has already approved
// (lockStatus "adviser_approved") reach the registrar. A row is "pending" (awaiting
// registrar final approval) until finalizedAt is set; "approve" once finalized.
// All values are computed live from the database — no mocked data.
router.get(
  "/final-grades",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics", "overview"] }),
  async (req, res, next) => {
    try {
      const GRADE_BAND: GradeLevel[] = ["G11", "G12"];

      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 100);

      const where = {
        student: { gradeLevel: { in: GRADE_BAND } },
        lockStatus: "adviser_approved" as const,
      };

      const [rows, total, counts] = await Promise.all([
        prisma.finalGrade.findMany({
          where,
          include: {
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                section: true,
                user: { select: { fullName: true } },
              },
            },
            subject: { select: { name: true } },
            term: { select: { termNumber: true, schoolYear: { select: { name: true } } } },
          },
          orderBy: [{ termId: "asc" }, { subjectId: "asc" }, { id: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.finalGrade.count({ where }),
        prisma.finalGrade.groupBy({
          by: ["finalizedAt"],
          where,
          _count: { _all: true },
        }),
      ]);

      // Total counts across ALL pages (not the current page slice).
      const approvedTotal = counts
        .filter((c) => c.finalizedAt !== null)
        .reduce((sum, c) => sum + c._count._all, 0);
      const pendingTotal = total - approvedTotal;

      const grades = rows.map((r) => ({
        id: r.id,
        lrn: r.student.lrn,
        name: r.student.user.fullName,
        gradeLevel: r.student.gradeLevel,
        section: r.student.section?.name ?? "—",
        subject: r.subject.name,
        term: `${r.term.schoolYear.name.split(" ")[0]} T${r.term.termNumber}`,
        computedAverage: r.computedAverage ?? 0,
        transmutedGrade: r.transmutedGrade ?? 0,
        remarks: r.remarks ?? "—",
        status: r.finalizedAt ? ("approve" as const) : ("pending" as const),
      }));

      res.json({
        grades,
        total,
        pending: pendingTotal,
        approved: approvedTotal,
        page,
        pageSize,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Accounts breakdown per grade level + section (registrar G11–G12 band). The source
// of truth is the decoupled StudentRoster (enrolled students). "withAccount" = roster
// LRN matched by a student whose user is active; "pending" = matched but user still
// pending (signed up, awaiting registrar approval). Computed live; no mocked data.
router.get(
  "/account-breakdown",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "accounts"] }),
  async (_req, res, next) => {
    try {
      const GRADE_BAND: GradeLevel[] = ["G11", "G12"];

      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      const schoolYearId = activeYear?.id;

      const roster = await prisma.studentRoster.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, schoolYearId: schoolYearId ?? "__none__" },
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

      const groups = new Map<string, { label: string; withAccount: number; pending: number }>();
      for (const r of roster) {
        const label = `${gradeLabel(r.gradeLevel)} · ${r.section?.name ?? "Unsectioned"}`;
        if (!groups.has(label)) groups.set(label, { label, withAccount: 0, pending: 0 });
        const g = groups.get(label)!;
        const status = statusByLrn.get(r.lrn);
        if (status === "active") g.withAccount++;
        else if (status === "pending") g.pending++;
      }

      // Pending sign-ups that have no roster entry yet (e.g. just registered) still
      // count toward the pending total shown in the Pending Students table, so the
      // breakdown and the table reconcile. Attribute them by their profile grade/section.
      const pendingUsers = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, user: { status: "pending" }, lrn: { notIn: Array.from(rosteredLrns) } },
        select: { gradeLevel: true, section: { select: { name: true } } },
      });
      for (const p of pendingUsers) {
        const label = `${gradeLabel(p.gradeLevel)} · ${p.section?.name ?? "Unsectioned"}`;
        if (!groups.has(label)) groups.set(label, { label, withAccount: 0, pending: 0 });
        groups.get(label)!.pending++;
      }

      const data = Array.from(groups.values()).map((g, i) => ({ id: `g${i}-${g.label}`, ...g }));
      res.json({ data });
    } catch (e) {
      next(e);
    }
  }
);

// List adviser SF10 access requests (registrar G11–12 band only). Server-side
// filter: requests whose section gradeLevel is in the registrar band. Optional
// ?status filters by request status. Live from the database — no mocked data.
router.get(
  "/adviser-access-requests",
  requireAuth,
  requireRole("registrar"),
  cache({ tags: ["registrar", "adviser-access"] }),
  async (req, res, next) => {
    try {
      const statusFilter = req.query.status
        ? String(req.query.status)
        : undefined;

      const where = {
        section: { gradeLevel: { in: GRADE_BAND } },
        ...(statusFilter ? { status: statusFilter as any } : {}),
      };

      const rows = await prisma.adviserSf10AccessRequest.findMany({
        where,
        include: {
          adviser: {
            select: {
              id: true,
              fullName: true,
              staffProfile: { select: { employeeId: true } },
            },
          },
          section: { select: { name: true } },
        },
        orderBy: [{ requestedAt: "desc" }],
      });

      const requests = await Promise.all(
        rows.map(async (r) => {
          const students = await prisma.studentProfile.findMany({
            where: { sectionId: r.sectionId },
            select: {
              lrn: true,
              user: { select: { fullName: true } },
              sf10Records: { select: { status: true } },
            },
            orderBy: { lrn: "asc" },
          });
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
            adviserName: r.adviser.fullName,
            employeeId: r.adviser.staffProfile?.employeeId ?? "—",
            section: r.section.name,
            gradeLevel: r.gradeLevel,
            reason: r.reason,
            status: r.status,
            decisionReason: r.decisionReason,
            requestedAt: r.requestedAt.toISOString(),
            decidedAt: r.decidedAt?.toISOString() ?? null,
            affectedAdvisees,
          };
        })
      );

      res.json({ requests });
    } catch (e) {
      next(e);
    }
  }
);

// Decide (approve or deny) an adviser SF10 access request. Shared handler:
// sets status + decision, writes an audit entry, and fans out a notification to
// the requesting adviser. 409 if the request is already decided.
async function decideAccessRequest(
  req: Request,
  res: Response,
  next: NextFunction,
  approved: boolean
) {
  try {
    const id = String(req.query.id ?? req.params.id);
    const request = await prisma.adviserSf10AccessRequest.findUnique({
      where: { id },
      include: {
        adviser: { select: { fullName: true } },
        section: { select: { name: true } },
      },
    });
    if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
    if (request.status !== "pending")
      throw new AppError(409, "ALREADY_DECIDED", "Request already processed");

    const reason = approved
      ? null
      : String((req.body as { reason?: string })?.reason ?? "Denied by registrar");

    const updated = await prisma.adviserSf10AccessRequest.update({
      where: { id },
      data: {
        status: approved ? "approved" : "denied",
        decidedBy: req.user!.id,
        decidedAt: new Date(),
        decisionReason: reason,
      },
      include: { section: { select: { name: true } } },
    });

    await writeAudit({
      userId: req.user!.id,
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

    await invalidateTags(["registrar", "adviser-access", "overview"]);

    res.json({
      id: updated.id,
      status: updated.status,
      decisionReason: updated.decisionReason,
      decidedAt: updated.decidedAt?.toISOString() ?? undefined,
    });
  } catch (e) {
    next(e);
  }
}

router.post(
  "/adviser-access-requests/:id/approve",
  requireAuth,
  requireRole("registrar"),
  (req, res, next) => {
    decideAccessRequest(req, res, next, true).catch(next);
  }
);

router.post(
  "/adviser-access-requests/:id/deny",
  requireAuth,
  requireRole("registrar"),
  (req, res, next) => {
    decideAccessRequest(req, res, next, false).catch(next);
  }
);

export default router;
