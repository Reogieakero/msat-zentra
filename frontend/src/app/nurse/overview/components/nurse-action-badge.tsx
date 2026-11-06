"use client";
import { Pill, type PillTone } from "@/components/ui/pill";
import { deriveActionStatus } from "@/services/nurse/labels";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";

/* Action → shared Pill tone. One palette with every desk's status pills. */
const ACTION_TONE: Record<string, PillTone> = {
  endorsed: "green",
  done: "green",
  done_session: "green",
  rejected: "red",
  escalated: "red",
  needs_review: "amber",
  booked: "blue",
  followup: "blue",
};

export function NurseActionBadge({
  row,
  className,
}: {
  row: NurseQueueRow;
  className?: string;
}) {
  const action = deriveActionStatus(row.type, row.status, row.sessions);
  return (
    <Pill
      tone={ACTION_TONE[action.key] ?? "neutral"}
      label="Case status"
      className={className}
    >
      {action.label}
    </Pill>
  );
}
export function waitingElapsed(referredAt: string, nowMs: number): string {
  if (!referredAt) return "—";
  const t = new Date(referredAt).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.floor(Math.max(0, nowMs - t) / 60_000);
  if (mins < 1) return "Just now";
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (mins % 60 > 0) parts.push(`${mins % 60}m`);
  return parts.join(" ");
}
