"use client";

import * as React from "react";
import { PieChart, Workflow, type LucideIcon } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AMBER_RAMP,
  type StageDonutEntry,
} from "../../overview/components/coordinator-overview-helpers";
import styles from "./coordinator-referrals-rail.module.css";

// Flyout panel — same look as the nurse / coordinator-overview rails: solid
// surface, shadow + ring, smooth open/close anchored to the left of the icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

const SNAPSHOT_STAGES = [
  { key: "consultation", name: "Consult.", full: "Consultation" },
  { key: "meeting_parents", name: "Parents", full: "Parent meeting" },
  { key: "home_visitation", name: "Home visit", full: "Home visitation" },
  { key: "certification", name: "Certific.", full: "Certification" },
  { key: "principal_approval", name: "Principal", full: "Principal approval" },
];

const WORKFLOW_STEPS = [
  { title: "Forward received", hint: "Nurse / Guidance endorses the case" },
  { title: "Create learner profile", hint: "Accept the referral into a profile" },
  { title: "Book parent meeting", hint: "Schedule with parents / guardians" },
  { title: "Record outcome", hint: "Log attendance, minutes & logbook" },
  { title: "Certify & forward", hint: "Recommend, then endorse to Principal" },
];

type RailKey = "stages" | "workflow";

interface CoordinatorReferralsRailProps {
  stageCounts: Record<string, number>;
  totalReferred: number;
  isLoading: boolean;
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

function GutterTip({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <span className="font-medium">{title}</span>
      <span className="opacity-60">{hint}</span>
    </>
  );
}

/**
 * Pipeline distribution as an amber donut — stages with a non-zero count,
 * each slice a step of the amber ramp, the total in the ring and a compact
 * legend beside it. Used inside the "Cases by stage" rail flyout.
 */
function StageDonutChart({ rows }: { rows: StageDonutEntry[] }) {
  const data = rows.filter((r) => r.value > 0);
  if (data.length === 0) {
    return (
      <p className="flex-1 px-1 py-2 text-xs text-muted-foreground">
        No cases in the pipeline yet.
      </p>
    );
  }
  const total = data.reduce((n, r) => n + r.value, 0);
  const label = data.map((d) => `${d.full} ${d.value}`).join(", ");
  return (
    <div
      className={styles.donutRow}
      role="img"
      aria-label={`Cases by stage: ${label}`}
    >
      <div className={styles.donutWrap}>
        <ResponsiveContainer width="100%" height={116}>
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
              formatter={(value, _name, item) => [
                `${value} case(s)`,
                (item?.payload as StageDonutEntry | undefined)?.full ?? "",
              ]}
              labelFormatter={() => ""}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="transparent"
              isAnimationActive
              animationDuration={700}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={AMBER_RAMP[i % AMBER_RAMP.length]} />
              ))}
            </Pie>
          </RechartsPieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter} aria-hidden="true">
          <span className={styles.donutTotal}>{total}</span>
          <span className={styles.donutLabel}>cases</span>
        </div>
      </div>
      <ul className={styles.donutLegend}>
        {data.map((d, i) => (
          <li key={d.name} className={styles.donutLegendItem}>
            <span
              className={styles.donutSwatch}
              style={{ background: AMBER_RAMP[i % AMBER_RAMP.length] }}
              aria-hidden="true"
            />
            <span className={styles.donutLegendName} title={d.full}>
              {d.full}
            </span>
            <span className={styles.donutLegendValue}>{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface RailItem {
  key: RailKey;
  icon: LucideIcon;
  title: string;
  count: number | null;
  hint: string;
  description: string;
}

/**
 * Icon-only right rail for /coordinator/referrals — the live pipeline
 * distribution and the intake flow, with the same tooltip + flyout interaction
 * as the nurse / coordinator-overview rails. Clicking an icon opens a kanban
 * board flyout; the stage board renders an amber donut.
 */
export function CoordinatorReferralsRail({
  stageCounts,
  totalReferred,
  isLoading,
}: CoordinatorReferralsRailProps) {
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (
        target?.closest?.(
          '[data-slot="popover-content"], [data-slot="tooltip-content"]',
        )
      ) {
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

  const toggle = (key: RailKey) =>
    setOpenKey((prev) => (prev === key ? null : key));
  const panel = (key: RailKey) =>
    `${MENU_PANEL} ${styles.railMenu} ${
      openKey === key ? styles.railMenuOpen : styles.railMenuClosed
    }`;

  const stageDonut: StageDonutEntry[] = SNAPSHOT_STAGES.map((s, i) => ({
    name: s.name,
    full: s.full,
    value: isLoading ? 0 : (stageCounts[s.key] ?? 0),
    fill: AMBER_RAMP[i % AMBER_RAMP.length],
  }));
  const stageTotal = isLoading ? totalReferred : stageDonut.reduce((n, s) => n + s.value, 0);

  const items: RailItem[] = [
    {
      key: "stages",
      icon: PieChart,
      title: "Cases by stage",
      count: isLoading ? null : stageTotal,
      hint: "Live pipeline distribution",
      description: "Every referred case, split by the stage it sits in.",
    },
    {
      key: "workflow",
      icon: Workflow,
      title: "Intake workflow",
      count: WORKFLOW_STEPS.length,
      hint: "How a forward becomes a case",
      description: "How a forward becomes a certified case.",
    },
  ];

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className="self-start lg:sticky lg:top-16"
        aria-label="Referral data boards"
      >
        <div
          ref={railRef}
          className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
        >
          {items.map((a) => {
            const Icon = a.icon;
            const opened = openKey === a.key;
            const showBadge = typeof a.count === "number" && a.count > 0;
            const tip =
              typeof a.count === "number"
                ? a.count > 0
                  ? `${a.count} total`
                  : "Nothing yet"
                : "Loading…";
            return (
              <div key={a.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={a.title}
                      expanded={opened}
                      onToggle={() => toggle(a.key)}
                    >
                      <span className="text-amber-500" aria-hidden>
                        <Icon size={16} />
                      </span>
                      {showBadge ? (
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
                    <GutterTip title={a.title} hint={tip} />
                  </TooltipContent>
                </Tooltip>

                <div
                  role="dialog"
                  aria-label={a.title}
                  aria-hidden={opened ? undefined : true}
                  className={panel(a.key)}
                >
                  {a.key === "stages" ? (
                    <KanbanBoard
                      title="Cases by stage"
                      icon={
                        <span className="text-amber-500" aria-hidden>
                          <PieChart size={14} />
                        </span>
                      }
                      count={a.count ?? undefined}
                      description={a.description}
                      className="border-0"
                    >
                      {stageDonut.length === 0 ? (
                        <p className="flex-1 px-1 text-xs text-muted-foreground">
                          No cases in the pipeline yet — new referrals appear
                          here by stage.
                        </p>
                      ) : (
                        <StageDonutChart rows={stageDonut} />
                      )}
                    </KanbanBoard>
                  ) : (
                    <KanbanBoard
                      title="Intake workflow"
                      icon={
                        <span className="text-amber-500" aria-hidden>
                          <Workflow size={14} />
                        </span>
                      }
                      count={WORKFLOW_STEPS.length}
                      description={a.description}
                      className="border-0"
                    >
                      <ol className={styles.steps}>
                        {WORKFLOW_STEPS.map((s, i) => (
                          <li key={s.title} className={styles.step}>
                            <span className={styles.stepNum} aria-hidden="true">
                              {i + 1}
                            </span>
                            <span className={styles.stepBody}>
                              <span className={styles.stepTitle}>{s.title}</span>
                              <span className={styles.stepHint}>{s.hint}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </KanbanBoard>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
