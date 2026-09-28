"use client";

import * as React from "react";
import { Info } from "lucide-react";
import type { MyAnecdotalRecord } from "@/components/ocform01/folders";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

// Folder body color per anecdotal category (mirrors the folder grid).
export const CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};

const CATEGORY_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  bullying: "Bullying",
  academic: "Academic",
  attendance: "Attendance",
  health: "Health",
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* Top students by filed-report count — the advisees needing attention. */
export function TopAttentionCard({ records }: { records: MyAnecdotalRecord[] }) {
  const top = React.useMemo(() => {
    const counts = new Map<string, { name: string; lrn: string; count: number }>();
    for (const r of records) {
      const entry = counts.get(r.lrn) ?? { name: r.studentName, lrn: r.lrn, count: 0 };
      entry.count += 1;
      counts.set(r.lrn, entry);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [records]);

  return (
    <div className={assign.card} aria-label="Top students for attention">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h3 className="font-semibold">Top 5 for attention</h3>
        <p className="text-xs text-muted-foreground">Most anecdotal reports filed.</p>
      </div>
      {top.length === 0 ? (
        <p className="relative text-sm text-muted-foreground">No filings yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-2">
          {top.map((s, i) => (
            <li key={s.lrn} className="flex items-center gap-2 text-sm">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.lrn}</span>
              </span>
              <span
                className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums"
                aria-label={`${s.count} reports`}
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

/* Legend for the folder UI color coding (same card design as the
   schedule slot legend). */
export function FolderLegendCard() {
  return (
    <div className={assign.card} aria-label="Folder color legend">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Info size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Legend</h3>
          <p className="text-xs text-muted-foreground">
            What each folder color means.
          </p>
        </div>
      </div>
      <div className="relative flex flex-col gap-1.5 text-sm">
        {Object.keys(CATEGORY_LABELS).map((key) => (
          <span key={key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[key] }}
              aria-hidden="true"
            />
            {CATEGORY_LABELS[key] ?? humanize(key)}
          </span>
        ))}
      </div>
    </div>
  );
}
