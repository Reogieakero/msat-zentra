"use client";

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fetchInterventionEngine } from "@/services/guidance/interventions.service";
import type { EngineBreakdown as EngineBreakdownData } from "@/services/guidance/interventions.types";

export function levelVariant(level: string): "red" | "amber" | "green" {
  if (level === "High") return "red";
  if (level === "Moderate") return "amber";
  return "green";
}

type Level = "high" | "medium" | "low";

function normalizeLevel(level: string): Level {
  const v = level.toLowerCase();
  if (v === "high") return "high";
  if (v === "moderate" || v === "medium") return "medium";
  return "low";
}

const LEVEL = {
  high: {
    label: "High",
    pill: "bg-red-500/15 text-red-700 dark:text-red-400",
    dot: "bg-red-600 dark:bg-red-400",
    value: "text-red-700 dark:text-red-400",
  },
  medium: {
    label: "Medium",
    pill: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500 dark:bg-amber-400",
    value: "text-amber-700 dark:text-amber-400",
  },
  low: {
    label: "Low",
    pill: "bg-green-500/15 text-green-700 dark:text-green-400",
    dot: "bg-green-600 dark:bg-green-400",
    value: "text-green-700 dark:text-green-400",
  },
} as const;

function LevelPill({ level }: { level: Level }) {
  const label = LEVEL[level].label;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("rounded-md px-2 py-0.5 text-xs font-medium", LEVEL[level].pill)}
            tabIndex={0}
            aria-label="Risk level"
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="font-medium">Risk level</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const eyebrow =
  "text-[11px] font-medium uppercase leading-[14px] tracking-[0.06em] text-slate-500 dark:text-slate-400";

