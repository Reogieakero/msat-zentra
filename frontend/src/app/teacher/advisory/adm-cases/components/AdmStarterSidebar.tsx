"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Info, Route, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { stageColor } from "@/services/teacher/admCases.labels";
import menuStyles from "@/app/teacher/classes/components/timetable-menu.module.css";

const ADM_STAGE_ENTRIES: { key: string; label: string; color: string; title: string }[] = [
  { key: "anecdotal", label: "Anecdotal", color: stageColor("anecdotal"), title: "Stage 1 · Anecdotal Report Filed" },
  { key: "consultation", label: "Consultation", color: stageColor("consultation"), title: "Stage 2 · Consultation & Referral" },
  { key: "meeting_parents", label: "Meeting", color: stageColor("meeting_parents"), title: "Stage 3 · Meeting with Parents/Guardians" },
  { key: "home_visitation", label: "Home Visit", color: stageColor("home_visitation"), title: "Stage 4 · Home Visitation (if no meeting)" },
  { key: "certification", label: "Certification", color: stageColor("certification"), title: "Stage 5 · Recommendation & Certification" },
  { key: "principal_approval", label: "Approval", color: stageColor("principal_approval"), title: "Stage 6 · School Head (Principal) Approval" },
  { key: "enrollment_monitoring", label: "Modules", color: stageColor("enrollment_monitoring"), title: "Stage 7 · Modules Completed & Returned" },
  { key: "completion", label: "Closed", color: stageColor("completion"), title: "Stage 8 · Case Closed" },
];

// Icon-only right rail — same gutter pattern as the referrals sidebar:
// a 9x9 icon button per starter card with a hover tooltip; the card
// content lives in a flyout anchored left of the icon.
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

type MenuKey = "new" | "records" | "referrals" | "pipeline";

export function AdmStarterSidebar({ onReferAdm }: { onReferAdm?: () => void }) {
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
      aria-label="ADM starter actions"
    >
      <TooltipProvider delayDuration={100}>
        <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="New ADM Referral"
                  expanded={openKey === "new"}
                  onToggle={() => toggle("new")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Send size={16} />
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="New ADM Referral" hint="Refer through the ADM track" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="New ADM Referral" aria-hidden={openKey === "new" ? undefined : true} className={panel("new")}>
              <KanbanBoard
                title="New ADM Referral"
                icon={
                  <span className="text-blue-500" aria-hidden>
                    <Send size={14} />
                  </span>
                }
                ariaLabel="New ADM Referral"
                className="border-0 [font-family:var(--font-inter)]"
                actions={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={onReferAdm}
                  >
                    Refer now
                  </Button>
                }
              >
                <button
                  type="button"
                  onClick={onReferAdm}
                  aria-label="Start a new ADM referral"
                  className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-muted-foreground" title="action/new-adm-referral">
                      action/new-adm-referral
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      aria-hidden
                    >
                      <Send size={13} />
                    </span>
                  </span>
                  <span className="truncate text-sm font-semibold leading-snug" title="New ADM Referral">
                    New ADM Referral
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    Refer from an anecdotal record through the ADM track
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
                <GutterTip title="Anecdotal Records" hint="ADM cases start from a filed record" />
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
                    ADM cases start from a filed GCForm-01 record
                  </span>
                </Link>
              </KanbanBoard>
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="My Referrals"
                  expanded={openKey === "referrals"}
                  onToggle={() => toggle("referrals")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Route size={16} />
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="My Referrals" hint="Endorsed referrals become ADM cases" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="My Referrals" aria-hidden={openKey === "referrals" ? undefined : true} className={panel("referrals")}>
              <KanbanBoard
                title="My Referrals"
                icon={
                  <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                    <Route size={14} />
                  </span>
                }
                ariaLabel="My Referrals"
                className="border-0 [font-family:var(--font-inter)]"
                actions={
                  <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                    <Link href="/teacher/advisory/referrals">Track</Link>
                  </Button>
                }
              >
                <Link
                  href="/teacher/advisory/referrals"
                  aria-label="Open My Referrals"
                  className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-muted-foreground" title="/teacher/advisory/referrals">
                      /teacher/advisory/referrals
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      aria-hidden
                    >
                      <Route size={13} />
                    </span>
                  </span>
                  <span className="truncate text-sm font-semibold leading-snug" title="My Referrals">
                    My Referrals
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    Submitted referrals become ADM cases once endorsed
                  </span>
                </Link>
              </KanbanBoard>
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="ADM Pipeline"
                  expanded={openKey === "pipeline"}
                  onToggle={() => toggle("pipeline")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Info size={16} />
                  </span>
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                    aria-hidden="true"
                  >
                    {ADM_STAGE_ENTRIES.length}
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="ADM Pipeline" hint="What each stage color means" />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="ADM Pipeline" aria-hidden={openKey === "pipeline" ? undefined : true} className={panel("pipeline")}>
              <KanbanBoard
                title="ADM Pipeline"
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <Info size={14} />
                  </span>
                }
                count={ADM_STAGE_ENTRIES.length}
                ariaLabel={`ADM Pipeline, ${ADM_STAGE_ENTRIES.length}`}
                className="border-0"
              >
                <ul
                  className="flex min-w-0 flex-row flex-wrap content-center items-center justify-center gap-1.5"
                  aria-label="ADM stage legend"
                >
                  {ADM_STAGE_ENTRIES.map((e) => (
                    <li key={e.key} className="flex">
                      <span
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-tight"
                        style={{
                          color: e.color,
                          borderColor: `color-mix(in srgb, ${e.color} 40%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${e.color} 12%, transparent)`,
                        }}
                        title={e.title}
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
