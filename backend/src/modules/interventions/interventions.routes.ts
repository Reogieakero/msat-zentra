import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { cache } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import { getInterventionStudents } from "../risk/interventions.service.js";
import {
  evaluateRisk,
  evaluateRosterRisk,
  resolveActiveTermId,
} from "../../services/risk.js";

const router = Router();

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

const TAGS = ["guidance", "overview", "alerts", "referrals", "risk", "teacher"];

// Guidance at-risk engine queue: LIVE high-risk students for the active term,
// each carrying the risk factors that tripped plus their current follow-up
// (if the engine — or guidance — already opened one). Defaults to High;
// Moderate/All and per-factor views are one filter away. Everything is
// recomputed from current grades, attendance, and behavior filings — stored
// snapshot levels are never trusted directly.
router.get(
  "/",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "interventions"] }),
  async (req, res, next) => {
    try {
      const me = req.user!.id;
      const levelFilter =
        req.query.level === "Moderate" || req.query.level === "All"
          ? String(req.query.level)
          : "High";
      const factorFilter =
        req.query.factor === "Academic" ||
        req.query.factor === "Attendance" ||
        req.query.factor === "Behavioral"
          ? (req.query.factor as "Academic" | "Attendance" | "Behavioral")
          : null;
      const mineOnly = req.query.mine === "true";
      const outcomeFilter =
        req.query.outcome === "ongoing" ||
        req.query.outcome === "resolved" ||
        req.query.outcome === "unresolved" ||
        req.query.outcome === "all"
          ? String(req.query.outcome)
          : "";
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      // One full-cohort engine read; every view below filters the LIVE values
      // in memory so counts and pages always agree with each other.
      const cohort = await getInterventionStudents({ page: 1, pageSize: 1000 });

      const factorKey =
        factorFilter === "Academic"
          ? "academic"
          : factorFilter === "Attendance"
            ? "attendance"
            : factorFilter === "Behavioral"
              ? "behavioral"
              : null;

      const matches = (s: (typeof cohort.students)[number]) => {
        if (levelFilter !== "All" && s.riskLevel !== levelFilter) return false;
        if (factorKey && !s.factors[factorKey as keyof typeof s.factors]) return false;
        if (mineOnly && s.intervention?.assignedTo !== me) return false;
        // Default queue hides closed follow-ups (resolved or not resolved) —
        // finished work leaves the list; the filter brings it back.
        const out = s.intervention?.outcomeStatus ?? null;
        if (outcomeFilter === "all") {
          // show everything
        } else if (outcomeFilter) {
          if (!out || out !== outcomeFilter) return false;
        } else if (out === "resolved" || out === "unresolved") {
          return false;
        }
        if (
          q &&
          !`${s.studentName} ${s.lrn} ${s.section} ${s.intervention?.recommendedAction ?? ""} ${s.intervention?.assignedStaffName ?? ""}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      };

      const levelRank = (level: string) =>
        level === "High" ? 0 : level === "Moderate" ? 1 : 2;
      const listed = cohort.students
        .filter(matches)
        .sort(
          (a, b) =>
            levelRank(a.riskLevel) - levelRank(b.riskLevel) ||
            b.riskCount - a.riskCount ||
            a.studentName.localeCompare(b.studentName)
        );

      const total = listed.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const slice = listed.slice((safePage - 1) * pageSize, safePage * pageSize);

      // Read-only context only: how many adviser-referred guidance cases this
      // student has (open vs closed). Never mixed into the engine follow-up —
      // no shared sessions, statuses, or actions cross the pipelines.
      const OPEN_REFERRAL = new Set([
        "pending",
        "in_progress",
        "escalated",
        "info_requested",
        "follow_up",
      ]);
      const refByKey = new Map<string, { open: number; closed: number }>();
      if (slice.length > 0) {
        const profileIds = slice
          .map((s) => s.studentId)
          .filter((id) => !id.startsWith("roster:"));
        const rosterIds = slice
          .map((s) => s.studentId)
          .filter((id) => id.startsWith("roster:"))
          .map((id) => id.slice("roster:".length));
        const refRows = await prisma.referral.findMany({
          where: {
            referredToRole: "guidance_counselor",
            OR: [
              ...(profileIds.length ? [{ studentId: { in: profileIds } }] : []),
              ...(rosterIds.length ? [{ rosterId: { in: rosterIds } }] : []),
            ],
          },
          select: { studentId: true, rosterId: true, status: true },
        });
        for (const r of refRows) {
          const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
          if (!key) continue;
          const entry = refByKey.get(key) ?? { open: 0, closed: 0 };
          if (OPEN_REFERRAL.has(r.status)) entry.open += 1;
          else entry.closed += 1;
          refByKey.set(key, entry);
        }
      }

      const students = slice.map((s) => ({
        studentKey: s.studentId,
        lrn: s.lrn,
        student: s.studentName,
        section: s.section,
        grade: GRADE_LABELS[s.gradeLevel] ?? "",
        riskLevel: s.riskLevel,
        riskCount: s.riskCount,
        factors: s.factors,
        referralContext: refByKey.get(s.studentId) ?? { open: 0, closed: 0 },
        intervention: s.intervention
          ? {
              id: s.intervention.id,
              recommendedAction: s.intervention.recommendedAction,
              assigneeId: s.intervention.assignedTo ?? "",
              assignee: s.intervention.assignedStaffName ?? "",
              approvalStatus: s.intervention.approvalStatus,
              outcomeStatus: s.intervention.outcomeStatus,
              outcomeNotes: s.intervention.outcomeNotes ?? "",
              priority: s.intervention.priority ?? "",
              intakeNotes: s.intervention.intakeNotes ?? "",
              sessions: s.intervention.sessions.map((sess) => ({
                id: sess.id,
                sessionType: sess.sessionType,
                scheduledAt: sess.scheduledAt.toISOString(),
                date: sess.scheduledAt.toISOString().slice(0, 10),
                venue: sess.venue ?? "",
                status: sess.status,
                sessionNotes: sess.sessionNotes ?? "",
                outcome: sess.outcome ?? "",
                cancelReason: sess.cancelReason ?? "",
                completedAt: sess.completedAt
                  ? sess.completedAt.toISOString().slice(0, 10)
                  : "",
              })),
              completedSessions: s.intervention.sessions.filter(
                (sess) => sess.status === "completed"
              ).length,
            }
          : null,
      }));

      res.json({
        summary: {
          high: cohort.students.filter((s) => s.riskLevel === "High").length,
          moderate: cohort.students.filter((s) => s.riskLevel === "Moderate").length,
          waitingReview: cohort.students.filter(
            (s) => s.intervention?.approvalStatus === "pending"
          ).length,
          ongoing: cohort.students.filter(
            (s) => s.intervention?.outcomeStatus === "ongoing"
          ).length,
          resolved: cohort.students.filter(
            (s) =>
              s.intervention?.outcomeStatus === "resolved" ||
              s.intervention?.outcomeStatus === "unresolved"
          ).length,
          mine: cohort.students.filter((s) => s.intervention?.assignedTo === me).length,
        },
        students,
        page: safePage,
        pageSize,
        total,
        totalPages,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Staff directory for intervention assignment — the people guidance can hand
// a follow-up to (advisers, subject teachers, nurse, ADM coordinator, fellow
// counselors). Status-only directory: id, name, role. No student data.
router.get(
  "/staff",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "staff"] }),
  async (_req, res, next) => {
    try {
      const staff = await prisma.user.findMany({
        where: {
          status: "active",
          role: {
            in: [
              "adviser",
              "subject_teacher",
              "nurse",
              "adm_coordinator",
              "guidance_counselor",
            ],
          },
        },
        select: { id: true, fullName: true, role: true },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      });
      res.json({ staff });
    } catch (e) {
      next(e);
    }
  }
);

// Start a follow-up for a live at-risk student who has no open one yet —
// same intake as accepting a referral: urgency, first impressions, and an
// optional first counseling session booked on the spot.
const startSchema = z.object({
  studentId: z.string().min(1).optional(),
  rosterId: z.string().min(1).optional(),
  recommendedAction: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "normal", "high"]),
  intakeNotes: z.string().trim().max(2000).optional(),
  firstSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

const SESSION_TYPES = ["individual", "parent_conference", "group", "home_visit"] as const;

function parseScheduledAt(value: unknown): Date {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date and time for the session");
  }
  return date;
}

function formatSession(row: {
  id: string;
  sessionType: string;
  scheduledAt: Date;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  completedAt: Date | null;
}) {
  return {
    id: row.id,
    sessionType: row.sessionType,
    scheduledAt: row.scheduledAt.toISOString(),
    date: row.scheduledAt.toISOString().slice(0, 10),
    venue: row.venue ?? "",
    status: row.status,
    sessionNotes: row.sessionNotes ?? "",
    outcome: row.outcome ?? "",
    cancelReason: row.cancelReason ?? "",
    completedAt: row.completedAt ? row.completedAt.toISOString().slice(0, 10) : "",
  };
}

router.post(
  "/start",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", startSchema),
  async (req, res, next) => {
    try {
      const { studentId, rosterId } = req.body as {
        studentId?: string;
        rosterId?: string;
      };
      if ((studentId && rosterId) || (!studentId && !rosterId)) {
        throw new AppError(400, "INVALID_ACTION", "Pick exactly one student");
      }
      const termId = await resolveActiveTermId();
      if (!termId) throw new AppError(400, "NO_ACTIVE_TERM", "No active term to evaluate");
      let liveLevel: string;
      if (rosterId) {
        const roster = await prisma.studentRoster.findUnique({
          where: { id: rosterId },
          select: { id: true },
        });
        if (!roster) throw new AppError(404, "NOT_FOUND", "Student not found");
        liveLevel = (await evaluateRosterRisk(rosterId, termId)).result.riskLevel;
      } else {
        const profile = await prisma.studentProfile.findUnique({
          where: { userId: studentId! },
          select: { userId: true },
        });
        if (!profile) throw new AppError(404, "NOT_FOUND", "Student not found");
        liveLevel = (await evaluateRisk(studentId!, termId)).result.riskLevel;
      }
      if (liveLevel !== "High" && liveLevel !== "Moderate") {
        throw new AppError(400, "INVALID_ACTION", "Only at-risk students need a follow-up");
      }
      const open = await prisma.intervention.findFirst({
        where: {
          ...(studentId ? { studentId } : { rosterId: rosterId! }),
          outcomeStatus: { not: "resolved" },
          approvalStatus: { not: "rejected" },
        },
        select: { id: true },
      });
      if (open) {
        throw new AppError(400, "INVALID_ACTION", "This student already has an open follow-up");
      }
      if (req.body.firstSession && !(SESSION_TYPES as readonly string[]).includes(req.body.firstSession.sessionType)) {
        throw new AppError(400, "INVALID_ACTION", "Unknown session type");
      }
      const created = await prisma.intervention.create({
        data: {
          studentId: studentId ?? null,
          rosterId: rosterId ?? null,
          riskLevelAtFlag: liveLevel as "High" | "Moderate",
          recommendedAction: req.body.recommendedAction.trim(),
          priority: req.body.priority,
          intakeNotes: req.body.intakeNotes?.trim() || null,
          assignedTo: req.user!.id,
          assignedAt: new Date(),
          approvalStatus: "approved",
          outcomeStatus: "ongoing",
        },
      });
      if (req.body.firstSession) {
        const first = await prisma.counselingSession.create({
          data: {
            interventionId: created.id,
            sessionType: req.body.firstSession.sessionType,
            scheduledAt: parseScheduledAt(req.body.firstSession.scheduledAt),
            venue: req.body.firstSession.venue?.trim() || null,
            status: "scheduled",
            createdBy: req.user!.id,
          },
        });
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: first.id, reason: "First session booked on follow-up start", oldValue: null, newValue: { sessionType: first.sessionType, scheduledAt: first.scheduledAt } });
      }
      await writeAudit({
        userId: req.user!.id,
        actionType: "intervention_assigned",
        sourceTable: "interventions",
        sourceId: created.id,
        reason: `Follow-up started with ${req.body.priority} priority`,
        oldValue: null,
        newValue: { riskLevelAtFlag: liveLevel },
      });
      await invalidateTags(TAGS);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

async function getIntervention(id: string) {
  const row = await prisma.intervention.findUnique({
    where: { id },
    include: { assignee: { select: { id: true, fullName: true } } },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Intervention not found");
  return row;
}

function ensureWorkable(row: { outcomeStatus: string; approvalStatus: string }) {
  if (row.outcomeStatus === "resolved") {
    throw new AppError(400, "INVALID_ACTION", "A resolved follow-up can no longer be changed");
  }
  if (row.approvalStatus === "rejected") {
    throw new AppError(400, "INVALID_ACTION", "A rejected plan cannot take sessions");
  }
}

async function getInterventionSession(interventionId: string, sessionId: string) {
  const session = await prisma.counselingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.interventionId !== interventionId) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  return session;
}

const interventionSessionSchema = z.object({
  scheduledAt: z.string().min(1),
  sessionType: z.string().min(1),
  venue: z.string().trim().max(200).optional(),
});

router.post(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", interventionSessionSchema),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      ensureWorkable(row);
      if (!(SESSION_TYPES as readonly string[]).includes(req.body.sessionType)) {
        throw new AppError(400, "INVALID_ACTION", "Unknown session type");
      }
      const created = await prisma.counselingSession.create({
        data: {
          interventionId: row.id,
          sessionType: req.body.sessionType,
          scheduledAt: parseScheduledAt(req.body.scheduledAt),
          venue: req.body.venue?.trim() || null,
          status: "scheduled",
          createdBy: req.user!.id,
        },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: "Counseling session scheduled", oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
      await invalidateTags(TAGS);
      res.status(201).json(formatSession(created));
    } catch (e) { next(e); }
  }
);

const completeInterventionSessionSchema = z.object({
  sessionNotes: z.string().trim().min(1).max(5000),
  outcome: z.string().trim().max(2000).optional(),
  followUpSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

router.post(
  "/:id/sessions/:sessionId/complete",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", completeInterventionSessionSchema),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      ensureWorkable(row);
      const session = await getInterventionSession(row.id, String(req.params.sessionId));
      if (session.status !== "scheduled") {
        throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be marked done");
      }
      if (req.body.followUpSession && !(SESSION_TYPES as readonly string[]).includes(req.body.followUpSession.sessionType)) {
        throw new AppError(400, "INVALID_ACTION", "Unknown follow-up session type");
      }
      const updated = await prisma.counselingSession.update({
        where: { id: session.id },
        data: {
          status: "completed",
          sessionNotes: req.body.sessionNotes.trim(),
          outcome: req.body.outcome?.trim() || null,
          completedAt: new Date(),
        },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_completed", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session completed", oldValue: { status: session.status }, newValue: { status: "completed" } });
      if (req.body.followUpSession) {
        const next = await prisma.counselingSession.create({
          data: {
            interventionId: row.id,
            sessionType: req.body.followUpSession.sessionType,
            scheduledAt: parseScheduledAt(req.body.followUpSession.scheduledAt),
            venue: req.body.followUpSession.venue?.trim() || null,
            status: "scheduled",
            createdBy: req.user!.id,
          },
        });
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: next.id, reason: "Follow-up session booked", oldValue: null, newValue: { sessionType: next.sessionType, scheduledAt: next.scheduledAt } });
      }
      // Auto-close: the final session is done, no next one was booked, and the
      // plan was already reviewed — the session notes become the closing record.
      if (!req.body.followUpSession && row.approvalStatus !== "pending") {
        const remaining = await prisma.counselingSession.count({
          where: { interventionId: row.id, status: "scheduled" },
        });
        if (remaining === 0) {
          const closedOn = (updated.completedAt ?? new Date()).toISOString().slice(0, 10);
          const record = [
            `Automatically closed after the final session on ${closedOn}.`,
            updated.outcome ? `Outcome: ${updated.outcome}` : "",
            updated.sessionNotes ? `Last session notes: ${updated.sessionNotes}` : "",
          ]
            .filter(Boolean)
            .join(" ")
            .slice(0, 2000);
          await prisma.intervention.update({
            where: { id: row.id },
            data: { outcomeStatus: "resolved", outcomeNotes: record },
          });
          await writeAudit({ userId: req.user!.id, actionType: "intervention_outcome", sourceTable: "interventions", sourceId: row.id, reason: "Auto-closed: final session done, no follow-up booked", oldValue: { outcomeStatus: row.outcomeStatus }, newValue: { outcomeStatus: "resolved" } });
        }
      }
      await invalidateTags(TAGS);
      res.json(formatSession(updated));
    } catch (e) { next(e); }
  }
);

const rescheduleInterventionSessionSchema = z.object({
  scheduledAt: z.string().min(1),
});

router.post(
  "/:id/sessions/:sessionId/reschedule",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", rescheduleInterventionSessionSchema),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      ensureWorkable(row);
      const session = await getInterventionSession(row.id, String(req.params.sessionId));
      if (session.status !== "scheduled") {
        throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be moved");
      }
      const nextDate = parseScheduledAt(req.body.scheduledAt);
      const updated = await prisma.counselingSession.update({
        where: { id: session.id },
        data: { scheduledAt: nextDate },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_rescheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session moved", oldValue: { scheduledAt: session.scheduledAt }, newValue: { scheduledAt: nextDate } });
      await invalidateTags(TAGS);
      res.json(formatSession(updated));
    } catch (e) { next(e); }
  }
);

const cancelInterventionSessionSchema = z.object({
  cancelReason: z.string().trim().max(500).optional(),
});

router.post(
  "/:id/sessions/:sessionId/cancel",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", cancelInterventionSessionSchema),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      ensureWorkable(row);
      const session = await getInterventionSession(row.id, String(req.params.sessionId));
      if (session.status !== "scheduled") {
        throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be cancelled");
      }
      const updated = await prisma.counselingSession.update({
        where: { id: session.id },
        data: {
          status: "cancelled",
          cancelReason: req.body.cancelReason?.trim() || null,
        },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_cancelled", sourceTable: "counseling_sessions", sourceId: session.id, reason: req.body.cancelReason?.trim() || "Counseling session cancelled", oldValue: { status: session.status }, newValue: { status: "cancelled" } });
      await invalidateTags(TAGS);
      res.json(formatSession(updated));
    } catch (e) { next(e); }
  }
);

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected", "modified"]),
  recommendedAction: z.string().trim().max(2000).optional(),
});

router.post(
  "/:id/review",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", reviewSchema),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      if (row.outcomeStatus === "resolved") {
        throw new AppError(400, "INVALID_ACTION", "A resolved intervention can no longer be reviewed");
      }
      if (req.body.decision === "modified" && !req.body.recommendedAction?.trim()) {
        throw new AppError(400, "INVALID_ACTION", "Write the adjusted action when modifying");
      }
      const updated = await prisma.intervention.update({
        where: { id: row.id },
        data: {
          approvalStatus: req.body.decision,
          ...(req.body.decision === "modified"
            ? { recommendedAction: req.body.recommendedAction.trim() }
            : {}),
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "intervention_approval",
        sourceTable: "interventions",
        sourceId: row.id,
        reason: `Review → ${req.body.decision}`,
        oldValue: { approvalStatus: row.approvalStatus },
        newValue: {
          approvalStatus: req.body.decision,
          ...(req.body.decision === "modified"
            ? { recommendedAction: req.body.recommendedAction.trim() }
            : {}),
        },
      });
      if (row.assignedTo && row.assignedTo !== req.user!.id) {
        await fanoutNotification({
          userId: row.assignedTo,
          sourceTable: "interventions",
          action: "approve",
          sourceId: row.id,
          message: `Your intervention was ${req.body.decision} by guidance`,
        });
      }
      await invalidateTags(TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

const assignSchema = z.object({
  assigneeId: z.string().min(1).nullable(),
});

router.post(
  "/:id/assign",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", assignSchema),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      if (row.outcomeStatus === "resolved") {
        throw new AppError(400, "INVALID_ACTION", "A resolved intervention can no longer be reassigned");
      }
      const assigneeId: string | null = req.body.assigneeId || null;
      if (assigneeId) {
        const user = await prisma.user.findUnique({ where: { id: assigneeId } });
        if (!user) throw new AppError(404, "NOT_FOUND", "Staff member not found");
      }
      const updated = await prisma.intervention.update({
        where: { id: row.id },
        data: {
          assignedTo: assigneeId,
          assignedAt: assigneeId ? new Date() : null,
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "intervention_assigned",
        sourceTable: "interventions",
        sourceId: row.id,
        reason: assigneeId ? "Intervention taken" : "Intervention released",
        oldValue: { assignedTo: row.assignedTo },
        newValue: { assignedTo: assigneeId },
      });
      if (assigneeId && assigneeId !== req.user!.id) {
        await fanoutNotification({
          userId: assigneeId,
          sourceTable: "interventions",
          action: "assign",
          sourceId: row.id,
          message: "An intervention was assigned to you by guidance",
        });
      }
      await invalidateTags(TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

const outcomeSchema = z.object({
  outcomeStatus: z.enum(["ongoing", "resolved", "unresolved"]),
  outcomeNotes: z.string().trim().max(2000).optional(),
});

router.post(
  "/:id/outcome",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", outcomeSchema),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      if (
        (req.body.outcomeStatus === "resolved" ||
          req.body.outcomeStatus === "unresolved") &&
        row.approvalStatus === "pending"
      ) {
        throw new AppError(400, "INVALID_ACTION", "Review the recommendation before closing the outcome");
      }
      // Strict close-out (same rule as referrals): a finished session plus a
      // closing note are mandatory before a follow-up can be closed.
      const closing =
        req.body.outcomeStatus === "resolved" ||
        req.body.outcomeStatus === "unresolved";
      if (closing) {
        const doneCount = await prisma.counselingSession.count({
          where: { interventionId: row.id, status: "completed" },
        });
        if (doneCount === 0) {
          throw new AppError(400, "OUTCOME_BLOCKED", "Finish at least one counseling session before closing this follow-up");
        }
        if (!req.body.outcomeNotes?.trim()) {
          throw new AppError(400, "OUTCOME_BLOCKED", "A closing note is required to close this follow-up");
        }
      }
      const updated = await prisma.intervention.update({
        where: { id: row.id },
        data: {
          outcomeStatus: req.body.outcomeStatus,
          outcomeNotes: req.body.outcomeNotes?.trim() || null,
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "intervention_outcome",
        sourceTable: "interventions",
        sourceId: row.id,
        reason: `Outcome → ${req.body.outcomeStatus}`,
        oldValue: { outcomeStatus: row.outcomeStatus },
        newValue: { outcomeStatus: req.body.outcomeStatus },
      });
      if (row.assignedTo && row.assignedTo !== req.user!.id) {
        await fanoutNotification({
          userId: row.assignedTo,
          sourceTable: "interventions",
          action: "outcome",
          sourceId: row.id,
          message: `Intervention outcome recorded: ${req.body.outcomeStatus}`,
        });
      }
      await invalidateTags(TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
