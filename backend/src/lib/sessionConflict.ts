import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
import {
  archivedAdvisoryLearnerIds,
  excludeArchivedSessionLearners,
} from "./learnerVisibility.js";

/**
 * Every counseling session occupies a fixed one-hour block. Sessions carry no
 * duration column, so the desk treats any two bookings that start less than a
 * block apart as overlapping (back-to-back is fine: 9:00 then 10:00).
 */
export const SESSION_BLOCK_MINUTES = 60;
const BLOCK_MS = SESSION_BLOCK_MINUTES * 60_000;

/** Minimal Prisma surface so the guard works inside a transaction too. */
type SessionDb = Pick<typeof prisma, "counselingSession">;

/**
 * Rejects a booking that would overlap another session already on the same
 * counselor's calendar (sessions they created, or intervention follow-ups
 * assigned to them — the same scope `getDaySchedule` marks as "taken").
 *
 * Authoritative guard behind the overlay's availability note: two desks can
 * hold the same slot open, so the conflict has to be decided on write.
 */
export async function assertSessionSlotFree(
  db: SessionDb,
  args: {
    scheduledAt: Date;
    counselorId: string;
    /** Moving an existing session — that row never conflicts with itself. */
    excludeSessionId?: string;
  },
): Promise<void> {
  const start = args.scheduledAt.getTime();
  const archivedLearners = await archivedAdvisoryLearnerIds();
  const clash = await db.counselingSession.findFirst({
    where: {
      status: "scheduled",
      ...(args.excludeSessionId ? { id: { not: args.excludeSessionId } } : {}),
      scheduledAt: {
        gt: new Date(start - BLOCK_MS),
        lt: new Date(start + BLOCK_MS),
      },
      OR: [
        { createdBy: args.counselorId },
        { intervention: { assignedTo: args.counselorId } },
      ],
      // A learner the adviser deleted no longer holds a slot.
      ...excludeArchivedSessionLearners(archivedLearners),
    },
    select: { scheduledAt: true },
  });
  if (!clash) return;
  throw new AppError(
    409,
    "SESSION_CONFLICT",
    "This time overlaps another booked session. Pick another time or date.",
  );
}