export function useInterventionEngine(studentKey: string, enabled = true) {
  return useQuery({
    queryKey: ["guidance-interventions", "engine", studentKey],
    queryFn: ({ signal }) => fetchInterventionEngine(studentKey, { signal }),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

interface EngineBreakdownProps {
  studentKey: string;
  factors: { academic: boolean; attendance: boolean; behavioral: boolean };
  openReferrals: number;
  closedReferrals: number;
  highPriority: boolean;
}

function EngineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading risk breakdown" className="space-y-3">
      <div className="flex items-center rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-start gap-1.5">
            <Skeleton style={{ width: "3.5rem", height: "0.7rem" }} />
            <Skeleton style={{ width: "4.5rem", height: "1.25rem" }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3.5 dark:border-white/10">
            <Skeleton style={{ width: "60%", height: "0.875rem" }} />
            <Skeleton style={{ width: "100%", height: "0.75rem" }} />
            <Skeleton style={{ width: "80%", height: "0.75rem" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotFallback({
  factors,
  openReferrals,
  closedReferrals,
  highPriority,
}: Omit<EngineBreakdownProps, "studentKey">) {
  return (
    <div>
      <p className="text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
        Live breakdown unavailable — showing the flagged snapshot instead.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900 dark:text-slate-100">
        {factors.academic && <li>Low grades</li>}
        {factors.attendance && <li>Absences</li>}
        {factors.behavioral && <li>Behavior report</li>}
      </ul>
      <ReferralContextLine openReferrals={openReferrals} closedReferrals={closedReferrals} highPriority={highPriority} />
    </div>
  );
}

function ReferralContextLine({
  openReferrals,
  closedReferrals,
  highPriority,
}: {
  openReferrals: number;
  closedReferrals: number;
  highPriority: boolean;
}) {
  if (openReferrals <= 0 && closedReferrals <= 0 && !highPriority) return null;
  return (
    <div className="mt-1 space-y-1">
      {openReferrals > 0 || closedReferrals > 0 ? (
        <p className="flex items-center gap-2 text-[13px] leading-[18px] text-slate-600 dark:text-slate-400">
          <Users className="size-4 shrink-0" aria-hidden />
          <span>
            Also has adviser-referred cases:{" "}
            <b className="font-semibold text-slate-900 dark:text-slate-100">
              {[
                openReferrals > 0 ? `${openReferrals} open` : "",
                closedReferrals > 0 ? `${closedReferrals} resolved` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </b>
          </span>
        </p>
      ) : null}
      {highPriority ? (
        <p className="text-[13px] leading-[18px] text-slate-600 dark:text-slate-400">High priority</p>
      ) : null}
    </div>
  );
}

function EngineStrip({ data }: { data: EngineBreakdownData }) {
  const steps: { label: string; level: Level }[] = [
    { label: "Flagged", level: normalizeLevel(data.flagged?.level ?? "—") },
    { label: "Stored now", level: normalizeLevel(data.stored?.level ?? "—") },
    { label: "Live engine", level: normalizeLevel(data.live.level) },
  ];
  return (
    <div className="flex items-center rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10" aria-label="Risk level trail">
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && (
            <ChevronRight className="size-[18px] shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
          )}
          <div
            className={cn("flex min-w-0 flex-1 flex-col items-start gap-1.5", i > 0 && "pl-4")}>
            <span className={eyebrow}>{s.label}</span>
            <LevelPill level={s.level} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function DivergenceNote({ data }: { data: EngineBreakdownData }) {
  const storedLevel = data.stored?.level;
  if (!storedLevel || storedLevel === data.live.level) return null;
  if (data.live.level === "Low") {
    return (
      <p className="text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
        Risk cleared since detection (was {storedLevel}) — the case can be discontinued once the
        follow-up closes out.
      </p>
    );
  }
  return (
    <p className="text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
      Engine now says {data.live.level} (stored snapshot says {storedLevel}).
    </p>
  );
}

export function EngineBreakdown({
  studentKey,
  factors,
  openReferrals,
  closedReferrals,
  highPriority,
}: EngineBreakdownProps) {
  const breakdown = useInterventionEngine(studentKey);

  if (breakdown.isPending) return <EngineSkeleton />;
  const data = breakdown.data;
  if (breakdown.isError || !data) {
    return (
      <SnapshotFallback
        factors={factors}
        openReferrals={openReferrals}
        closedReferrals={closedReferrals}
        highPriority={highPriority}
      />
    );
  }

  const academicOn = data.live.academic;
  const attendanceOn = data.live.attendance;
  const behavioralOn = data.live.behavioral;

  const cards: {
    id: string;
    title: string;
    level: Level;
    on: boolean;
    value: string;
    valueLabel: string;
    /** Highlighted card message rendered in place of the detail lines. */
    message?: string;
    details: string[];
  }[] = [
    {
      id: "academic",
      title: "Academic",
      level: normalizeLevel(academicOn ? data.live.level : "Low"),
      on: academicOn,
      value:
        data.academic.transmutedAverage === null
          ? "—"
          : `${data.academic.transmutedAverage.toFixed(0)}`,
      valueLabel:
        data.academic.transmutedAverage === null
          ? "No transmuted academic average"
          : `Transmuted academic average ${data.academic.transmutedAverage.toFixed(0)}, threshold ${data.academic.threshold}`,
      message:
        data.academic.transmutedAverage === null
          ? "No transmuted grades yet — the flag follows transmuted grades."
          : `Transmuted avg ${data.academic.transmutedAverage.toFixed(0)} — ${data.academic.transmutedAverage < data.academic.threshold ? `below the ${data.academic.threshold} line` : `above the ${data.academic.threshold} line`}.`,
      details: [],
    },
    {
      id: "attendance",
      title: "Attendance",
      level: normalizeLevel(attendanceOn ? data.live.level : "Low"),
      on: attendanceOn,
      value:
        data.attendance.rate === null ? "—" : `${Math.round(data.attendance.rate * 100)}%`,
      valueLabel:
        data.attendance.rate === null
          ? "No attendance average"
          : `Attendance ${Math.round((data.attendance.rate ?? 0) * 100)} percent present`,
      details: [
        data.attendance.rate === null
          ? "No attendance records this term."
          : "Present.",
      ],
    },
    {
      id: "anecdotal",
      title: "Anecdotal",
      level: normalizeLevel(behavioralOn ? data.live.level : "Low"),
      on: behavioralOn,
      value: `${data.behavioral.count}`,
      valueLabel: `${data.behavioral.count} anecdotal reports`,
      details: [
        data.behavioral.count === 0
          ? "No anecdotal filings this term."
          : `Anecdotal report${data.behavioral.count === 1 ? "" : "s"} on record this term.`,
      ],
    },
  ];

  return (
    <div className="space-y-3">
      <EngineStrip data={data} />
      <DivergenceNote data={data} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-white/10">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 dark:text-slate-100">{c.title}</span>
              <span className="shrink-0">
                <LevelPill level={c.level} />
              </span>
            </div>
            <div
              className={cn(
                "break-words text-[28px] font-semibold leading-[34px]",
                c.value === "—" ? "text-slate-500 dark:text-slate-500" : LEVEL[c.level].value
              )}
              aria-label={c.valueLabel}
            >
              {c.value}
            </div>
            {c.message ? (
              <p className="text-[12px] italic leading-[18px] text-red-600 dark:text-red-400">
                {c.message}
              </p>
            ) : null}
            {c.details.map((d) => (
              <p key={d} className="text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
                {d}
              </p>
            ))}
          </div>
        ))}
      </div>
      <ReferralContextLine openReferrals={openReferrals} closedReferrals={closedReferrals} highPriority={highPriority} />
    </div>
  );
}
