import { prisma } from "./prisma.js";
import { logger } from "./pino.js";
import type { NotifChannel } from "../generated/prisma/client.js";

// O7: notification `type` is DERIVED from sourceTable+action, never caller-supplied.
// Single source of truth for the mapping below.
type SourceAction = { sourceTable: string; action: string };

const TYPE_MAP: Record<string, string> = {
  "adm_learner_profiles:certify": "new_adm_case",
  "adm_learner_profiles:principal_approve": "new_adm_case",
  "users:approve": "account_approval",
  "users:approve_self": "account_approval",
  "users:reject_self": "account_approval",
  "interventions:approve": "intervention_approved",
  "interventions:detect": "intervention_detected",
  "interventions:session": "intervention_session",
  "interventions:session_self": "intervention_session_self",
  "interventions:assign": "intervention_assigned",
  "interventions:assign_self": "intervention_assigned_self",
  "interventions:outcome": "intervention_outcome",
  "interventions:outcome_self": "intervention_outcome_self",
  "sf10_records:validate": "sf10_validated",
  "audit_logs:alert": "audit_alert",
  "anecdotal_record_followups:create": "new_followup",
  "referrals:status": "referral_status_change",
  "adviser_sf10_access_requests:approve": "sf10_access_decision",
  "adviser_sf10_access_requests:deny": "sf10_access_decision",
  "adviser_sf10_access_requests:create": "sf10_access_requested",
  "adviser_sf10_access_requests:decide_self": "sf10_access_decision",
  "users:pending_signup": "account_pending",
  "final_grades:adviser_approved": "finals_ready",
  "sf10_records:verified": "sf10_needs_validation",
  "sf10_records:validate_self": "sf10_validated",
  "sf10_records:release_self": "sf10_released",
  "subjects:mutate_self": "academics_updated",
  "sections:mutate_self": "academics_updated",
  "teacher_subject_assignments:mutate_self": "academics_updated",
  "adm_devices:issue": "device_issued",
  "adm_devices:return": "device_returned",
  "adm_devices:issue_self": "device_issued_self",
  "adm_devices:return_self": "device_returned_self",
  "adm_devices:overdue": "device_overdue",
  "attendance_records:subject_create": "attendance_subject_alert",
  "attendance_records:subject_submit": "attendance_submitted",
  "adm_parent_meetings:book": "meeting_booked",
  "adm_parent_meetings:reschedule": "meeting_rescheduled",
  "adm_parent_meetings:outcome": "meeting_outcome",
  "adm_parent_meetings:book_self": "meeting_booked_self",
  "adm_parent_meetings:reschedule_self": "meeting_rescheduled_self",
  "adm_parent_meetings:outcome_self": "meeting_outcome_self",
  "adm_parent_meetings:cancel": "meeting_cancelled",
  "adm_learner_profiles:decide": "adm_decision",
  "adm_learner_profiles:decide_self": "adm_decision_self",
  "adm_learner_profiles:endorse": "adm_endorse",
  "adm_learner_profiles:endorse_self": "adm_endorse_self",
  "adm_learner_profiles:forward_self": "adm_forward_self",
  "adm_learner_profiles:certify_self": "adm_certify_self",
  "adm_learner_profiles:complete_self": "adm_complete_self",
  "adm_learner_profiles:principal_verdict": "principal_verdict",
  "referrals:filed": "new_adm_referral",
  "referrals:form": "referral_form_saved",
  "referrals:form_self": "referral_form_saved_self",
  "referrals:delete_self": "referral_deleted_self",
  "attendance_records:create": "attendance_created",
  "student_grades:score": "score_saved",
  "student_grades:score_self": "score_saved_self",
  "student_roster:create": "roster_enlisted",
  "student_roster:create_self": "roster_enlisted_self",
  "adviser_archived_students:create": "roster_archived",
  "adviser_archived_students:create_self": "roster_archived_self",
  "adviser_archived_students:delete": "roster_restored",
  "adviser_archived_students:delete_self": "roster_restored_self",
  "anecdotal_records:create": "anecdotal_filed",
  "anecdotal_records:create_self": "anecdotal_filed_self",
  "counseling_sessions:delete": "session_deleted",
  "counseling_sessions:delete_self": "session_deleted_self",
  "counseling_sessions:cancel": "session_cancelled",
  "counseling_sessions:cancel_self": "session_cancelled_self",
  "session_attachments:create": "attachment_created",
  "session_attachments:create_self": "attachment_created_self",
  "session_attachments:delete": "attachment_deleted",
  "session_attachments:delete_self": "attachment_deleted_self",
  "section_timetable_entries:submit": "schedule_submitted",
  "section_timetable_entries:approve": "schedule_approved",
  "section_timetable_entries:reject": "schedule_rejected",
  "teacher_names:claim": "teacher_code_claimed",
  "teacher_names:claim_self": "teacher_code_claimed_self",
  "section_timetable_entries:schedule_update": "schedule_updated",
  "staff_profiles:master_take": "master_teacher_changed",
  "teacher_names:unclaim": "teacher_code_released",
  "teacher_names:attendance_unlock": "attendance_unlocked",
};

