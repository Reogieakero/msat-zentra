import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { GradeLevel } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";

const router = Router();

const GRADE_BAND_7_10: GradeLevel[] = ["G7", "G8", "G9", "G10"];

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

// Record Keeper overview (G7–G10 authority only). Every query is scoped to the
// record keeper grade band so counts/lists never leak upper-grade data.
// All values computed live from the database — no mocked data.
router.get(
  "/overview",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "overview"] }),
  async (req, res, next) => {
    try {
      // pendingAdviserAccess: adviser staff accounts whose User is still pending.
      const pendingAdviserAccess = await prisma.staffProfile.count({
        where: { isAdviser: true, user: { status: "pending" } },
      });

      // Report cards: every final-grade row for G7–10 students (one row ≈ one
      // report-card subject entry). Used as a proxy since there is no dedicated
      // "report card" model.
      const reportCards = await prisma.finalGrade.count({
        where: { student: { gradeLevel: { in: GRADE_BAND_7_10 } } },
      });

      // The record keeper is view-only in the grade pipeline: a student's term grades
      const viewableFinalRows = await prisma.finalGrade.findMany({
        where: { student: { gradeLevel: { in: GRADE_BAND_7_10 } } },
        select: {
          lockStatus: true,
          studentId: true,
          termId: true,
          subjectId: true,
        },
      });
      const byStudentTerm = new Map<string, typeof viewableFinalRows>();
      for (const r of viewableFinalRows) {
        const key = `${r.studentId}|${r.termId}`;
        if (!byStudentTerm.has(key)) byStudentTerm.set(key, []);
        byStudentTerm.get(key)!.push(r);
      }
      let readyRows = 0;
      let readyStudents = 0;
      for (const group of byStudentTerm.values()) {
        if (group.length > 0 && group.every((r) => r.lockStatus === "adviser_approved")) {
          readyRows += group.length;
          readyStudents++;
        }
      }
      const awaitingRows = readyRows;

      // sections/subjects: G7–10 active sections and subjects (KPI metrics).
      const [sections, subjects] = await Promise.all([
        prisma.section.count({
          where: { gradeLevel: { in: GRADE_BAND_7_10 }, schoolYear: { isActive: true } },
        }),
        prisma.subject.count({ where: { gradeLevel: { in: GRADE_BAND_7_10 } } }),
      ]);

      // sf10ByStatus / sectionsByGrade / subjectsByGrade feed the overview
      // header's KPI charts (donuts + per-grade bars).
      const [sf10ByStatus, sectionsGrouped, subjectsGrouped] = await Promise.all([
        prisma.sf10Record.groupBy({
          by: ["status"],
          where: { student: { gradeLevel: { in: GRADE_BAND_7_10 } } },
          _count: { _all: true },
        }),
        prisma.section.groupBy({
          by: ["gradeLevel"],
          where: { gradeLevel: { in: GRADE_BAND_7_10 }, schoolYear: { isActive: true } },
          _count: { _all: true },
        }),
        prisma.subject.groupBy({
          by: ["gradeLevel"],
          where: { gradeLevel: { in: GRADE_BAND_7_10 } },
          _count: { _all: true },
        }),
      ]);

      const sf10Total = sf10ByStatus.reduce((sum, r) => sum + r._count._all, 0);
      const sf10Released = sf10ByStatus.find((r) => r.status === "released")?._count._all ?? 0;
      const sf10Available = sf10ByStatus.find((r) => r.status === "available")?._count._all ?? 0;
      const sf10Attach = sf10ByStatus.find((r) => r.status === "attach")?._count._all ?? 0;

      // latestAttachments: most recent SF10 records in "attach" status (G7–10).
      // Sf10Record has no updatedAt, so order by validatedAt (nullable) desc.
      const latestAttachRows = await prisma.sf10Record.findMany({
        where: { status: "attach", student: { gradeLevel: { in: GRADE_BAND_7_10 } } },
        orderBy: { validatedAt: "desc" },
        take: 100,
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
        when: (r.validatedAt ?? new Date(0)).toISOString(),
      }));

      // missingSf10: G7–10 students with NO sf10Record at all.
      const missingRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND_7_10 }, sf10Records: { none: {} } },
        select: {
          lrn: true,
          gradeLevel: true,
          section: { select: { name: true } },
          user: { select: { fullName: true } },
        },
      });
      const missingSf10 = missingRows.map((s) => ({
        student: s.user.fullName,
        lrn: s.lrn,
        grade: gradeLabel(s.gradeLevel),
        section: s.section?.name ?? "—",
      }));

      // pendingStudents: G7–10 students whose User is still pending (newly
      // enrolled awaiting approval). Includes both profiled students and bare
      // self-sign-ups with no profile yet (their claimed LRN resolves them into
      // the band from the official StudentRoster), reconciling with /api/auth/pending.
      // Include first linked parent fullName.
      const [profiledPending, barePending] = await Promise.all([
        prisma.studentProfile.findMany({
          where: { gradeLevel: { in: GRADE_BAND_7_10 }, user: { status: "pending" } },
          select: {
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true } },
            parentLinks: {
              take: 1,
              select: { parent: { select: { user: { select: { fullName: true } } } } },
            },
          },
        }),
        prisma.user.findMany({
          where: { status: "pending", role: "student", studentProfile: null },
          select: { fullName: true, lrn: true },
        }),
      ]);

      // Resolve bare sign-ups into the band from the roster; skip only the ones
      // whose LRN resolves to a roster entry OUTSIDE the band. A bare sign-up
      // with an unresolvable LRN is still included (mirrors /api/auth/pending),
      // shown with an unknown grade so the Overview and Accounts counts match.
      const bareRows: { name: string; lrn: string; gradeLevel: string }[] = [];
      for (const u of barePending) {
        if (!u.lrn) continue;
        const roster = await prisma.studentRoster.findFirst({
          where: { lrn: u.lrn },
          select: { lrn: true, gradeLevel: true },
          orderBy: { schoolYearId: "desc" },
        });
        if (roster) {
          if (!GRADE_BAND_7_10.includes(roster.gradeLevel)) continue;
          bareRows.push({ name: u.fullName, lrn: u.lrn, gradeLevel: roster.gradeLevel });
        } else {
          bareRows.push({ name: u.fullName, lrn: u.lrn, gradeLevel: "—" });
        }
      }

      const pendingStudents = [
        ...profiledPending.map((s) => ({
          name: s.user.fullName,
          lrn: s.lrn,
          grade: gradeLabel(s.gradeLevel),
          parent: s.parentLinks[0]?.parent.user.fullName ?? "—",
        })),
        ...bareRows.map((r) => ({
          name: r.name,
          lrn: r.lrn,
          grade: gradeLabel(r.gradeLevel),
          parent: "—",
        })),
      ];

      // sf10Students: G7–10 students who have an SF10 record (any status), take 5.
      const sf10StudentRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND_7_10 }, sf10Records: { some: {} } },
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

      // pendingAccounts: account requests the record keeper can action — G7–10 student
      // enrollments awaiting approval plus adviser-access requests.
      const pendingAccounts = pendingStudents.length + pendingAdviserAccess;

      res.json({
        pendingAccounts,
        pendingAdviserAccess,
        lockedFinalsAwaiting: awaitingRows,
        sf10Released,
        sections,
        subjects,
        reportCards,
        latestAttachments,
        missingSf10,
        pendingStudents,
        sf10Students,
        finals: {
          total: reportCards,
          finalized: 0,
          awaiting: awaitingRows,
          draft: reportCards - awaitingRows,
        },
        sf10: {
          total: sf10Total,
          released: sf10Released,
          available: sf10Available,
          attach: sf10Attach,
        },
        sectionsByGrade: GRADE_BAND_7_10.map((g) => ({
          grade: gradeLabel(g),
          count: sectionsGrouped.find((r) => r.gradeLevel === g)?._count._all ?? 0,
        })),
        subjectsByGrade: GRADE_BAND_7_10.map((g) => ({
          grade: gradeLabel(g),
          count: subjectsGrouped.find((r) => r.gradeLevel === g)?._count._all ?? 0,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// Record Keeper final-grade viewer (G7–10). The record keeper has a view-only role
// in the grade pipeline:
//   1. Subject teacher locks a subject's final grade (lockStatus "locked").
//   2. Adviser approves it (lockStatus "adviser_approved").
//   3. A student's grades become visible to the record keeper ONLY when every subject
//      for that student (in the term) has been adviser-approved.
// The record keeper cannot approve — this endpoint simply returns the complete,
// viewable grade sets grouped by student. All values computed live — no mocks.
router.get(
  "/final-grades",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics", "overview"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 100);

      // Every final-grade row for the record keeper band, with the info needed to
      // decide which students have a fully adviser-approved term.
      const rows = await prisma.finalGrade.findMany({
        where: { student: { gradeLevel: { in: GRADE_BAND_7_10 } } },
        select: {
          id: true,
          lockStatus: true,
          computedAverage: true,
          transmutedGrade: true,
          remarks: true,
          subjectId: true,
          termId: true,
          student: {
            select: {
              lrn: true,
              gradeLevel: true,
              sectionId: true,
              section: { select: { name: true } },
              user: { select: { fullName: true } },
            },
          },
          subject: { select: { name: true } },
          term: { select: { id: true, termNumber: true, schoolYear: { select: { name: true } } } },
        },
        orderBy: [{ termId: "asc" }, { student: { user: { fullName: "asc" } } }, { subject: { name: "asc" } }],
      });

      // Batch-fetch teacher assignments for all unique (subject, section, term)
      // combinations present in the result set.
      const teacherKeys = new Set<string>();
      for (const r of rows) {
        if (r.student.sectionId) teacherKeys.add(`${r.subjectId}|${r.student.sectionId}|${r.termId}`);
      }
      const teacherAssignments = await prisma.teacherSubjectAssignment.findMany({
        where: {
          OR: Array.from(teacherKeys).map((k) => {
            const [subjectId, sectionId, termId] = k.split("|");
            return { subjectId, sectionId, termId };
          }),
        },
        select: {
          subjectId: true,
          sectionId: true,
          termId: true,
          teacher: { select: { fullName: true } },
        },
      });
      const teacherMap = new Map<string, string>();
      for (const ta of teacherAssignments) {
        teacherMap.set(`${ta.subjectId}|${ta.sectionId}|${ta.termId}`, ta.teacher.fullName);
      }

      // Group rows by (studentId, termId).
      const byKey = new Map<string, typeof rows>();
      for (const r of rows) {
        const key = `${r.student.lrn}|${r.term.id}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(r);
      }

      // A set is "viewable" when every subject the student is enrolled in for the
      // term has an adviser-approved final grade. We approximate enrolment by the
      // subjects present in the term for that student. One row per complete student.
      const viewableGroups: (typeof rows)[] = [];
      for (const group of byKey.values()) {
        if (group.length > 0 && group.every((r) => r.lockStatus === "adviser_approved")) {
          viewableGroups.push(group);
        }
      }

      // Order complete students by name (the rows within a group are already
      // ordered by term + name + subject).
      viewableGroups.sort((a, b) =>
        a[0].student.user.fullName.localeCompare(b[0].student.user.fullName)
      );

      const totalStudents = viewableGroups.length;
      const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
      const clampedPage = Math.min(page, totalPages);
      const slice = viewableGroups.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

      // Stats: "ready" = fully adviser-approved (viewable) rows; "complete" =
      // distinct viewable student-terms. Both are informational for the record keeper.
      // "locked" / "adviserApproved" feed the grade pipeline stages on the page.
      const readyCount = viewableGroups.reduce((sum, g) => sum + g.length, 0);
      const completeCount = totalStudents;
      const lockedCount = rows.filter((r) => r.lockStatus === "locked").length;
      const adviserApprovedCount = rows.filter((r) => r.lockStatus === "adviser_approved").length;

      const students = slice.map((group) => {
        const r0 = group[0];
        return {
          id: `${r0.student.lrn}|${r0.term.id}`,
          lrn: r0.student.lrn,
          name: r0.student.user.fullName,
          gradeLevel: r0.student.gradeLevel,
          section: r0.student.section?.name ?? "—",
          term: `${r0.term.schoolYear.name.split(" ")[0]} T${r0.term.termNumber}`,
          overall: Math.round(
            (group.reduce((sum, r) => sum + (r.transmutedGrade ?? 0), 0) / group.length) * 100
          ) / 100,
          subjects: group.map((r) => {
            const teacherKey = `${r.subjectId}|${r.student.sectionId}|${r.termId}`;
            return {
              id: r.id,
              subject: r.subject.name,
              teacher: teacherMap.get(teacherKey) ?? "—",
              computedAverage: r.computedAverage ?? 0,
              transmutedGrade: r.transmutedGrade ?? 0,
              remarks: r.remarks ?? "—",
              status: "approved" as const,
            };
          }),
          status: "approved" as const,
        };
      });

      res.json({
        students,
        meta: {
          total: totalStudents,
          page: clampedPage,
          pageSize,
          totalPages,
          readyCount,
          completeCount,
          lockedCount,
          adviserApprovedCount,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

// Record Keeper account breakdown (G7–10 band only). Live from the database.
router.get(
  "/account-breakdown",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "accounts"] }),
  async (req, res, next) => {
    try {
      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      const schoolYearId = activeYear?.id;

      const roster = await prisma.studentRoster.findMany({
        where: { gradeLevel: { in: GRADE_BAND_7_10 }, schoolYearId: schoolYearId ?? "__none__" },
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

      const groups = new Map<
        string,
        { label: string; grade: string; withAccount: number; pending: number }
      >();
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
      const pendingUsers = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND_7_10 }, user: { status: "pending" }, lrn: { notIn: Array.from(rosteredLrns) } },
        select: { gradeLevel: true, section: { select: { name: true } } },
      });
      for (const p of pendingUsers) {
        const label = `${gradeLabel(p.gradeLevel)} · ${p.section?.name ?? "Unsectioned"}`;
        if (!groups.has(label))
          groups.set(label, { label, grade: gradeLabel(p.gradeLevel), withAccount: 0, pending: 0 });
        groups.get(label)!.pending++;
      }

      const data = Array.from(groups.values()).map((g, i) => ({ id: `g${i}-${g.label}`, ...g }));
      res.json({ data });
    } catch (e) {
      next(e);
    }
  }
);

// Record Keeper accounts audit (G7–10 band only). Shows approval/rejection history
// for student accounts in the record keeper's grade band. No cache — live state.
router.get(
  "/accounts-audit",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "10"), 10) || 10, 1), 50);
      const skip = (page - 1) * pageSize;

      // Affected users that belong to the record keeper band (G7–G10).
      const bandProfiles = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND_7_10 } },
        select: { userId: true },
      });
      const bandUserIds = bandProfiles.map((p) => p.userId);

      const where: any = {
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

      res.json({ entries, total, page, pageSize });
    } catch (e) {
      next(e);
    }
  }
);

export default router;