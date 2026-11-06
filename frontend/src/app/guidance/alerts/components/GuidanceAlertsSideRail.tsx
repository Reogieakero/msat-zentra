"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ClipboardList,
  Filter,
  Flame,
  Radar,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import type { GuidanceAlertCasesSummary } from "@/services/guidance/alerts.types";
import type { RiskFilter } from "./guidance-alerts-table";
import styles from "./guidance-alerts-siderail.module.css";

/* Flyout surface — matches the guidance overview / nurse KPI rails. */
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

const PILL_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_MUTED = "bg-muted text-muted-foreground";

/* Amber ramp for the case-mix donut — same hue family as the warning tone
   used across the guidance desk. */
const AMBER = "oklch(0.769 0.188 70.08)";
const AMBER_RAMP = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 22%)`,
  `color-mix(in oklch, ${AMBER}, transparent 45%)`,
];

type RailKey = "detected" | "risk" | "mix";

function riskBadgeVariant(level: string): "red" | "amber" | "outline" {
  if (level === "High") return "red";
  if (level === "Moderate") return "amber";
  return "outline";
}

function detectionMs(detectedAt: string | null): number | null {
  if (!detectedAt) return null;
  const t = new Date(detectedAt).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}h ago`;
  return `${totalMinutes}m ago`;
}

