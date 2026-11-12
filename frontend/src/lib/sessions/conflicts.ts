/**
 * Session booking conflicts.
 *
 * Every counseling session occupies a fixed one-hour block, so two bookings
 * that start less than a block apart overlap. Back-to-back is fine
 * (9:00 then 10:00) — that is how the desks have always booked.
 *
 * The backend enforces the same rule on write
 * (`backend/src/lib/sessionConflict.ts`); these helpers drive the overlay's
 * availability note and the greyed-out slots.
 */
export const SESSION_BLOCK_MINUTES = 60;

/** "09:30" → 570. Null when the value is not a clock key. */
export function minutesOf(key: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(key);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** The booked start time this choice collides with, if any. */
export function findOverlappingBooking(
  timeKey: string,
  taken: readonly string[],
): string | null {
  const chosen = minutesOf(timeKey);
  if (chosen === null) return null;
  for (const booked of taken) {
    const at = minutesOf(booked);
    if (at === null) continue;
    if (Math.abs(chosen - at) < SESSION_BLOCK_MINUTES) return booked;
  }
  return null;
}

/** "13:05" → "1:05 PM". */
export function formatClockLabel(key: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(key);
  if (!match) return key;
  const h24 = Number(match[1]);
  return `${h24 % 12 || 12}:${match[2]} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Note shown in the booking overlay when the picked time would double-book it. */
export function sessionConflictNote(booked: string): string {
  return `This time overlaps the session booked at ${formatClockLabel(booked)}. Pick another time or date.`;
}
