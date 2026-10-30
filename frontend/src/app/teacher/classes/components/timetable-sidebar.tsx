"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserRound } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import type { buildTimetableReminder, getReminderMeta } from "./my-timetable-reminder";
import menuStyles from "./timetable-menu.module.css";

export interface LinkedName {
  id: string;
  name: string;
  code: string | null;
}

function CodePill({ code }: { code: string }) {
  return (
    <Pill tone="amber" label="Teacher code">
      {code}
    </Pill>
  );
}

type MenuKey = "linked" | "reminder";

function IconBoxButton({
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
      className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
        expanded
          ? "border-amber-500/60 bg-amber-500/10"
          : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
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

// Flyout panel — same look as the grading workspace gutter: solid surface,
// shadow + ring, smooth open/close. Anchored left of the gutter icon
// (beside it, not underneath).
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

/**
 * Icon-only right gutter. Each icon carries a tooltip and toggles a
 * kanban-board flyout overlay beside the icon — same pattern as the
 * grading workspace gutter. Nothing stays expanded inline.
 */
export function TimetableSidebar({
  linked,
  reminder,
  reminderMeta,
  onReleaseRequest,
}: {
  linked: LinkedName | null;
  reminder: ReturnType<typeof buildTimetableReminder>;
  reminderMeta: ReturnType<typeof getReminderMeta>;
  onReleaseRequest: () => void;
}) {
  const [openKey, setOpenKey] = React.useState<MenuKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled overlays (tooltips) live outside the rail — interacting
      // with them must not dismiss the open panel.
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

  const toggle = (key: MenuKey) =>
    setOpenKey((prev) => (prev === key ? null : key));

  // Every teacher — master included — must link a code: the linked panel
  // only shows when a link code exists.
  const showLinked = !!linked;
  const linkedTitle = linked ? `Linked as ${linked.name}` : "Linked teacher";
  const showReminder = !!reminder && !!reminderMeta;

  if (!showLinked && !showReminder) return null;

  return (
    <TooltipProvider delayDuration={100}>
    <div ref={railRef} className="flex flex-row justify-end gap-2 self-start lg:sticky lg:top-16 lg:flex-col lg:items-end">
      {showLinked ? (
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
          <IconBoxButton
            label={linkedTitle}
            expanded={openKey === "linked"}
            onToggle={() => toggle("linked")}
          >
            <span className="text-amber-500" aria-hidden>
              <UserRound size={16} />
            </span>
          </IconBoxButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip
                title="Linked teacher"
                hint={linked?.code ? `${linked.name} · ${linked.code}` : (linked?.name ?? "View link details")}
              />
            </TooltipContent>
          </Tooltip>
          <div
            role="dialog"
            aria-label={linkedTitle}
            aria-hidden={openKey === "linked" ? undefined : true}
            className={`${MENU_PANEL} ${menuStyles.menu} ${openKey === "linked" ? menuStyles.menuOpen : menuStyles.menuClosed}`}
          >
              <KanbanBoard
                title={linkedTitle}
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <UserRound size={14} />
                  </span>
                }
                description={
                  <>
                    {linked?.code ? (
                      <>
                        <CodePill code={linked.code} />{" "}
                      </>
                    ) : null}
                    Showing your scheduled subjects and timeslots.
                  </>
                }
                className="border-0"
                footer={
                  linked ? (
                    <div className="flex justify-end gap-1.5 px-1 pb-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onReleaseRequest}
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Unlink code
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                <p className="px-1 text-xs text-muted-foreground">
                  Classes follow this teacher&apos;s scheduled subjects.
                </p>
              </KanbanBoard>
          </div>
        </div>
      ) : null}

      {showReminder && reminder && reminderMeta ? (
        <div
          className="relative"
          role="status"
          aria-label={`Class reminder: ${reminder.title} — ${reminder.message}`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
          <IconBoxButton
            label={reminder.title}
            expanded={openKey === "reminder"}
            onToggle={() => toggle("reminder")}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${reminderMeta.chip}`}
              aria-hidden
            >
              <reminderMeta.Icon size={13} className={reminderMeta.icon} />
            </span>
          </IconBoxButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip title={reminder.title} hint="View schedule reminder" />
            </TooltipContent>
          </Tooltip>
          <div
            role="dialog"
            aria-label={reminder.title}
            aria-hidden={openKey === "reminder" ? undefined : true}
            className={`${MENU_PANEL} ${menuStyles.menu} ${openKey === "reminder" ? menuStyles.menuOpen : menuStyles.menuClosed}`}
          >
              <KanbanBoard
                title={reminder.title}
                icon={
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${reminderMeta.chip}`}
                    aria-hidden
                  >
                    <reminderMeta.Icon size={13} className={reminderMeta.icon} />
                  </span>
                }
                description={reminder.message}
                className="border-0"
                style={{
                  borderColor: `color-mix(in oklch, ${reminderMeta.from} 45%, transparent)`,
                  background: `linear-gradient(135deg, color-mix(in oklch, ${reminderMeta.from} 26%, var(--card)), color-mix(in oklch, ${reminderMeta.to} 18%, var(--card)))`,
                }}
              >
                <p className="px-1 text-xs text-muted-foreground">
                  Based on today&apos;s timetable.
                </p>
              </KanbanBoard>
          </div>
        </div>
      ) : null}
    </div>
    </TooltipProvider>
  );
}
