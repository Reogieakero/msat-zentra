"use client";
import {
  Bell,
  CalendarPlus,
  Check,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Flag,
  Hourglass,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RiskSnapshotStudent } from "../types";
export const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};
export const FACTOR_BADGE: Record<string, { variant: "amber" | "green" | "blue"; label: string }> = {
  academic: { variant: "amber", label: "Academic" },
  attendance: { variant: "green", label: "Attendance" },
  behavioral: { variant: "blue", label: "Behavioral" },
};
export function FactorBadges({ student }: { student: RiskSnapshotStudent }) {
  const active = (Object.keys(FACTOR_BADGE) as (keyof typeof FACTOR_BADGE)[]).filter(
    (f) => student.factors[f as keyof RiskSnapshotStudent["factors"]]
  );
  if (active.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {active.map((f) => (
        <Badge key={f} variant={FACTOR_BADGE[f].variant}>
          {FACTOR_BADGE[f].label}
        </Badge>
      ))}
    </span>
  );
}
export function latestAction(s: RiskSnapshotStudent): { label: string; time: string } {
  const iv = s.intervention;
  const sessions = iv?.sessions ?? [];
  if (sessions.length > 0) {
    const actionTimeOf = (a: { completedAt: string | null; createdAt: string; scheduledAt: string }) =>
      a.completedAt || a.createdAt || a.scheduledAt;
    const sorted = [...sessions].sort((a, b) => {
      const at = new Date(actionTimeOf(a)).getTime();
      const bt = new Date(actionTimeOf(b)).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const newest = sorted[0];
    if (newest.status === "completed") {
      return {
        label: "Session done",
        time: newest.completedAt || newest.createdAt || newest.scheduledAt,
      };
    }
    if (newest.status === "cancelled") {
      return {
        label: "Session cancelled",
        time: newest.createdAt || newest.scheduledAt,
      };
    }
    return {
      label: "Session booked",
      time: newest.createdAt || newest.scheduledAt,
    };
  }
  if (!iv) return { label: "No follow-up yet", time: "" };
  const date = (iv.createdAt ?? "").slice(0, 10);
  if (iv.outcomeStatus === "resolved") return { label: "Marked resolved", time: date };
  if (iv.outcomeStatus === "unresolved") return { label: "Marked unresolved", time: date };
  return { label: "Intervention opened", time: date };
}
export function planStatus(s: RiskSnapshotStudent): string {
  return s.intervention ? s.intervention.outcomeStatus : "none";
}
export function ActionGlyph({ label, className }: { label: string; className?: string }) {
  const text = label.toLowerCase();
  const props = { className, "aria-hidden": true } as const;
  if (text.includes("booked")) return <CalendarPlus {...props} />;
  if (text.includes("unresolv") || text.includes("not resolv")) return <CircleX {...props} />;
  if (text.includes("done") || text.includes("resolv")) return <CircleCheck {...props} />;
  if (text.includes("cancel") || text.includes("reject")) return <CircleX {...props} />;
  if (text.includes("documentation") || text.includes("filed") || text.includes("note"))
    return <FileText {...props} />;
  if (text.includes("follow")) return <Flag {...props} />;
  if (text.includes("accept") || text.includes("approv")) return <Check {...props} />;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("assign") ||
    text.includes("intervention")
  )
    return <Send {...props} />;
  if (text.includes("review") || text.includes("needs")) return <Eye {...props} />;
  if (text.includes("waiting") || text.includes("information")) return <Hourglass {...props} />;
  return <Bell {...props} />;
}
export function canAlert(s: RiskSnapshotStudent): boolean {
  return !s.intervention || s.intervention.outcomeStatus === "unresolved";
}
