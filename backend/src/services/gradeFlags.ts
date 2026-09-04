import { prisma } from "../lib/prisma.js";
import { getEnv } from "../config/env.js";

const DAY_MS = 86_400_000;

// Configured escalation threshold (days). Open flags older than this flip to
// `escalated` for the Principal dashboard.
export function escalationThresholdDays(): number {
  try {
    return getEnv().GRADE_FLAG_ESCALATION_DAYS;
  } catch {
    return 7;
  }
}

// Pure cutoff helper (unit-testable without a DB).
export function overdueCutoff(now: Date, thresholdDays: number): Date {
  return new Date(now.getTime() - thresholdDays * DAY_MS);
}

export function isOverdue(createdAt: Date, now: Date, thresholdDays: number): boolean {
  return createdAt.getTime() < overdueCutoff(now, thresholdDays).getTime();
}

// Flip overdue `open` flags to `escalated`. Runs lazily on grade-flag reads
// and hourly from the server interval (see index.ts). Editing a grade never
// auto-resolves a flag — resolution is always explicit via the resolve route.
export async function runEscalation(now: Date = new Date()): Promise<number> {
  const cutoff = overdueCutoff(now, escalationThresholdDays());
  const res = await prisma.gradeFlag.updateMany({
    where: { status: "open", createdAt: { lt: cutoff } },
    data: { status: "escalated", escalatedAt: now },
  });
  return res.count;
}
