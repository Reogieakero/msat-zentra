import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { GuidanceContext } from "./guidance.types.js";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function toTimeKey(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Booked times for the current counselor on one UTC calendar day.
 * Counts `scheduled` counseling sessions on both pipelines that belong to
 * the counselor — sessions they created, or intervention follow-ups assigned
 * to them. Cancelled/completed sessions never block a slot.
 */
export async function getDaySchedule(ctx: GuidanceContext, dateKey: string) {
  if (!DATE_KEY.test(dateKey)) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date.");
  }
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(`${dateKey}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date.");
  }

  const termClauses: any[] = [];
  if (ctx.termId) {
    termClauses.push({
      OR: [{ referral: { termId: ctx.termId } }, { intervention: { termId: ctx.termId } }],
    });
  }

  const rows = await prisma.counselingSession.findMany({
    where: {
      AND: [
        { status: "scheduled" },
        { scheduledAt: { gte: start, lte: end } },
        {
          OR: [{ createdBy: ctx.userId }, { intervention: { assignedTo: ctx.userId } }],
        },
        ...termClauses,
      ],
    },
    select: { scheduledAt: true },
  });

  const taken = [...new Set(rows.map((r) => toTimeKey(r.scheduledAt)))].sort();
  return { date: dateKey, taken };
}
