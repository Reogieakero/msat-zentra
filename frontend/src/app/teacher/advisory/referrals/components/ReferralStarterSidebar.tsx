"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Info, Send } from "lucide-react";
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

const STATUS_ENTRIES: { key: string; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "#f59e0b" },
  { key: "in_progress", label: "In progress", color: "#3b82f6" },
  { key: "info_requested", label: "Info requested", color: "#3b82f6" },
  { key: "follow_up", label: "Follow up", color: "#f59e0b" },
  { key: "resolved", label: "Resolved", color: "#22c55e" },
  { key: "dismissed", label: "Cancelled", color: "#ef4444" },
  { key: "rejected", label: "Rejected", color: "#ef4444" },
];

// Icon-only right rail — same gutter pattern as the attendance/anecdotal
// sidebars: a 9x9 icon button per starter card with a hover tooltip; the
// card content lives in a flyout anchored left of the icon.
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

type MenuKey = "new" | "records" | "chat" | "legend";

export function ReferralStarterSidebar({ onNewReferral }: { onNewReferral?: () => void }) {
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
      aria-label="Referral starter actions"
    >
      <TooltipProvider delayDuration={100}>
        <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="New Referral"
                  expanded={openKey === "new"}
                  onToggle={() => toggle("new")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Send size={16} />
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="New Referral" hint="Refer from an anecdotal record" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="New Referral" aria-hidden={openKey === "new" ? undefined : true} className={panel("new")}>
              <KanbanBoard
                title="New Referral"
                icon={
                  <span className="text-blue-500" aria-hidden>
                    <Send size={14} />
                  </span>
                }
                ariaLabel="New Referral"
                className="border-0 [font-family:var(--font-inter)]"
                actions={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={onNewReferral}
                  >
                    Refer now
                  </Button>
                }
              >
                <button
                  type="button"
                  onClick={onNewReferral}
                  aria-label="Start a new referral"
                  className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-muted-foreground" title="action/new-referral">
                      action/new-referral
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      aria-hidden
                    >
                      <Send size={13} />
                    </span>
                  </span>
                  <span className="truncate text-sm font-semibold leading-snug" title="New Referral">
                    New Referral
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    Refer from an anecdotal record to the right desk
                  </span>
                </button>
              </KanbanBoard>
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Anecdotal Records"
                  expanded={openKey === "records"}
                  onToggle={() => toggle("records")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <FileText size={16} />
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Anecdotal Records" hint="Referrals start from a filed record" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="Anecdotal Records" aria-hidden={openKey === "records" ? undefined : true} className={panel("records")}>
              <KanbanBoard
                title="Anecdotal Records"
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <FileText size={14} />
                  </span>
                }
                ariaLabel="Anecdotal Records"
                className="border-0 [font-family:var(--font-inter)]"
                actions={
                  <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                    <Link href="/teacher/anecdotal">See all</Link>
                  </Button>
                }
              >
                <Link
                  href="/teacher/anecdotal"
                  aria-label="Open Anecdotal Records"
                  className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-muted-foreground" title="/teacher/anecdotal">
                      /teacher/anecdotal
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      aria-hidden
                    >
                      <FileText size={13} />
                    </span>
                  </span>
                  <span className="truncate text-sm font-semibold leading-snug" title="Anecdotal Records">
                    Anecdotal Records
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    Referrals start from a filed GCForm-01 record
                  </span>
                </Link>
              </KanbanBoard>
            </div>
          </div>

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
                <GutterTip title="Chat with Bama" hint="File a record first, then refer it" />
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
                  className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
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
                    File an anecdotal record first, then refer it
                  </span>
                </Link>
              </KanbanBoard>
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Status Legend"
                  expanded={openKey === "legend"}
                  onToggle={() => toggle("legend")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Info size={16} />
                  </span>
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                    aria-hidden="true"
                  >
                    {STATUS_ENTRIES.length}
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Status Legend" hint="What each status color means" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="Status Legend" aria-hidden={openKey === "legend" ? undefined : true} className={panel("legend")}>
              <KanbanBoard
                title="Status Legend"
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <Info size={14} />
                  </span>
                }
                count={STATUS_ENTRIES.length}
                ariaLabel={`Status Legend, ${STATUS_ENTRIES.length}`}
                className="border-0"
              >
                <ul
                  className="flex min-w-0 flex-row flex-wrap content-center items-center justify-center gap-1.5"
                  aria-label="Referral status legend"
                >
                  {STATUS_ENTRIES.map((e) => (
                    <li key={e.key} className="flex">
                      <span
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-tight"
                        style={{
                          color: e.color,
                          borderColor: `color-mix(in srgb, ${e.color} 40%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${e.color} 12%, transparent)`,
                        }}
                        title={e.label}
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
