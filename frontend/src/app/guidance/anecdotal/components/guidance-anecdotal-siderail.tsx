"use client";

import * as React from "react";
import { Files } from "lucide-react";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { GuidanceAnecdotalTopStudent } from "@/services/guidance/anecdotal.types";

/* Top students by referred-case count — same card design as the teacher
   repo rail (assign.card + glow), guidance-worded copy. Fed by the
   endpoint's summary.topStudents (full referred scope, not the page). */
export function TopReferredCard({ items }: { items: GuidanceAnecdotalTopStudent[] }) {
  const top = React.useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, 5),
    [items]
  );

  return (
    <div className={assign.card} aria-label="Top referred students">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h3 className="font-semibold">Top 5 referred</h3>
        <p className="text-xs text-muted-foreground">Most cases referred to you.</p>
      </div>
      {top.length === 0 ? (
        <p className="relative text-sm text-muted-foreground">No referrals yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-2">
          {top.map((s, i) => (
            <li key={s.lrn || s.student} className="flex items-center gap-2 text-sm">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.student}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.lrn}</span>
              </span>
              <span
                className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums"
                aria-label={`${s.count} referred cases`}
              >
                {s.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* Session-file color key for the documentation slips (same colors as the
   folder slips: one per counseling session kind, from done sessions). */
const SESSION_KINDS: { key: string; label: string; color: string }[] = [
  { key: "individual", label: "One-on-one", color: "#3b82f6" },
  { key: "parent_conference", label: "Parent conference", color: "#f59e0b" },
  { key: "group", label: "Group", color: "#22c55e" },
  { key: "home_visit", label: "Home visit", color: "#8b5cf6" },
];

export function SessionFilesLegendCard() {
  return (
    <div className={assign.card} aria-label="Session file color legend">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Files size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Session files</h3>
          <p className="text-xs text-muted-foreground">
            Filed images from done sessions, by kind.
          </p>
        </div>
      </div>
      <div className="relative flex flex-col gap-1.5 text-sm">
        {SESSION_KINDS.map((k) => (
          <span key={k.key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: k.color }}
              aria-hidden="true"
            />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}
