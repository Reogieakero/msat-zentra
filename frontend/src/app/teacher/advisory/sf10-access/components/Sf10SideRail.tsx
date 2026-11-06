"use client";

import * as React from "react";
import { Ban, FileX } from "lucide-react";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "../../referrals/components/StudentMascot";
import type { MissingRow, MyAccessRequest } from "@/services/teacher/sf10Access.service";
import menuStyles from "@/app/teacher/classes/components/timetable-menu.module.css";

export function RejectedRequestsCard({
  requests,
  className = "bg-muted/60 [font-family:var(--font-inter)] dark:bg-muted/20",
}: {
  requests: MyAccessRequest[];
  className?: string;
}) {
  return (
    <KanbanBoard
      title="Rejected"
      icon={
        <span className="text-red-600" aria-hidden>
          <Ban size={14} />
        </span>
      }
      count={requests.length}
      description="Access requests the registrar turned down."
      ariaLabel={`Rejected, ${requests.length} requests`}
      className={className}
    >
      {requests.length === 0 ? (
        <KanbanBoardEmpty>No rejected requests.</KanbanBoardEmpty>
      ) : (
        <ul className="flex max-h-56 min-w-0 flex-col gap-2 overflow-y-auto" aria-label="Rejected requests">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-[11px] font-medium text-muted-foreground"
                  title={`${r.section} · ${r.gradeLevel}`}
                >
                  {r.section} · {r.gradeLevel}
                </span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
                  aria-hidden
                  title={r.section}
                >
                  {r.section.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug" title={r.decisionReason ?? r.reason}>
                Access request denied
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                  Denied
                </span>
                <span
                  className="inline-flex max-w-full items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                  title={r.decisionReason ?? r.reason}
                >
                  <span className="truncate">{r.decisionReason ?? r.reason}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </KanbanBoard>
  );
}

export function Sf10MissingCard({
  rows,
  pending,
  className = "bg-muted/60 [font-family:var(--font-inter)] dark:bg-muted/20",
}: {
  rows: MissingRow[];
  pending: boolean;
  className?: string;
}) {
  return (
    <KanbanBoard
      title="SF10 missing"
      icon={
        <span className="text-red-600" aria-hidden>
          <FileX size={14} />
        </span>
      }
      count={rows.length}
      description="Students with no SF10 on file."
      ariaLabel={`SF10 missing, ${rows.length} students`}
      className={className}
    >
      {pending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading missing list">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <KanbanBoardEmpty>Nothing missing.</KanbanBoardEmpty>
      ) : (
        <ul className="flex max-h-64 min-w-0 flex-col gap-2 overflow-y-auto" aria-label="Students missing SF10">
          {rows.map((m) => (
            <li
              key={m.lrn}
              className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
            >
              <div className="flex items-center gap-2">
                <StudentMascot name={m.name} seed={m.lrn} character={m.mascot ?? undefined} />
                <span className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-sm font-semibold leading-snug" title={m.name}>
                    {m.name}
                  </p>
                  <span
                    className="inline-flex w-fit max-w-full items-center truncate rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[12px] font-medium text-secondary-foreground"
                    title={m.lrn}
                  >
                    {m.lrn}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                  Missing
                </span>
                <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                  {m.gradeLevel}
                </span>
                <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                  {m.section}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </KanbanBoard>
  );
}

// Icon-only right rail — same gutter pattern as the referrals/anecdotal
// sidebars: a 9x9 icon button per card with a hover tooltip; the
// KanbanBoard lives in a flyout anchored left of the icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

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

type MenuKey = "rejected" | "missing";

export function Sf10Sidebar({
  requests,
  rows,
  pending,
}: {
  requests: MyAccessRequest[];
  rows: MissingRow[];
  pending: boolean;
}) {
  const [openKey, setOpenKey] = React.useState<MenuKey | null>(null);
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

  const toggle = (key: MenuKey) => setOpenKey((prev) => (prev === key ? null : key));
  const panel = (key: MenuKey) =>
    `${MENU_PANEL} ${menuStyles.menu} ${openKey === key ? menuStyles.menuOpen : menuStyles.menuClosed}`;

  return (
    <aside
      className="hidden self-start lg:sticky lg:top-16 lg:block"
      aria-label="SF10 tools"
    >
      <TooltipProvider delayDuration={100}>
        <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Rejected"
                  expanded={openKey === "rejected"}
                  onToggle={() => toggle("rejected")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Ban size={16} />
                  </span>
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                    aria-hidden="true"
                  >
                    {requests.length}
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Rejected" hint="Requests the registrar turned down" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="Rejected" aria-hidden={openKey === "rejected" ? undefined : true} className={panel("rejected")}>
              <RejectedRequestsCard requests={requests} className="border-0 [font-family:var(--font-inter)]" />
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="SF10 missing"
                  expanded={openKey === "missing"}
                  onToggle={() => toggle("missing")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <FileX size={16} />
                  </span>
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                    aria-hidden="true"
                  >
                    {rows.length}
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="SF10 missing" hint="Students with no SF10 on file" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="SF10 missing" aria-hidden={openKey === "missing" ? undefined : true} className={panel("missing")}>
              <Sf10MissingCard rows={rows} pending={pending} className="border-0 [font-family:var(--font-inter)]" />
            </div>
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
