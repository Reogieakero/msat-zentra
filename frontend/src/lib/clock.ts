"use client";

import * as React from "react";

// Single home for the live-clock + elapsed-time vocabulary shared by every
// queue surface (coordinator / nurse / guidance / principal). Merged from
// the identical copies that lived in the coordinator grab-bag, the nurse
// referrals table, the guidance intervention row, and the gated-clock
// copies in the guidance/nurse tables and session dialogs.
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

/* Gated live clock — ticks every second while `active` (open dialogs,
   visible countdowns) so "starts at" guards stay exact, and stops
   otherwise. Paused callers keep their last value. */
export function useActiveNowTick(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
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
   cell then shows "—". Also rejects the "—" placeholder itself, so
   latest-action readouts (which render "—" for unknown) share this. */
export function msSinceDate(
  date: string | null,
  now: number,
): number | null {
  if (!date || date === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}