export function deriveNotifType(sourceTable: string, action: string): string {
  return TYPE_MAP[`${sourceTable}:${action}`] ?? `generic_${sourceTable}_${action}`;
}

export interface NotifyInput {
  userId: string;
  sourceTable: string;
  action: string;
  message: string;
  sourceId?: string;
  channel?: NotifChannel[];
}

export async function fanoutNotification(input: NotifyInput) {
  try {
    const type = deriveNotifType(input.sourceTable, input.action);
    // Dedup: a retry/double-submit within 60s for the same user + source +
    // action + identical message must not create a second inbox row. The
    // message is part of the identity on purpose: distinct events on the
    // same case (book then cancel seconds later) carry different messages
    // and must BOTH land — an earlier coarse key (user + type + source +
    // id only) silently ate the second event. The check + insert run under
    // a keyed advisory lock so parallel saves (e.g. a save-all batch)
    // cannot slip duplicates past each other.
    const message = input.message ?? "";
    await prisma.$transaction(async (tx) => {
      if (input.sourceId) {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1))`,
          `${input.userId}|${type}|${input.sourceTable}|${input.sourceId}|${message}`,
        );
        const recent = await tx.notification.findFirst({
          where: {
            userId: input.userId,
            type,
            sourceTable: input.sourceTable,
            sourceId: input.sourceId,
            message,
            createdAt: { gte: new Date(Date.now() - 60_000) },
          },
          select: { id: true },
        });
        if (recent) return;
      }
      await tx.notification.create({
        data: {
          userId: input.userId,
          type,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          message: input.message,
          channel: input.channel ?? ["web", "mobile", "email"],
        },
      });
    });
  } catch (e) {
    logger.error({ err: e, userId: input.userId }, "notification fanout failed");
  }
}

// Engine detection handoff: a newly auto-created Moderate/High intervention
// notifies the assigned guidance counselor (role fanout — every active
// counselor learns) plus the student's section adviser directly. Best-effort
// — never throws; callers invoke it with `void` so engine recomputes never
// delay the confirmed response.
export async function notifyInterventionDetected(input: {
  level: string;
  interventionId: string;
  studentId?: string | null;
  rosterId?: string | null;
}) {
  try {
    let name = "A student";
    let section = "";
    let adviserId: string | null = null;
    if (input.studentId) {
      const s = await prisma.studentProfile.findUnique({
        where: { userId: input.studentId },
        select: {
          user: { select: { fullName: true } },
          section: { select: { name: true, adviserId: true } },
        },
      });
      if (s) {
        name = s.user.fullName;
        section = s.section?.name ?? "";
        adviserId = s.section?.adviserId ?? null;
      }
    } else if (input.rosterId) {
      const r = await prisma.studentRoster.findUnique({
        where: { id: input.rosterId },
        select: {
          fullName: true,
          section: { select: { name: true, adviserId: true } },
        },
      });
      if (r) {
        name = r.fullName;
        section = r.section?.name ?? "";
        adviserId = r.section?.adviserId ?? null;
      }
    }
    const who = `${name}${section ? ` (${section})` : ""}`;
    await fanoutToRole("guidance_counselor", {
      sourceTable: "interventions",
      action: "detect",
      message: `New ${input.level}-risk intervention: ${who} — auto-flagged for follow-up.`,
      sourceId: input.interventionId,
    });
    if (adviserId) {
      await fanoutNotification({
        userId: adviserId,
        sourceTable: "interventions",
        action: "detect",
        message: `Your advisee ${who} was flagged ${input.level} risk — a guidance intervention was opened.`,
        sourceId: input.interventionId,
      });
    }
  } catch (e) {
    logger.error({ err: e, interventionId: input.interventionId }, "intervention detect fanout failed");
  }
}

// Role fanout: notify every active user holding `role` (bounded), excluding
// the actor. Best-effort — never throws, never delays the confirmed response.
// Callers invoke it with `void` after `res.json`. The 60s per-user dedup in
// fanoutNotification suppresses doubles when the same recipient is also
// notified directly (e.g. preparedBy + role fanout).
//
// `messageFor` personalizes the text per recipient — handoff messages name
// the actor AND the receiving user ("…referred to you, Juan Dela Cruz —
// filed by Ana Reyes"), so each inbox row reads for its owner. The callback
// receives the recipient's id + fullName; plain `message` keeps working for
// callers that don't personalize.
export async function fanoutToRole(
  role: string,
  input: Omit<NotifyInput, "userId"> & {
    excludeUserId?: string;
    messageFor?: (recipient: { id: string; fullName: string }) => string;
  },
) {
  try {
    const users = await prisma.user.findMany({
      where: { role: role as never, status: "active" },
      select: { id: true, fullName: true },
      take: 10,
    });
    await Promise.all(
      users
        .filter((u) => u.id !== input.excludeUserId)
        .map((u) =>
          fanoutNotification({
            userId: u.id,
            sourceTable: input.sourceTable,
            action: input.action,
            message: input.messageFor?.(u) ?? input.message,
            sourceId: input.sourceId,
            channel: input.channel,
          }),
        ),
    );
  } catch (e) {
    logger.error({ err: e, role }, "role notification fanout failed");
  }
}

// Own-bell receipt for registrar/record-keeper academics writes
// (subject/section/assignment create/update/delete). One-liner for call
// sites; best-effort, never throws. The actor's echo toast is suppressed
// client-side — the mutation toast already confirmed it.
export async function notifyAcademicsSelf(input: {
  userId: string;
  sourceTable: "subjects" | "sections" | "teacher_subject_assignments";
  verb: "created" | "updated" | "assigned" | "removed";
  label: string;
  sourceId: string;
}) {
  try {
    await fanoutNotification({
      userId: input.userId,
      sourceTable: input.sourceTable,
      action: "mutate_self",
      message: `You ${input.verb} ${input.label}.`,
      sourceId: input.sourceId,
    });
  } catch (e) {
    logger.error({ err: e, sourceId: input.sourceId }, "academics self fanout failed");
  }
}
// every active registrar (G11-12 band). No creation endpoint writes this table
// yet (rows are seeded/reviewed via registrar routes) — callers invoke with
// `void` after `res.json` once a creation path exists. Best-effort, never throws.
export async function notifyAccessRequestCreated(input: {
  requestId: string;
  adviserName: string;
  sectionName: string;
  adviseeCount: number;
  reason?: string | null;
  excludeUserId?: string;
}) {
  try {
    const reason = input.reason?.trim() ? ` — ${input.reason.trim()}` : "";
    await fanoutToRole("registrar", {
      sourceTable: "adviser_sf10_access_requests",
      action: "create",
      message:
        `SF10 access requested: Adviser ${input.adviserName} — ` +
        `${input.sectionName} (${input.adviseeCount} advisees)${reason}`,
      sourceId: input.requestId,
      excludeUserId: input.excludeUserId,
    });
  } catch (e) {
    logger.error({ err: e, requestId: input.requestId }, "access request fanout failed");
  }
}
