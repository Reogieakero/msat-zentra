import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

// Shared referral data-access: desk pagination, notification card helpers,
// term guards, role-aware referral getters, and session guards/formatters
// used by more than one service. Endpoint-specific orchestration lives in
// src/services/referrals/*.service.ts.

/* Desk-level pagination standard: full list pages = 15, overview previews
   page at same list size (or 10). Backend accepts both `pageSize` (new) and
   `limit` (legacy). */
export const NURSE_QUEUE_PAGE_SIZE = 15;
export const NURSE_QUEUE_MAX_PAGE_SIZE = 100;

export const NURSE_CACHE_TAGS = [
  "nurse",
  "nurse-overview",
  "nurse-alerts",
  "nurse-referrals",
  "nurse-clinic",
  "nurse-adm",
  "nurse-risk",
] as const;

export function resolveQueuePageSize(req: { query: unknown }): number {
  const q = req.query as Record<string, unknown>;
  const raw =
    typeof q.pageSize !== "undefined" ? Number(q.pageSize) : Number(q.limit);
  if (!Number.isFinite(raw) || raw <= 0) return NURSE_QUEUE_PAGE_SIZE;
  return Math.min(Math.floor(raw), NURSE_QUEUE_MAX_PAGE_SIZE);
}

// Cache tags purged after any referral write, so every desk
// (guidance/nurse/teacher/ADM/overview) re-reads fresh queue state.
export const REFERRAL_WRITE_TAGS = [
  "guidance",
  "overview",
  "alerts",
  "referrals",
  "adm",
  "teacher",
  "nurse",
  "nurse-overview",
  "nurse-alerts",
  "nurse-referrals",
  "nurse-clinic",
  "nurse-adm",
  "nurse-risk",
];

// Detailed notification cards: every referral fanout names the student +
// section (+ session when/venue or reason snippet where relevant) instead of
// a bare "your referral was updated". Key phrases stay contiguous so the
// frontend `toastTitleFor` matchers keep matching (details ride at the end).
export function truncate(text: string | null | undefined, max = 100): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

export function formatWhen(d: Date): string {
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

export interface ReferralCard {
  /** e.g. "Maria Santos (G7 – Ruby)" or "Maria Santos" when section is unknown. */
  who: string;
  studentName: string;
  sectionName: string;
  filerName: string;
}

export async function referralCard(referral: {
  studentId: string | null;
  rosterId: string | null;
  referredBy: string | null;
}): Promise<ReferralCard> {
  // Note: referral.studentId is a User id (registered students file under
  // their account), so names resolve through User, not StudentProfile.
  const [account, roster, filer] = await Promise.all([
    referral.studentId
      ? prisma.user.findUnique({
          where: { id: referral.studentId },
          select: {
            fullName: true,
            studentProfile: { select: { section: { select: { name: true } } } },
          },
        })
      : null,
    referral.rosterId
      ? prisma.studentRoster.findUnique({
          where: { id: referral.rosterId },
          select: { fullName: true, section: { select: { name: true } } },
        })
      : null,
    referral.referredBy
      ? prisma.user.findUnique({
          where: { id: referral.referredBy },
          select: { fullName: true },
        })
      : null,
  ]);
  const studentName = account?.fullName ?? roster?.fullName ?? "the student";
  const sectionName =
    account?.studentProfile?.section?.name ?? roster?.section?.name ?? "";
  return {
    who: sectionName ? `${studentName} (${sectionName})` : studentName,
    studentName,
    sectionName,
    filerName: filer?.fullName ?? "the filing teacher",
  };
}

/* Display name of the acting user for handoff messages — one lookup per
   call site, "Someone" fallback so a deleted/renamed account never blanks
   the notification. */
export async function actorName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  return u?.fullName ?? "Someone";
}

export function assertActiveTerm(referral: { termId: string }, scopeTermId: string | null) {
  // Prior-term cases are read-only history — session reads/writes stay in
  // the active term so the desk never leaks cases across terms.
  if (scopeTermId && referral.termId !== scopeTermId) {
    throw new AppError(404, "NOT_FOUND", "Referral not found in the active term");
  }
}

export const SESSION_TYPES = ["individual", "parent_conference", "group", "home_visit"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export function isSessionType(value: unknown): value is SessionType {
  return typeof value === "string" && (SESSION_TYPES as readonly string[]).includes(value);
}

export async function getGuidanceReferral(id: string, scopeTermId?: string | null) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  if (referral.referredToRole !== "guidance_counselor") {
    throw new AppError(403, "FORBIDDEN", "Not routed to guidance");
  }
  assertActiveTerm(referral, scopeTermId ?? null);
  return referral;
}

// Clinic cases on the nurse's own desk (direct referrals + escalations to
// the nurse). Session management below accepts these exactly like guidance
// cases, so the nurse referrals page runs the same accept → sessions →
// close workflow.
export async function getNurseClinicReferral(id: string, scopeTermId?: string | null) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  const onNurseDesk =
    referral.referredToRole === "nurse" ||
    (referral.status === "escalated" && referral.escalatedTo === "nurse");
  if (!onNurseDesk) {
    throw new AppError(403, "FORBIDDEN", "Not routed to the clinic");
  }
  assertActiveTerm(referral, scopeTermId ?? null);
  return referral;
}

