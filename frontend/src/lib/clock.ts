"use client";

import * as React from "react";

// Single home for the live-clock + elapsed-time vocabulary shared by every
// queue surface (coordinator / nurse / guidance / principal). Merged from
// the identical copies that lived in the coordinator grab-bag, the nurse
// referrals table, and the guidance intervention row.
//
// File-local `useNowTick(active)` variants still exist in a few tables —
// those pause ticking when their dialog closes and are intentionally left
// alone. Only the shared always-on 30s clock lives here.
/* Live clock — ticks every 30s; elapsed readouts render days / hours /
   minutes only, so per-second ticks would just burn renders. */
export function useNowTick(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/* "4d 3h 12m" / "3h 12m" / "12m" / "just now" — days, hours, minutes only,
   never seconds. */
export function formatElapsedShort(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

/* ms from a YYYY-MM-DD (or ISO) date to now. Null when unparseable — the
   cell then shows "—". */
export function msSinceDate(date: string | null, now: number): number | null {
  if (!date) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}
