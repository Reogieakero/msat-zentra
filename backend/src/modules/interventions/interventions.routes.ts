import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { cache } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import { sessionCancelledByRole } from "../../lib/sessionActors.js";
import { clinicSessionObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import { getInterventionStudents } from "../risk/interventions.service.js";
import {
  evaluateRisk,
  evaluateRosterRisk,
  resolveActiveTermId,
} from "../../services/risk.js";

const router = Router();

// Session documentary uploads — same rules as the clinic desk: images only,
// 5 MB each, max 5 per request. Filing never gates Done; it only builds the
// evidence trail for sessions that already started (or are finished).
const sessionDocsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WEBP images are allowed for session documentation."));
    }
  },
});

function formatSessionDoc(row: {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
}) {
  return {
    id: row.id,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

// Documentation unlocks once the session time arrives — upcoming sessions
// can still be viewed but cannot take new files yet.
function ensureDocsUnlocked(session: { status: string; scheduledAt: Date }) {
  if (session.status === "scheduled" && session.scheduledAt.getTime() > Date.now()) {
    throw new AppError(
      400,
      "SESSION_NOT_STARTED",
      "This session hasn't started yet — documentation unlocks once the scheduled time arrives"
    );
  }
}

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
      // fullCohort enumerates the live enrollment (profiles + roster, no
      // account required) instead of starting from engine snapshots, so
      // at-risk students the engine hasn't flagged yet still appear.
      // includeRecovered keeps students whose risk cleared but whose
      // follow-up is still open, so the case can be discontinued on the
      // desk instead of silently vanishing from the queue.
      const cohort = await getInterventionStudents(
        { page: 1, pageSize: 1000, includeRecovered: true, fullCohort: true },
        req.termScope ?? undefined,
      );

      const factorKey =
        factorFilter === "Academic"
          ? "academic"
          : factorFilter === "Attendance"
            ? "attendance"
            : factorFilter === "Behavioral"
              ? "behavioral"
              : null;

      const matches = (s: (typeof cohort.students)[number]) => {
        // Recovered students (live Low, follow-up still open) stay visible
        // under every level view — they are actionable discontinue items,
        // not at-risk cases, so the level filter never hides them.
        const recovered =
          s.riskLevel === "Low" && s.intervention?.outcomeStatus === "ongoing";
        if (levelFilter !== "All" && s.riskLevel !== levelFilter && !recovered) return false;
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
        // Engine detection moment for the active term (RiskSnapshot date).
        // Null only for legacy rows — the table falls back to the follow-up
        // opened date, then to a dateless engine-flag label.
        detectedAt: s.snapshotDate ?? null,
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
              // Opened date for queue date columns (null for legacy rows).
              createdAt: s.intervention.createdAt,
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
                createdAt: sess.createdAt.toISOString(),
                completedAt: sess.completedAt ? sess.completedAt.toISOString() : "",
                attachmentsCount: sess.attachmentsCount ?? 0,
              })),
              completedSessions: s.intervention.sessions.filter(
                (sess) => sess.status === "completed"
              ).length,
            }
          : null,
      }));

      // Who cancelled each session (desk cancel vs adviser contexts) —
      // latest session_cancelled audit wins; never-cancelled stay null.
      const cancelledByRole = await sessionCancelledByRole(
        slice.flatMap((s) => (s.intervention?.sessions ?? []).map((sess) => sess.id))
      );
      for (const st of students) {
        const sessions = st.intervention?.sessions as
          | { id: string; cancelledByRole?: string | null }[]
          | undefined;
        if (sessions) {
          for (const sess of sessions) {
            sess.cancelledByRole = cancelledByRole.get(sess.id) ?? null;
          }
        }
      }

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

