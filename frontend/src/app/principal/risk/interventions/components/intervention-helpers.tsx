"use client";
import { Pill, type PillTone } from "@/components/ui/pill";
import type { RiskSnapshotStudent } from "../types";
export const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};
export const FACTOR_BADGE: Record<string, { tone: PillTone; label: string }> = {
  academic: { tone: "amber", label: "Academic" },
  attendance: { tone: "green", label: "Attendance" },
  behavioral: { tone: "blue", label: "Behavioral" },
};
export function FactorBadges({ student }: { student: RiskSnapshotStudent }) {
  const active = (Object.keys(FACTOR_BADGE) as (keyof typeof FACTOR_BADGE)[]).filter(
    (f) => student.factors[f as keyof RiskSnapshotStudent["factors"]]
  );
  if (active.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {active.map((f) => (
        <Pill key={f} tone={FACTOR_BADGE[f].tone} label="Risk factor">
          {FACTOR_BADGE[f].label}
        </Pill>
      ))}
    </span>
  );
}
export function planStatus(s: RiskSnapshotStudent): string {
  // Ongoing only once guidance books a session; a bare intervention record is
  // still "no plan yet".
  return (s.intervention?.sessions.length ?? 0) > 0 ? "ongoing" : "none";
}
export function canAlert(s: RiskSnapshotStudent): boolean {
  return !s.intervention || s.intervention.outcomeStatus === "unresolved";
}