// Role-aware referral getter for the shared session endpoints.
export async function getSessionReferral(id: string, role: string, scopeTermId?: string | null) {
  if (role === "nurse") {
    // Clinic desk first; ADM consultations picked for the nurse may also
    // carry standalone clinic sessions (booked from the review dialog
    // without deciding the case), so they fall through to the ADM getter.
    try {
      return await getNurseClinicReferral(id, scopeTermId);
    } catch {
      return await getNurseAdmSessionsReferral(id, scopeTermId);
    }
  }
  if (role === "guidance_counselor") {
    // Guidance desk first; ADM consultations picked for (or left with)
    // guidance may also carry sessions booked from the ADM review, so
    // they fall through to the ADM getter the same way the nurse desk does.
    try {
      return await getGuidanceReferral(id, scopeTermId);
    } catch {
      return await getGuidanceAdmSessionsReferral(id, scopeTermId);
    }
  }
  return getGuidanceReferral(id, scopeTermId);
}

// Session scope for nurse ADM consultations: the case must be ADM-track and
// picked for the nurse. No consultation-stage or status gate here —
// standalone sessions can be booked while pending (pre-confirm) and stay
// visible afterwards; closing the case itself still blocks changes via
// ensureOpen at each endpoint.
export async function getNurseAdmSessionsReferral(id: string, scopeTermId?: string | null) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (
    !referral ||
    referral.referredToRole !== "adm_coordinator" ||
    referral.consultReviewer !== "nurse"
  ) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  assertActiveTerm(referral, scopeTermId ?? null);
  return referral;
}

// Session scope for guidance ADM consultations: the case must be ADM-track
// and picked for (or left with) guidance — same receiver rule as the
// consultation review endpoint. Standalone sessions can be booked while
// pending (pre-decision) and stay visible afterwards; closing the case
// itself still blocks changes via ensureOpen at each endpoint.
export async function getGuidanceAdmSessionsReferral(id: string, scopeTermId?: string | null) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (
    !referral ||
    referral.referredToRole !== "adm_coordinator" ||
    (referral.consultReviewer !== null &&
      referral.consultReviewer !== undefined &&
      referral.consultReviewer !== "guidance_counselor")
  ) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  assertActiveTerm(referral, scopeTermId ?? null);
  return referral;
}

// Shared guards for every nurse ADM-consultation action: the case must be
// an ADM-track referral at the consultation stage picked for the nurse.
// Receiver enforcement lives here so a case picked for guidance or LRPC
// cannot be decided from the clinic queue, even if its id is known.
export async function getNurseAdmConsultation(id: string, scopeTermId?: string | null) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (
    !referral ||
    referral.referredToRole !== "adm_coordinator" ||
    (await prisma.admLearnerProfile.count({ where: { referralId: referral.id } })) > 0
  ) {
    throw new AppError(
      404,
      "NOT_ADM_CONSULTATION",
      "Only an ADM referral awaiting consultation review can be reviewed here"
    );
  }
  if (referral.consultReviewer !== "nurse") {
    throw new AppError(
      403,
      "NOT_YOUR_QUEUE",
      "This case was routed to another consultation reviewer"
    );
  }
  assertActiveTerm(referral, scopeTermId ?? null);
  return referral;
}

export function parseScheduledAt(value: unknown): Date {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date and time for the session");
  }
  return date;
}

export function formatAttachment(row: {
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

export function formatSession(row: {
  id: string;
  sessionType: string;
  scheduledAt: Date;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  createdAt?: Date | null;
  completedAt: Date | null;
  creator?: { fullName: string } | null;
  attachments?: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: Date;
  }>;
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
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdBy: row.creator?.fullName ?? "",
    attachments: (row.attachments ?? []).map(formatAttachment),
  };
}

export async function getSession(referralId: string, sessionId: string) {
  const session = await prisma.counselingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.referralId !== referralId) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  return session;
}

export function ensureOpen(referral: { status: string }) {
  if (referral.status === "resolved" || referral.status === "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Cannot change sessions on a closed case");
  }
}

// One active session per referral: booking is blocked while the referral
// still has a session that is not done yet (status === "scheduled").
// Pass exceptSessionId when the caller is completing that session and
// booking its follow-up in the same request.
export async function ensureNoActiveSession(referralId: string, exceptSessionId?: string) {
  const active = await prisma.counselingSession.count({
    where: {
      referralId,
      status: "scheduled",
      ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
    },
  });
  if (active > 0) {
    throw new AppError(
      400,
      "ACTIVE_SESSION_EXISTS",
      "This referral already has a session that is not done yet — finish or cancel it before booking another one"
    );
  }
}

// Clinic/counseling sessions unlock only once their scheduled time arrives:
// a still-upcoming session can be moved or cancelled, but it cannot be
// marked done and cannot take documentation yet.
export function ensureSessionStarted(session: { scheduledAt: Date }) {
  if (session.scheduledAt.getTime() > Date.now()) {
    throw new AppError(
      400,
      "SESSION_NOT_STARTED",
      "This session hasn't started yet — you can mark it done and file documentation once the scheduled time arrives"
    );
  }
}
