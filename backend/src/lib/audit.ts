import { prisma } from "./prisma.js";
import { logger } from "./pino.js";
import type { ActionType } from "@prisma/client";

interface AuditInput {
  userId: string;
  actionType: ActionType;
  sourceTable: string;
  sourceId: string;
  reason?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function writeAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        actionType: input.actionType,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        reason: input.reason,
        oldValue: input.oldValue as object | undefined,
        newValue: input.newValue as object | undefined,
      },
    });
  } catch (e) {
    logger.error({ err: e, actionType: input.actionType }, "audit_log write failed");
  }
}
