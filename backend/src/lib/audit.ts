import { prisma } from "./prisma.js";
import { logger } from "./pino.js";
import type { ActionType } from "../generated/prisma/client.js";

interface AuditInput {
  userId: string;
  actionType: ActionType;
  sourceTable: string;
  sourceId: string;
  reason?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Minimal surface for atomic audit writes (e.g. a `prisma.$transaction` client). */
export interface AuditDb {
  auditLog: {
    create: (args: {
      data: {
        userId: string;
        actionType: ActionType;
        sourceTable: string;
        sourceId: string;
        reason?: string;
        oldValue?: object | undefined;
        newValue?: object | undefined;
      };
    }) => Promise<unknown>;
  };
}

export async function writeAudit(input: AuditInput, db?: AuditDb) {
  const client: AuditDb = db ?? (prisma as unknown as AuditDb);
  try {
    await client.auditLog.create({
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
    if (db) {
      // Inside a caller-owned transaction the audit row must commit atomically
      // with the mutation — fail loudly so nothing commits without its trail.
      throw e;
    }
    logger.error({ err: e, actionType: input.actionType }, "audit_log write failed");
  }
}
