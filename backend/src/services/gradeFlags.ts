import { prisma } from "../lib/prisma.js";
import { getEnv } from "../config/env.js";

const DAY_MS = 86_400_000;

export function escalationThresholdDays(): number {
  try {
    return getEnv().GRADE_FLAG_ESCALATION_DAYS;
  } catch {
    return 7;
  }
}

export function overdueCutoff(now: Date, thresholdDays: number): Date {
  return new Date(now.getTime() - thresholdDays * DAY_MS);
}

export function isOverdue(createdAt: Date, now: Date, thresholdDays: number): boolean {
  return createdAt.getTime() < overdueCutoff(now, thresholdDays).getTime();
}

export async function runEscalation(now: Date = new Date()): Promise<number> {
  const cutoff = overdueCutoff(now, escalationThresholdDays());
  const res = await prisma.gradeFlag.updateMany({
    where: { status: "open", createdAt: { lt: cutoff } },
    data: { status: "escalated", escalatedAt: now },
  });
  return res.count;
}
