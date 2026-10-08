"use client";
import { Badge } from "@/components/ui/badge";
import { deriveActionStatus } from "@/services/nurse/labels";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
export function NurseActionBadge({ row }: { row: NurseQueueRow }) {
  const action = deriveActionStatus(row.type, row.status, row.sessions);
  switch (action.key) {
    case "endorsed":
    case "done":
    case "done_session":
      return <Badge variant="green">{action.label}</Badge>;
    case "rejected":
      return <Badge variant="red">{action.label}</Badge>;
    case "needs_review":
      return <Badge variant="amber">{action.label}</Badge>;
    case "escalated":
      return <Badge variant="red">{action.label}</Badge>;
    case "booked":
    case "followup":
      return <Badge variant="blue">{action.label}</Badge>;
    default:
      return <Badge variant="outline">{action.label}</Badge>;
  }
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
