"use client";

import * as React from "react";
import { Files, Info, Users } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CATEGORY_COLORS } from "@/app/teacher/anecdotal/components/AnecdotalSideRail";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { GuidanceAnecdotalTopStudent } from "@/services/guidance/anecdotal.types";

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

/* Icon-only right rail, same gutter pattern as the teacher anecdotal page.
   Guidance has no creation flow, so the rail replaces "Chat with Bama" with
   the referral desk's own top-referred summary. */
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

const CATEGORY_LEGEND = [
  { label: "Behavioral", hint: "Conduct and classroom behavior", color: CATEGORY_COLORS.behavioral },
  { label: "Bullying", hint: "Peer conflict and bullying", color: CATEGORY_COLORS.bullying },
  { label: "Academic", hint: "Learning and performance", color: CATEGORY_COLORS.academic },
  { label: "Attendance", hint: "Absences and tardiness", color: CATEGORY_COLORS.attendance },
  { label: "Health", hint: "Wellness and clinic notes", color: CATEGORY_COLORS.health },
];

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

type RailKey = "referred" | "legend";

export function GuidanceAnecdotalSidebar({
  items,
}: {
  items: GuidanceAnecdotalTopStudent[];
}) {
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const top = React.useMemo(
    () => [...items].sort((a, b) => b.count - a.count).slice(0, 5),
    [items],
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

  const toggle = (key: RailKey) =>
    setOpenKey((prev) => (prev === key ? null : key));
  const panel = (key: RailKey) =>
    `${MENU_PANEL} ${openKey === key ? "" : "hidden"}`;

  return (
    <aside
      className="hidden self-start lg:sticky lg:top-16 lg:block"
      aria-label="Anecdotal tools"
    >
      <TooltipProvider delayDuration={100}>
        <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Top referred"
                  expanded={openKey === "referred"}
                  onToggle={() => toggle("referred")}
                >
                  <Users size={16} className="text-amber-600" aria-hidden />
                  {top.length > 0 ? (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                      aria-hidden="true"
                    >
                      {top.length}
                    </span>
                  ) : null}
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Top referred" hint="Most cases referred to you" />
              </TooltipContent>
            </Tooltip>
            <div
              role="dialog"
              aria-label="Top referred students"
              aria-hidden={openKey === "referred" ? undefined : true}
              className={panel("referred")}
            >
              <KanbanBoard
                title="Top 5 referred"
                icon={<Users size={14} className="text-amber-600" aria-hidden />}
                count={top.length}
                description="Most cases referred to you."
                ariaLabel="Top referred students"
                className="border-0 [font-family:var(--font-inter)]"
              >
                {top.length === 0 ? (
                  <p className="m-0 px-1 text-[12px] text-muted-foreground">
                    No referrals yet.
                  </p>
                ) : (
                  <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    {top.map((s, i) => (
                      <li
                        key={s.lrn || s.student}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.student}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.lrn}
                          </span>
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
              </KanbanBoard>
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Legend"
                  expanded={openKey === "legend"}
                  onToggle={() => toggle("legend")}
                >
                  <Info size={16} className="text-amber-500" aria-hidden />
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                    aria-hidden="true"
                  >
                    {CATEGORY_LEGEND.length}
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Legend" hint="What each folder color means" />
              </TooltipContent>
            </Tooltip>
            <div
              role="dialog"
              aria-label="Legend"
              aria-hidden={openKey === "legend" ? undefined : true}
              className={panel("legend")}
            >
              <KanbanBoard
                title="Legend"
                icon={<Info size={14} className="text-amber-500" aria-hidden />}
                count={CATEGORY_LEGEND.length}
                description="What each folder color means."
                ariaLabel={`Legend, ${CATEGORY_LEGEND.length}`}
                className="border-0"
              >
                <ul
                  className="m-0 flex min-w-0 list-none flex-row flex-wrap content-center items-center justify-center gap-1.5 p-0"
                  aria-label="Legend categories"
                >
                  {CATEGORY_LEGEND.map((e) => (
                    <li key={e.label} className="flex">
                      <span
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-tight"
                        style={{
                          color: e.color,
                          borderColor: `color-mix(in srgb, ${e.color} 40%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${e.color} 12%, transparent)`,
                        }}
                        title={`${e.label} — ${e.hint}`}
                      >
                        {e.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </KanbanBoard>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