// Live engine breakdown for one student — powers the See-details risk
// panel (factors with real values, live vs stored vs flagged levels).
// Read-only; never writes snapshots or interventions.
router.get(
  "/engine",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      const studentId =
        typeof req.query.studentId === "string" && req.query.studentId
          ? req.query.studentId
          : null;
      const rosterId =
        typeof req.query.rosterId === "string" && req.query.rosterId
          ? req.query.rosterId
          : null;
      if ((studentId && rosterId) || (!studentId && !rosterId)) {
        throw new AppError(400, "INVALID_ACTION", "Pick exactly one student");
      }
      const termId = await resolveActiveTermId(req);
      if (!termId) throw new AppError(400, "NO_ACTIVE_TERM", "No active term to evaluate");
      const live = studentId
        ? await evaluateRisk(studentId, termId)
        : await evaluateRosterRisk(rosterId!, termId);

      const gradeWhere = studentId ? { studentId, termId } : { rosterId: rosterId!, termId };
      const attWhere = studentId ? { studentId, termId } : { rosterId: rosterId!, termId };
      const [grades, attendance, anecdotals, snapshot, flagged] = await Promise.all([
        prisma.finalGrade.findMany({
          where: gradeWhere,
          select: {
            computedAverage: true,
            transmutedGrade: true,
            subject: { select: { name: true, code: true } },
          },
          orderBy: { subject: { name: "asc" } },
        }),
        prisma.attendanceRecord.findMany({
          where: attWhere,
          select: {
            status: true,
            subjectId: true,
            subject: { select: { name: true, code: true } },
          },
        }),
        prisma.anecdotalRecord.findMany({
          where: studentId ? { studentId, termId } : { rosterId: rosterId!, termId },
          select: { category: true, observationDatetime: true },
          orderBy: { observationDatetime: "desc" },
          take: 5,
        }),
        prisma.riskSnapshot.findFirst({
          where: studentId ? { studentId, termId } : { rosterId: rosterId!, termId },
          orderBy: { snapshotDate: "desc" },
          select: { riskLevel: true, riskCount: true, snapshotDate: true },
        }),
        prisma.intervention.findFirst({
          where: studentId ? { studentId } : { rosterId: rosterId! },
          orderBy: { id: "desc" },
          select: { riskLevelAtFlag: true },
        }),
      ]);

      const present = attendance.filter((a) => a.status === "present").length;
      const subjectEra = attendance.some((a) => a.subjectId !== null);
      const rate = attendance.length > 0 ? present / attendance.length : null;
      // Raw percentage average across ALL final-grade subjects (display
      // basis; the engine flag itself runs on transmuted grades).
      const raws = grades
        .map((g) => g.computedAverage)
        .filter((v): v is number => typeof v === "number");
      const rawAverage =
        raws.length > 0 ? raws.reduce((s, v) => s + v, 0) / raws.length : null;
      // Transmuted mean — the number the Low/Clear badge actually answers
      // to. Shown beside the raw average so the badge reads coherently
      // (raw 67% routinely transmutes above the 75 line).
      const transmutes = grades
        .map((g) => g.transmutedGrade)
        .filter((v): v is number => typeof v === "number");
      const transmutedAverage =
        transmutes.length > 0
          ? transmutes.reduce((s, v) => s + v, 0) / transmutes.length
          : null;
      // Per-subject attendance (subject-era rows) + a General bucket for
      // legacy AM/PM rows without a subject.
      const bySubjectMap = new Map<
        string,
        { code: string; name: string; present: number; total: number }
      >();
      let generalPresent = 0;
      let generalTotal = 0;
      for (const a of attendance) {
        if (!a.subjectId) {
          generalTotal += 1;
          if (a.status === "present") generalPresent += 1;
          continue;
        }
        const key = a.subjectId;
        const entry = bySubjectMap.get(key) ?? {
          code: a.subject?.code ?? "",
          name: a.subject?.name ?? "Subject",
          present: 0,
          total: 0,
        };
        entry.total += 1;
        if (a.status === "present") entry.present += 1;
        bySubjectMap.set(key, entry);
      }
      const bySubject = [...bySubjectMap.values()]
        .map((s) => ({
          ...s,
          rate: s.total > 0 ? s.present / s.total : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json({
        live: {
          level: live.result.riskLevel,
          count: live.result.riskCount,
          academic: live.academicFlag,
          attendance: live.attendanceFlag,
          behavioral: live.behavioralFlag,
        },
        academic: {
          average: rawAverage,
          transmutedAverage,
          subjectCount: grades.length,
          threshold: 75,
          subjects: grades.map((g) => ({
            code: g.subject?.code ?? "",
            name: g.subject?.name ?? "Subject",
            computedAverage: g.computedAverage,
            transmutedGrade: g.transmutedGrade,
            below: (g.transmutedGrade ?? g.computedAverage ?? 100) < 75,
          })),
        },
        attendance: {
          rate,
          present,
          total: attendance.length,
          subjectEra,
          threshold: 0.8,
          bySubject,
          general:
            generalTotal > 0
              ? {
                  present: generalPresent,
                  total: generalTotal,
                  rate: generalPresent / generalTotal,
                }
              : null,
        },
        behavioral: {
          count: anecdotals.length,
          recent: anecdotals.map((a) => ({
            category: a.category,
            date: a.observationDatetime.toISOString().slice(0, 10),
          })),
        },
        stored: snapshot
          ? {
              level: snapshot.riskLevel,
              count: snapshot.riskCount,
              date: snapshot.snapshotDate.toISOString().slice(0, 10),
            }
          : null,
        flagged: flagged ? { level: flagged.riskLevelAtFlag } : null,
      });
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
  createdAt: Date;
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
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : "",
  };
}

/* "Oct 1, 2026, 9:30 AM" in Asia/Manila — same clock as the referral
   desk fanouts so session times read identically everywhere. */
function formatWhen(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function truncate(text: string | null | undefined, max = 100): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
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
      const termId = await resolveActiveTermId(req);
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
      notifyInterventionAdviser(created, req.user!.id, (name) => `Guidance opened a follow-up for ${name}.`);
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "interventions",
        action: "session",
        message: `You opened a ${liveLevel}-risk follow-up.`,
        sourceId: created.id,
      });
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

/* Section adviser behind an intervention — same resolution as the engine
   detection handoff (student/roster section). Used so every follow-up
   action reaches the adviser live, not just the case owner. */
async function adviserOf(row: {
  studentId: string | null;
  rosterId: string | null;
}): Promise<{ adviserId: string | null; studentName: string }> {
  if (row.studentId) {
    const s = await prisma.studentProfile.findUnique({
      where: { userId: row.studentId },
      select: {
        user: { select: { fullName: true } },
        section: { select: { adviserId: true } },
      },
    });
    if (!s) return { adviserId: null, studentName: "the student" };
    return { adviserId: s.section?.adviserId ?? null, studentName: s.user.fullName };
  }
  if (row.rosterId) {
    const r = await prisma.studentRoster.findUnique({
      where: { id: row.rosterId },
      select: { fullName: true, section: { select: { adviserId: true } } },
    });
    if (!r) return { adviserId: null, studentName: "the student" };
    return { adviserId: r.section?.adviserId ?? null, studentName: r.fullName };
  }
  return { adviserId: null, studentName: "the student" };
}

/* Adviser handoff for every follow-up mutation (background, off the
   critical path): the section adviser learns live via sileo + bell + badge
   on their desk's realtime channel. Skipped when there is no adviser, the
   adviser acted themselves, or they already got the owner fanout — never a
   double row. Best-effort, never throws. */
function notifyInterventionAdviser(
  row: { id: string; studentId: string | null; rosterId: string | null; assignedTo: string | null },
  actorId: string,
  message: (studentName: string) => string,
) {
  void (async () => {
    try {
      const { adviserId, studentName } = await adviserOf(row);
      if (!adviserId || adviserId === actorId || adviserId === row.assignedTo) return;
      await fanoutNotification({
        userId: adviserId,
        sourceTable: "interventions",
        action: "session",
        message: message(studentName),
        sourceId: row.id,
      });
    } catch {
      // Best-effort — the confirmed response already went out.
    }
  })();
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
      const when = formatWhen(created.scheduledAt);
      const venue = created.venue?.trim() ? ` at ${created.venue.trim()}` : "";
      let bookedFor = "the student";
      try {
        bookedFor = (await adviserOf(row)).studentName;
      } catch {
        // Default stands — the fanout below still lands.
      }
      res.status(201).json(formatSession(created));
      if (row.assignedTo && row.assignedTo !== req.user!.id) {
        void fanoutNotification({
          userId: row.assignedTo,
          sourceTable: "interventions",
          action: "session",
          message: `Guidance booked an intervention session for ${bookedFor} (${created.sessionType}, ${when}${venue}).`,
          sourceId: row.id,
        });
      }
      notifyInterventionAdviser(
        row,
        req.user!.id,
        (name) => `Guidance booked an intervention session for ${name} (${created.sessionType}, ${when}${venue}).`
      );
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "interventions",
        action: "session",
        message: `You booked an intervention session (${created.sessionType}, ${when}${venue}).`,
        sourceId: row.id,
      });
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
      const doneWhen = formatWhen(updated.scheduledAt);
      let doneFor = "the student";
      try {
        doneFor = (await adviserOf(row)).studentName;
      } catch {
        // Default stands — the fanout below still lands.
      }
      res.json(formatSession(updated));
      if (row.assignedTo && row.assignedTo !== req.user!.id) {
        void fanoutNotification({
          userId: row.assignedTo,
          sourceTable: "interventions",
          action: "session",
          message: `Guidance completed an intervention session for ${doneFor} (${updated.sessionType}, ${doneWhen}).`,
          sourceId: row.id,
        });
      }
      notifyInterventionAdviser(
        row,
        req.user!.id,
        (name) => `Guidance completed an intervention session for ${name} (${updated.sessionType}, ${doneWhen}).`
      );
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "interventions",
        action: "session",
        message: `You completed an intervention session (${updated.sessionType}, ${doneWhen}).`,
        sourceId: row.id,
      });
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
      const wasMoved = formatWhen(session.scheduledAt);
      const nowMoved = formatWhen(nextDate);
      let movedFor = "the student";
      try {
        movedFor = (await adviserOf(row)).studentName;
      } catch {
        // Default stands — the fanout below still lands.
      }
      res.json(formatSession(updated));
      if (row.assignedTo && row.assignedTo !== req.user!.id) {
        void fanoutNotification({
          userId: row.assignedTo,
          sourceTable: "interventions",
          action: "session",
          message: `Guidance rescheduled an intervention session for ${movedFor} — now ${nowMoved} (was ${wasMoved}).`,
          sourceId: row.id,
        });
      }
      notifyInterventionAdviser(
        row,
        req.user!.id,
        (name) => `Guidance rescheduled an intervention session for ${name} — now ${nowMoved} (was ${wasMoved}).`
      );
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "interventions",
        action: "session",
        message: `You rescheduled an intervention session — now ${nowMoved} (was ${wasMoved}).`,
        sourceId: row.id,
      });
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
      const wasDropped = formatWhen(session.scheduledAt);
      const whyDropped = truncate(req.body.cancelReason, 120);
      let droppedFor = "the student";
      try {
        droppedFor = (await adviserOf(row)).studentName;
      } catch {
        // Default stands — the fanout below still lands.
      }
      res.json(formatSession(updated));
      if (row.assignedTo && row.assignedTo !== req.user!.id) {
        void fanoutNotification({
          userId: row.assignedTo,
          sourceTable: "interventions",
          action: "session",
          message: `Guidance cancelled an intervention session for ${droppedFor} (${session.sessionType}, ${wasDropped})${whyDropped ? ` — ${whyDropped}` : ""}.`,
          sourceId: row.id,
        });
      }
      notifyInterventionAdviser(
        row,
        req.user!.id,
        (name) => `Guidance cancelled an intervention session for ${name} (${session.sessionType}, ${wasDropped})${whyDropped ? ` — ${whyDropped}` : ""}.`
      );
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "interventions",
        action: "session",
        message: `You cancelled an intervention session (${session.sessionType}, ${wasDropped}).`,
        sourceId: row.id,
      });
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
      notifyInterventionAdviser(
        row,
        req.user!.id,
        (name) => `Guidance ${req.body.decision} the intervention plan for ${name}.`
      );
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
      // No hand-offs while a session is still upcoming — finish or cancel it
      // first so the booked session never strands with the wrong handler.
      const upcoming = await prisma.counselingSession.count({
        where: { interventionId: row.id, status: "scheduled" },
      });
      if (upcoming > 0) {
        throw new AppError(400, "ACTIVE_SESSION_EXISTS", "This case has an upcoming session — finish or cancel it before reassigning");
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
      // No outcome while a session is still upcoming — finish or cancel it
      // first (same rule as endorsing: the booked session decides the case).
      // Strict close-out (same rule as referrals): a finished session plus a
      // closing note are mandatory before a follow-up can be closed — except
      // a discontinue close (unresolved) for a student whose live risk has
      // genuinely cleared to Low: there is nothing left to counsel, so the
      // closing note alone suffices and the case leaves the queue.
      const closing =
        req.body.outcomeStatus === "resolved" ||
        req.body.outcomeStatus === "unresolved";
      if (closing) {
        // Independent counts run in parallel.
        const [upcomingCount, doneCount] = await Promise.all([
          prisma.counselingSession.count({
            where: { interventionId: row.id, status: "scheduled" },
          }),
          prisma.counselingSession.count({
            where: { interventionId: row.id, status: "completed" },
          }),
        ]);
        if (upcomingCount > 0) {
          throw new AppError(400, "ACTIVE_SESSION_EXISTS", "This case has an upcoming session — finish or cancel it before recording the outcome");
        }
        if (doneCount === 0) {
          const termId = await resolveActiveTermId(req);
          const liveLevel = termId
            ? row.studentId
              ? (await evaluateRisk(row.studentId, termId)).result.riskLevel
              : row.rosterId
                ? (await evaluateRosterRisk(row.rosterId, termId)).result.riskLevel
                : null
            : null;
          if (req.body.outcomeStatus !== "unresolved" || liveLevel !== "Low") {
            throw new AppError(400, "OUTCOME_BLOCKED", "Finish at least one counseling session before closing this follow-up");
          }
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
      notifyInterventionAdviser(
        row,
        req.user!.id,
        (name) => `Guidance recorded an outcome for ${name}'s follow-up: ${req.body.outcomeStatus}.`
      );
      await invalidateTags(TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// Session documentary: list / upload / remove image attachments on one
// counseling session. Filing is optional — these endpoints never gate Done,
// they only build the evidence trail. Uploads are allowed on open cases (any
// session status except a closed follow-up) so documentation can be filed
// after marking a session done — but a still-upcoming session unlocks only
// once its scheduled time arrives.
router.get(
  "/:id/sessions/:sessionId/attachments",
  requireAuth,
  requireRole("guidance_counselor", "principal"),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      const session = await getInterventionSession(row.id, String(req.params.sessionId));
      const rows = await prisma.clinicSessionAttachment.findMany({
        where: { sessionId: session.id },
        orderBy: { uploadedAt: "asc" },
      });
      res.json(rows.map(formatSessionDoc));
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/sessions/:sessionId/attachments",
  requireAuth,
  requireRole("guidance_counselor"),
  sessionDocsUpload.array("files", 5),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      // Resolved follow-ups stay open for late documentary filing;
      // discontinued ones do not accumulate further evidence.
      if (row.outcomeStatus === "unresolved") {
        throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a discontinued follow-up");
      }
      const session = await getInterventionSession(row.id, String(req.params.sessionId));
      ensureDocsUnlocked(session);
      const files = ((req as unknown as { files?: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }> }).files ?? []);
      if (files.length === 0) {
        throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
      }
      const existing = await prisma.clinicSessionAttachment.count({
        where: { sessionId: session.id },
      });
      if (existing + files.length > 10) {
        throw new AppError(400, "BAD_REQUEST", "A session can hold at most 10 documentation images");
      }
      const created = await Promise.all(
        files.map(async (file) => {
          const path = clinicSessionObjectPath(session.id, file.originalname);
          const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
          return prisma.clinicSessionAttachment.create({
            data: {
              sessionId: session.id,
              fileUrl,
              fileName: file.originalname.slice(0, 200),
              mimeType: file.mimetype,
              fileSize: file.size,
              uploadedBy: req.user!.id,
            },
          });
        })
      );
      await writeAudit({
        userId: req.user!.id,
        actionType: "session_document_added",
        sourceTable: "counseling_sessions",
        sourceId: session.id,
        reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
        oldValue: null,
        newValue: { count: created.length },
      });
      await invalidateTags(TAGS);
      res.status(201).json(created.map(formatSessionDoc));
    } catch (e) { next(e); }
  }
);

// Session list for one follow-up — powers the booking-reminder liveness
// check (card drops only while a scheduled session still exists).
router.get(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      const sessions = await prisma.counselingSession.findMany({
        where: { interventionId: row.id },
        orderBy: { scheduledAt: "asc" },
      });
      res.json(sessions.map(formatSession));
    } catch (e) { next(e); }
  }
);

router.delete(
  "/:id/sessions/:sessionId/attachments/:attachmentId",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      const row = await getIntervention(String(req.params.id));
      if (row.outcomeStatus === "unresolved") {
        throw new AppError(400, "INVALID_ACTION", "Cannot remove documentation from a discontinued follow-up");
      }
      const session = await getInterventionSession(row.id, String(req.params.sessionId));
      const doc = await prisma.clinicSessionAttachment.findUnique({
        where: { id: String(req.params.attachmentId) },
      });
      if (!doc || doc.sessionId !== session.id) {
        throw new AppError(404, "NOT_FOUND", "Documentation not found");
      }
      await prisma.clinicSessionAttachment.delete({ where: { id: doc.id } });
      await writeAudit({
        userId: req.user!.id,
        actionType: "session_document_added",
        sourceTable: "counseling_sessions",
        sourceId: session.id,
        reason: `Documentation removed: ${doc.fileName}`,
        oldValue: { fileName: doc.fileName },
        newValue: null,
      });
      await invalidateTags(TAGS);
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

export default router;
