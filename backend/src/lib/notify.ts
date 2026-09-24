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
  "interventions:approve": "intervention_approved",
  "sf10_records:validate": "sf10_validated",
  "audit_logs:alert": "audit_alert",
  "anecdotal_record_followups:create": "new_followup",
  "referrals:status": "referral_status_change",
  "adviser_sf10_access_requests:approve": "sf10_access_decision",
  "adviser_sf10_access_requests:deny": "sf10_access_decision",
  "adm_devices:issue": "device_issued",
  "adm_devices:return": "device_returned",
  "adm_parent_meetings:book": "meeting_booked",
  "adm_parent_meetings:reschedule": "meeting_rescheduled",
  "adm_parent_meetings:outcome": "meeting_outcome",
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
    // action must not create a second inbox row.
    if (input.sourceId) {
      const recent = await prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
        select: { id: true },
      });
      if (recent) return;
    }
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        message: input.message,
        channel: input.channel ?? ["web", "mobile", "email"],
      },
    });
  } catch (e) {
    logger.error({ err: e, userId: input.userId }, "notification fanout failed");
  }
}

// Role fanout: notify every active user holding `role` (bounded), excluding
// the actor. Best-effort — never throws, never delays the confirmed response.
// Callers invoke it with `void` after `res.json`. The 60s per-user dedup in
// fanoutNotification suppresses doubles when the same recipient is also
// notified directly (e.g. preparedBy + role fanout).
export async function fanoutToRole(
  role: string,
  input: Omit<NotifyInput, "userId"> & { excludeUserId?: string },
) {
  try {
    const users = await prisma.user.findMany({
      where: { role: role as never, status: "active" },
      select: { id: true },
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
            message: input.message,
            sourceId: input.sourceId,
            channel: input.channel,
          }),
        ),
    );
  } catch (e) {
    logger.error({ err: e, role }, "role notification fanout failed");
  }
}
