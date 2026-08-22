import { prisma } from "./prisma.js";
import { logger } from "./pino.js";
import type { NotifChannel } from "@prisma/client";

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
