"use client";

import * as React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import menuStyles from "@/app/teacher/classes/components/timetable-menu.module.css";

export const CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};

export function ChatWithBamaCard() {
  return (
    <KanbanBoard
      title="Chat with Bama"
      icon={
        <span className="inline-flex shrink-0 items-center" aria-hidden>
          <StudentMascot name="Bama" character="crt" size={16} />
        </span>
      }
      ariaLabel="Chat with Bama"
      className="[font-family:var(--font-inter)]"
      actions={
        <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
          <Link href="/teacher/chat?standalone=1" target="_blank" rel="noopener noreferrer">
            Chat now
          </Link>
        </Button>
      }
    >
      <Link
        href="/teacher/chat?standalone=1"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Chat with Bama (opens in a new tab)"
        className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-primary/60 hover:shadow dark:bg-card"
      >
        <span className="flex items-center justify-between gap-2">
          <span
            className="truncate text-[11px] font-medium text-muted-foreground"
            title="/teacher/chat?standalone=1"
          >
            /teacher/chat?standalone=1
          </span>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <StudentMascot name="Bama" character="crt" size={20} />
          </span>
        </span>
        <span className="truncate text-sm font-semibold leading-snug" title="Chat with Bama">
          Chat with Bama
        </span>
        <span className="text-xs leading-snug text-muted-foreground">
          File through chat — Bama drafts the GCForm-01 for you
        </span>
      </Link>
    </KanbanBoard>
  );
}

export function FolderLegendCard({ variant = "category" }: { variant?: "category" | "docs" } = {}) {
  const entries = getLegendEntries(variant);
  return (
    <KanbanBoard
      title="Legend"
      icon={
        <span className="text-amber-500" aria-hidden>
          <Info size={14} />
        </span>
      }
      count={entries.length}
      description="What each folder color means."
      ariaLabel={`Legend, ${entries.length}`}
      className="h-full"
    >
      <ul className="flex min-w-0 flex-row flex-wrap content-center items-center justify-center gap-1.5" aria-label="Legend categories">
        {entries.map((e) => (
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
  );
}

type LegendVariant = "category" | "docs";

type LegendEntry = { key: string; label: string; hint: string; color: string };

function getLegendEntries(variant: LegendVariant): LegendEntry[] {
  if (variant === "docs") {
    return [
      { key: "counseling", label: "Counseling", hint: "Referral cases", color: "#f59e0b" },
      { key: "intervention", label: "Intervention", hint: "Follow-up docs", color: "var(--primary)" },
      { key: "adm", label: "ADM", hint: "By category", color: "var(--muted-foreground)" },
    ];
  }
  return [
    { key: "behavioral", label: "Behavioral", hint: "Conduct and classroom behavior", color: CATEGORY_COLORS.behavioral },
    { key: "bullying", label: "Bullying", hint: "Peer conflict and bullying", color: CATEGORY_COLORS.bullying },
    { key: "academic", label: "Academic", hint: "Learning and performance", color: CATEGORY_COLORS.academic },
    { key: "attendance", label: "Attendance", hint: "Absences and tardiness", color: CATEGORY_COLORS.attendance },
    { key: "health", label: "Health", hint: "Wellness and clinic notes", color: CATEGORY_COLORS.health },
  ];
}

// Icon-only right rail — same gutter pattern as the attendance sidebar:
// a 9x9 icon button per card with a hover tooltip; the KanbanBoard
// lives in a flyout anchored left of the icon.
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

type MenuKey = "chat" | "legend";

export function AnecdotalSidebar({ variant = "category" }: { variant?: LegendVariant } = {}) {
  const [openKey, setOpenKey] = React.useState<MenuKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const entries = getLegendEntries(variant);

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
      aria-label="Anecdotal tools"
    >
      <TooltipProvider delayDuration={100}>
        <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Chat with Bama"
                  expanded={openKey === "chat"}
                  onToggle={() => toggle("chat")}
                >
                  <span className="inline-flex items-center" aria-hidden>
                    <StudentMascot name="Bama" character="crt" size={22} />
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Chat with Bama" hint="File through chat" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="Chat with Bama" aria-hidden={openKey === "chat" ? undefined : true} className={panel("chat")}>
              <KanbanBoard
                title="Chat with Bama"
                icon={
                  <span className="inline-flex shrink-0 items-center" aria-hidden>
                    <StudentMascot name="Bama" character="crt" size={16} />
                  </span>
                }
                ariaLabel="Chat with Bama"
                className="border-0 [font-family:var(--font-inter)]"
                actions={
                  <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                    <Link href="/teacher/chat?standalone=1" target="_blank" rel="noopener noreferrer">
                      Chat now
                    </Link>
                  </Button>
                }
              >
                <Link
                  href="/teacher/chat?standalone=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Chat with Bama (opens in a new tab)"
                  className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-primary/60 hover:shadow dark:bg-card"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className="truncate text-[11px] font-medium text-muted-foreground"
                      title="/teacher/chat?standalone=1"
                    >
                      /teacher/chat?standalone=1
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground"
                      aria-hidden
                    >
                      <StudentMascot name="Bama" character="crt" size={20} />
                    </span>
                  </span>
                  <span className="truncate text-sm font-semibold leading-snug" title="Chat with Bama">
                    Chat with Bama
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    File through chat — Bama drafts the GCForm-01 for you
                  </span>
                </Link>
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
                  <span className="text-amber-500" aria-hidden>
                    <Info size={16} />
                  </span>
                  {entries.length > 0 ? (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                      aria-hidden="true"
                    >
                      {entries.length}
                    </span>
                  ) : null}
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Legend" hint="What each folder color means" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="Legend" aria-hidden={openKey === "legend" ? undefined : true} className={panel("legend")}>
              <KanbanBoard
                title="Legend"
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <Info size={14} />
                  </span>
                }
                count={entries.length}
                description="What each folder color means."
                ariaLabel={`Legend, ${entries.length}`}
                className="border-0"
              >
                <ul className="flex min-w-0 flex-row flex-wrap content-center items-center justify-center gap-1.5" aria-label="Legend categories">
                  {entries.map((e) => (
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
