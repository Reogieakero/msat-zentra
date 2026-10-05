"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Activity,
  TriangleAlert,
  TrendingUp,
  Users,
  Clock,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import { SectionScheduleCard } from "@/components/schedule/SectionScheduleCard";
import { DOT } from "@/app/principal/academics/assign/components/status-dots";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./AttendanceHeader.module.css";

/** Right-sidebar cards. Daily / Subjects / Averages / Trend / Attention switch
 *  the main panel content (and the URL tab); Drill opens the section picker
 *  modal. Same `SectionScheduleCard` shell as the schedule section grid:
 *  floating pill, avatar, status dot + label, explainer, hint. */
export type HeatmapNavTarget =
  | "daily"
  | "subject"
  | "averages"
  | "trend"
  | "attention";

interface SectionStat {
  sectionId: string;
  rate: number;
}

interface TrendPoint {
  date: string;
  rate: number;
}

function trendDirection(points: TrendPoint[]): "up" | "down" | "flat" {
  if (points.length < 4) return "flat";
  const rates = points.map((p) => p.rate);
  const half = Math.floor(rates.length / 2);
  const first = rates.slice(0, half).reduce((a, r) => a + r, 0) / half;
  const second =
    rates.slice(half).reduce((a, r) => a + r, 0) / (rates.length - half);
  const diff = second - first;
  if (diff > 2) return "up";
  if (diff < -2) return "down";
  return "flat";
}

export function AttendanceHeader({
  active,
  onNavigate,
  onDrillSection,
}: {
  active: HeatmapNavTarget;
  onNavigate: (target: HeatmapNavTarget) => void;
  onDrillSection: () => void;
}) {
  // Shared cache with the views (same queryKeys as SectionAverages and
  // NeedsAttention) — no extra network once those tabs have loaded.
  const statsQuery = useQuery({
    queryKey: ["attendance-section-averages"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SectionStat[];
        trend: TrendPoint[];
      }>("/api/attendance/section-stats");
      return res.data;
    },
    staleTime: 30_000,
  });
  const attentionQuery = useQuery({
    queryKey: ["attendance-needs-attention"],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: unknown[];
      }>("/api/attendance/at-risk-students");
      return res.data;
    },
    staleTime: 30_000,
  });

  const loading = statsQuery.isPending || attentionQuery.isPending;
  const sections = React.useMemo(
    () => statsQuery.data?.sections ?? [],
    [statsQuery.data]
  );
  const below = sections.filter((s) => s.rate < 80).length;
  const direction = React.useMemo(
    () => trendDirection(statsQuery.data?.trend ?? []),
    [statsQuery.data]
  );
  const atRisk = attentionQuery.data?.students.length ?? 0;

  const railScrollRef = React.useRef<HTMLElement | null>(null);

  const belowMeta = below > 0
    ? { color: DOT.red, label: `${below} below 80%` }
    : { color: DOT.green, label: "On track" };
  const trendMeta =
    direction === "up"
      ? { color: DOT.green, label: "Improving" }
      : direction === "down"
        ? { color: DOT.red, label: "Slipping" }
        : { color: DOT.blue, label: "Steady" };
  const attentionMeta =
    atRisk > 0
      ? { color: DOT.red, label: `${atRisk} student${atRisk === 1 ? "" : "s"}` }
      : { color: DOT.green, label: "Clear" };
  const idleMeta = { color: DOT.gray, label: "View" };
  const loadingMeta = { color: DOT.gray, label: "Loading" };

  type Card = {
    key: string;
    target?: HeatmapNavTarget;
    icon: React.ReactNode;
    title: string;
    body: string;
    pill: string;
    meta: { color: string; label: string };
    hint: string;
    onSelect: () => void;
  };
  const cards: Card[] = [
    {
      key: "daily",
      target: "daily",
      icon: <CalendarDays size={20} aria-hidden />,
      title: "Daily Heatblocks",
      body: "Per-section daily blocks — present means present in every subject offered that day.",
      pill: loading ? "…" : below > 0 ? `${below} below 80%` : `${sections.length} sections`,
      meta: loading ? loadingMeta : belowMeta,
      hint: "Tap to view daily blocks",
      onSelect: () => onNavigate("daily"),
    },
    {
      key: "subject",
      target: "subject",
      icon: <Clock size={20} aria-hidden />,
      title: "Subjects & Sessions",
      body: "Per-section, per-day rows for each subject, color-coded per take.",
      pill: loading ? "…" : `${sections.length} sections`,
      meta: loading ? loadingMeta : idleMeta,
      hint: "Tap to view subjects",
      onSelect: () => onNavigate("subject"),
    },
    {
      key: "averages",
      target: "averages",
      icon: <Activity size={20} aria-hidden />,
      title: "Section Averages",
      body: "Average present-per-day and how many days each section dipped below 80%.",
      pill: loading ? "…" : below > 0 ? `${below} below 80%` : `${sections.length} sections`,
      meta: loading ? loadingMeta : belowMeta,
      hint: "Tap to view averages",
      onSelect: () => onNavigate("averages"),
    },
    {
      key: "trend",
      target: "trend",
      icon: <TrendingUp size={20} aria-hidden />,
      title: "School-wide Trend",
      body: "Track the daily present-student count across the school.",
      pill: loading
        ? "…"
        : direction === "up"
          ? "Improving"
          : direction === "down"
            ? "Slipping"
            : "Steady",
      meta: loading ? loadingMeta : trendMeta,
      hint: "Tap to view trend",
      onSelect: () => onNavigate("trend"),
    },
    {
      key: "attention",
      target: "attention",
      icon: <TriangleAlert size={20} aria-hidden />,
      title: "Needs Attention",
      body: "Students running below 80% daily attendance.",
      pill: loading ? "…" : atRisk > 0 ? `${atRisk} students` : "Clear",
      meta: loading ? loadingMeta : attentionMeta,
      hint: "Tap to view students",
      onSelect: () => onNavigate("attention"),
    },
    {
      key: "drill",
      icon: <Users size={20} aria-hidden />,
      title: "Drill into a Section",
      body: "Pick any section to see its full per-student attendance table.",
      pill: loading ? "…" : `${sections.length} sections`,
      meta: loading ? loadingMeta : idleMeta,
      hint: "Pick a section to inspect",
      onSelect: onDrillSection,
    },
  ];

  return (
    <aside ref={railScrollRef} className={styles.sidebar} aria-label="Attendance views">
      {cards.map((card) => (
        <SectionScheduleCard
          key={card.key}
          onSelect={card.onSelect}
          selected={card.target ? active === card.target : false}
          ariaLabel={
            card.target
              ? `Show ${card.title} — ${card.meta.label}`
              : `${card.title} — ${card.hint}`
          }
          pill={
            <Badge variant="secondary" className={assign.gradeFloat}>
              {card.pill}
            </Badge>
          }
          avatarIcon={card.icon}
          titleLabel="View"
          sectionName={card.title}
          adviserName={null}
          statusMeta={card.meta}
          middle={<span className={assign.itemTerm}>{card.body}</span>}
          hint={card.hint}
        />
      ))}
      <div className={styles.hintWrap}>
        <ScrollDownHint
          scrollRef={railScrollRef}
          watchKey={`${active}|${loading}`}
          label="Scroll for more"
          className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
        />
      </div>
    </aside>
  );
}
