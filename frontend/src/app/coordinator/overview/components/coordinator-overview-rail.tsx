"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  PieChart,
  TabletSmartphone,
  type LucideIcon,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatElapsedShort, msSinceDate } from "@/lib/clock";
import {
  formatManilaDateLong,
  formatManilaTime,
} from "@/services/coordinator/labels";
import {
  BookedMeetingInfoContent,
  type BookedMeetingInfo,
} from "@/components/session-booking/BookedMeetingInfoPanel";
import type {
  AdmCaseRow,
  AdmDeviceRow,
} from "@/services/coordinator/coordinator.types";
import { AMBER_RAMP, type StageDonutEntry } from "./coordinator-overview-helpers";
import styles from "./coordinator-overview-rail.module.css";

// Flyout panel — same look as the nurse / registry KPI rails: solid surface,
// shadow + ring, smooth open/close anchored to the left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type RailKey = "stages" | "devices" | "booked";

interface RailItem {
  key: RailKey;
  icon: LucideIcon;
  title: string;
  count: number | null;
  hint: string;
  description: string;
}

interface CoordinatorOverviewRailProps {
  stageDonut: StageDonutEntry[];
  devicesIssued: number | null;
  devicesReturned: number | null;
  devicesPending: boolean;
  oldestOut: AdmDeviceRow[];
  bookedMeetings: AdmCaseRow[];
  bookedPending: boolean;
  now: number;
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

function rowMeetingInfo(r: AdmCaseRow): BookedMeetingInfo | null {
  const m = r.meeting;
  if (!m) return null;
  return {
    studentName: r.student,
    lrn: r.lrn,
    grade: r.grade,
    datetime: m.datetime,
    venue: m.venue,
    attended: m.attended,
    inviteeCount: m.inviteeIds?.length ?? 0,
  };
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

/**
 * Icon-only right rail for /coordinator/overview — one icon per data board
 * (pipeline stages, learning devices), the same tooltip + flyout interaction
 * as the nurse / registrar KPI rails. Clicking an icon opens a kanban board
 * flyout with the live data, amber-tinted to match the desk accent.
 */
export function CoordinatorOverviewRail({
  stageDonut,
  devicesIssued,
  devicesReturned,
  devicesPending,
  oldestOut,
  bookedMeetings,
  bookedPending,
  now,
}: CoordinatorOverviewRailProps) {
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const [infoRow, setInfoRow] = React.useState<AdmCaseRow | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  const meetingInfo = React.useMemo<BookedMeetingInfo | null>(
    () => (infoRow ? rowMeetingInfo(infoRow) : null),
    [infoRow],
  );

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

  const toggle = (key: RailKey) => {
    setInfoRow(null);
    setOpenKey((prev) => (prev === key ? null : key));
  };
  const close = () => {
    setOpenKey(null);
    setInfoRow(null);
  };
  const panel = (key: RailKey) =>
    `${MENU_PANEL} ${styles.railMenu} ${
      openKey === key ? styles.railMenuOpen : styles.railMenuClosed
    }`;

  const stageTotal = stageDonut.reduce((n, s) => n + s.value, 0);

  const items: RailItem[] = [
    {
      key: "stages",
      icon: PieChart,
      title: "Cases by stage",
      count: stageTotal,
      hint: "Live pipeline distribution",
      description: "Every case in the pipeline, split by the stage it sits in.",
    },
    {
      key: "devices",
      icon: TabletSmartphone,
      title: "Learning devices",
      count: devicesIssued,
      hint:
        devicesIssued === null
          ? "Tablet issuance ledger"
          : `${devicesIssued} still out · ${devicesReturned ?? 0} returned`,
      description: "Tablets still with a learner — longest-out first.",
    },
    {
      key: "booked",
      icon: CalendarClock,
      title: "Booked meetings",
      count: bookedMeetings.length,
      hint:
        bookedMeetings.length === 0
          ? "No parent meetings booked"
          : `${bookedMeetings.length} on the calendar`,
      description:
        "Parent meetings already on the calendar — schedule, venue and invitees.",
    },
  ];

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className="self-start lg:sticky lg:top-16"
        aria-label="Coordinator data boards"
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
                      count={stageTotal}
                      description={a.description}
                      className="border-0"
                      footer={
                        <div className="flex justify-end gap-1.5 px-1 pb-1">
                          <Button asChild size="sm" className="h-6 px-2 text-xs">
                            <Link href="/coordinator/referrals" onClick={close}>
                              Open referrals
                              <ArrowRight size={14} aria-hidden />
                            </Link>
                          </Button>
                        </div>
                      }
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
                  ) : a.key === "booked" ? (
                    <KanbanBoard
                      title={
                        infoRow && meetingInfo
                          ? infoRow.meeting?.attended
                            ? "Attended meeting"
                            : "Booked meeting"
                          : "Booked meetings"
                      }
                      icon={
                        <span className="text-amber-500" aria-hidden>
                          <CalendarClock size={14} />
                        </span>
                      }
                      count={
                        infoRow && meetingInfo ? undefined : bookedMeetings.length
                      }
                      description={
                        infoRow && meetingInfo
                          ? "Scheduled parent meeting details."
                          : a.description
                      }
                      className="border-0"
                      actions={
                        infoRow && meetingInfo ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => setInfoRow(null)}
                          >
                            Back to list
                          </Button>
                        ) : undefined
                      }
                      footer={
                        <div className="flex justify-end gap-1.5 px-1 pb-1">
                          <Button asChild size="sm" className="h-6 px-2 text-xs">
                            <Link href="/coordinator/referrals" onClick={close}>
                              Open referrals
                              <ArrowRight size={14} aria-hidden />
                            </Link>
                          </Button>
                        </div>
                      }
                    >
                      {infoRow && meetingInfo ? (
                        <BookedMeetingInfoContent info={meetingInfo} />
                      ) : bookedPending ? (
                        <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
                          Loading meetings…
                        </p>
                      ) : bookedMeetings.length === 0 ? (
                        <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
                          No parent meetings booked yet.
                        </p>
                      ) : (
                        <ul className={styles.railList}>
                          {bookedMeetings.map((r) => {
                            const m = r.meeting;
                            return (
                              <li key={r.id}>
                                <button
                                  type="button"
                                  className={styles.bookedRow}
                                  onClick={() => setInfoRow(r)}
                                >
                                  <span
                                    className={styles.railName}
                                    title={r.student}
                                  >
                                    {r.student}
                                  </span>
                                  <span className={styles.railWait}>
                                    {m
                                      ? `${formatManilaDateLong(m.datetime)} · ${formatManilaTime(m.datetime)}`
                                      : "—"}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </KanbanBoard>
                  ) : (
                    <KanbanBoard
                      title="Learning devices"
                      icon={
                        <span className="text-amber-500" aria-hidden>
                          <TabletSmartphone size={14} />
                        </span>
                      }
                      count={devicesIssued ?? undefined}
                      description={
                        devicesIssued !== null && devicesIssued > 0
                          ? `${devicesIssued} still out · ${devicesReturned ?? 0} returned.`
                          : undefined
                      }
                      className="border-0"
                      footer={
                        <div className="flex justify-end gap-1.5 px-1 pb-1">
                          <Button asChild size="sm" className="h-6 px-2 text-xs">
                            <Link href="/coordinator/devices" onClick={close}>
                              Open devices
                              <ArrowRight size={14} aria-hidden />
                            </Link>
                          </Button>
                        </div>
                      }
                    >
                      {devicesPending ? (
                        <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
                          Loading devices…
                        </p>
                      ) : oldestOut.length === 0 ? (
                        <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
                          No tablets currently issued.
                        </p>
                      ) : (
                        <ul className={styles.railList}>
                          {oldestOut.map((d) => {
                            const out = msSinceDate(d.issuedDate, now);
                            return (
                              <li key={d.id} className={styles.railItem}>
                                <span className={styles.railName} title={d.student}>
                                  {d.student}
                                </span>
                                <span className={styles.railWait}>
                                  {out === null
                                    ? "—"
                                    : `${formatElapsedShort(out)} ago`}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
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