function useNowTick(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function GutterIconButton({
  label,
  expanded,
  onToggle,
  children,
  ref,
  ...triggerProps
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
} & Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "aria-label">) {
  return (
    <button
      ref={ref}
      type="button"
      {...triggerProps}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label={expanded ? `Close ${label}` : `Open ${label}`}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
        expanded
          ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
          : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
      }`}
    >
      {children}
    </button>
  );
}

function RailCaseRow({
  name,
  seed,
  href,
  meta,
  badge,
  onNavigate,
}: {
  name: string;
  seed: string;
  href: string;
  meta: React.ReactNode;
  badge?: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link className={styles.rowLink} href={href} onClick={onNavigate}>
        <StudentMascot name={name} seed={seed} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
        </span>
        {badge}
      </Link>
    </li>
  );
}

function LatestDetectedPanel({
  summary,
  now,
  onNavigate,
}: {
  summary: GuidanceAlertCasesSummary;
  now: number;
  onNavigate: () => void;
}) {
  const rows = summary.latestDetected;

  if (rows.length === 0) {
    return (
      <p className="flex-1 px-1 text-xs text-muted-foreground">
        No students detected yet — the risk engine will show them here.
      </p>
    );
  }

  return (
    <ul className={styles.rowList}>
      {rows.map((s) => {
        const at = detectionMs(s.detectedAt);
        return (
          <RailCaseRow
            key={s.studentKey}
            name={s.student}
            seed={s.lrn ?? s.student}
            href={`/guidance/interventions?highlight=${encodeURIComponent(s.studentKey)}`}
            meta={at === null ? "Detection time unknown" : `Detected ${formatElapsed(now - at)}`}
            badge={
              <Badge variant={riskBadgeVariant(s.riskLevel)} className="rounded-md">
                {s.riskLevel}
              </Badge>
            }
            onNavigate={onNavigate}
          />
        );
      })}
    </ul>
  );
}

function RiskWatchPanel({
  summary,
  activeRisk,
  onFilterRisk,
  onNavigate,
}: {
  summary: GuidanceAlertCasesSummary;
  activeRisk: RiskFilter;
  onFilterRisk: (next: RiskFilter) => void;
  onNavigate: () => void;
}) {
  const names = summary.urgent;
  const urgent = summary.urgentCount;
  const filterActive = activeRisk === "High";

  return (
    <>
      {names.length === 0 ? (
        <p className="flex-1 px-1 text-xs text-muted-foreground">
          Nobody needs urgent attention right now.
        </p>
      ) : (
        <ul className={styles.rowList}>
          {names.map((s) => (
            <RailCaseRow
              key={`${s.kind}-${s.id}`}
              name={s.student}
              seed={s.lrn || s.student}
              href={
                s.track === "intervention"
                  ? `/guidance/interventions?highlight=${encodeURIComponent(s.id)}`
                  : `/guidance/referrals/${s.track}?highlight=${s.id}`
              }
              meta={`${s.lrn} | High risk`}
              badge={
                <Badge variant="red" className="rounded-md">
                  High
                </Badge>
              }
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
      {urgent > names.length ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          and {urgent - names.length} more on the desk.
        </p>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-2 px-1 pt-1">
        <span className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}>
          {urgent} high risk
        </span>
        <Button
          size="sm"
          variant={filterActive ? "default" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={() => {
            onFilterRisk(filterActive ? "" : "High");
            onNavigate();
          }}
        >
          {filterActive ? <ShieldCheck aria-hidden /> : <Filter aria-hidden />}
          {filterActive ? "High risk shown" : "Filter table: High risk"}
        </Button>
      </div>
    </>
  );
}

function CaseMixPanel({
  summary,
  onNavigate,
}: {
  summary: GuidanceAlertCasesSummary;
  onNavigate: () => void;
}) {
  const items = [
    { label: "Counseling", count: summary.counseling, href: "/guidance/referrals/counseling" },
    { label: "ADM", count: summary.adm, href: "/guidance/referrals/adm" },
    { label: "Intervention", count: summary.intervention, href: "/guidance/interventions" },
  ].map((item, i) => ({
    ...item,
    fill: AMBER_RAMP[i % AMBER_RAMP.length],
    percent: summary.total > 0 ? Math.round((item.count / summary.total) * 100) : 0,
  }));

  if (summary.total === 0) {
    return (
      <p className="flex-1 px-1 text-xs text-muted-foreground">
        New cases will break down here by track.
      </p>
    );
  }

  return (
    <div
      className={styles.donutRow}
      role="img"
      aria-label={`Case mix: ${items
        .map((i) => `${i.label} ${i.count}`)
        .join(", ")}`}
    >
      <div className={styles.donutWrap}>
        <ResponsiveContainer width="100%" height={132}>
          <RechartsPieChart>
            <RechartsTooltip
              cursor={false}
              wrapperStyle={{ zIndex: 60 }}
              animationDuration={150}
              animationEasing="ease-out"
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                fontSize: "0.75rem",
              }}
              formatter={(value, _name, item) => {
                const payload = item?.payload as
                  | { label: string; percent: number }
                  | undefined;
                return [
                  `${value} case(s) · ${payload?.percent ?? 0}%`,
                  payload?.label ?? "",
                ];
              }}
              labelFormatter={() => ""}
            />
            <Pie
              data={items}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="transparent"
              isAnimationActive
              animationDuration={700}
            >
              {items.map((d) => (
                <Cell key={d.label} fill={d.fill} />
              ))}
            </Pie>
          </RechartsPieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter} aria-hidden="true">
          <span className={styles.donutTotal}>{summary.total}</span>
          <span className={styles.donutLabel}>cases</span>
        </div>
      </div>
      <ul className={styles.donutLegend}>
        {items.map((item) => (
          <li key={item.label}>
            <Link className={styles.donutLegendItem} href={item.href} onClick={onNavigate}>
              <span
                className={styles.donutSwatch}
                style={{ background: item.fill }}
                aria-hidden="true"
              />
              <span className={styles.donutLegendName}>{item.label}</span>
              <span className={styles.donutLegendValue}>
                {item.count} · {item.percent}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GuidanceAlertsSideRail({
  summary,
  activeRisk = "",
  onRiskFilterChange,
}: {
  summary: GuidanceAlertCasesSummary;
  activeRisk?: RiskFilter;
  onRiskFilterChange?: (next: RiskFilter) => void;
}) {
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const now = useNowTick();

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-slot="popover-content"], [data-slot="tooltip-content"]')) {
        return;
      }
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  const items: {
    key: RailKey;
    icon: LucideIcon;
    title: string;
    count: number;
    accent: string;
    description: string;
  }[] = [
    {
      key: "detected",
      icon: Radar,
      title: "Latest detected",
      count: summary.detected,
      accent: "text-primary",
      description: "Newest engine-flagged students for intervention.",
    },
    {
      key: "risk",
      icon: Flame,
      title: "Risk watch",
      count: summary.urgentCount,
      accent: "text-red-500",
      description: "High-risk students on the desk, in plain words.",
    },
    {
      key: "mix",
      icon: ClipboardList,
      title: "Case mix",
      count: summary.total,
      accent: "text-amber-500",
      description: "How the desk splits across the three tracks.",
    },
  ];

  const toggle = (key: RailKey) => setOpenKey((prev) => (prev === key ? null : key));
  const close = () => setOpenKey(null);

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="self-start lg:sticky lg:top-16" aria-label="Guidance alert actions">
        <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
          {items.map((a) => {
            const Icon = a.icon;
            const opened = openKey === a.key;
            return (
              <div key={a.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={a.title}
                      expanded={opened}
                      onToggle={() => toggle(a.key)}
                    >
                      <span className={a.accent} aria-hidden>
                        <Icon size={16} />
                      </span>
                      {a.count > 0 ? (
                        <span
                          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                          aria-hidden="true"
                        >
                          {a.count}
                        </span>
                      ) : null}
                    </GutterIconButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <span className="font-medium">{a.title}</span>
                    <span className="opacity-60">
                      {a.count > 0 ? `${a.count} on the desk` : "All clear"}
                    </span>
                  </TooltipContent>
                </Tooltip>
                <div
                  role="dialog"
                  aria-label={a.title}
                  aria-hidden={opened ? undefined : true}
                  className={`${MENU_PANEL} ${styles.railMenu} ${
                    opened ? styles.railMenuOpen : styles.railMenuClosed
                  }`}
                >
                  <KanbanBoard
                    title={a.title}
                    icon={
                      <span className={a.accent} aria-hidden>
                        <Icon size={14} />
                      </span>
                    }
                    count={a.count}
                    description={a.description}
                    className="border-0"
                  >
                    {a.key === "detected" ? (
                      <LatestDetectedPanel summary={summary} now={now} onNavigate={close} />
                    ) : a.key === "risk" ? (
                      <RiskWatchPanel
                        summary={summary}
                        activeRisk={activeRisk}
                        onFilterRisk={(next) => onRiskFilterChange?.(next)}
                        onNavigate={close}
                      />
                    ) : (
                      <CaseMixPanel summary={summary} onNavigate={close} />
                    )}
                  </KanbanBoard>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
