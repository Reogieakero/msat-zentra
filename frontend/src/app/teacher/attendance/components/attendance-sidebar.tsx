"use client";
import * as React from "react";
import { useMemo } from "react";
import { Blocks, BookOpen, CalendarDays, Search } from "lucide-react";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import { SheetDatePicker } from "./sheet-date-picker";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import kanbanStyles from "@/app/teacher/schedule/components/subject-kanban.module.css";
import menuStyles from "@/app/teacher/classes/components/timetable-menu.module.css";
import type { SlotCard } from "./use-slot-cards";

// Flyout panel — same look as the grading workspace gutter: solid surface,
// shadow + ring, smooth open/close. Anchored left of the gutter icon.
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

type MenuKey = "date" | "subjects";

export function AttendanceSidebar({
  date,
  onDateChange,
  meetupDates,
  slotCards,
  hasSubjects,
  activeSlotKey,
  slotQuery,
  onSlotQueryChange,
  onSelect,
  blocksMode,
  onToggleBlocks,
}: {
  date: string;
  onDateChange: (date: string) => void;
  meetupDates: string[] | null;
  slotCards: SlotCard[];
  hasSubjects: boolean;
  activeSlotKey: string | null;
  slotQuery: string;
  onSlotQueryChange: (value: string) => void;
  onSelect: (card: SlotCard) => void;
  blocksMode: boolean;
  onToggleBlocks: () => void;
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

  const groups = useMemo(() => {
    const bySection = new Map<string, SlotCard[]>();
    for (const c of slotCards) {
      const arr = bySection.get(c.section.id) ?? [];
      arr.push(c);
      bySection.set(c.section.id, arr);
    }
    return [...bySection.entries()].map(([id, items]) => ({
      id,
      label: items[0].section.name,
      items,
    }));
  }, [slotCards]);

  let rowIndex = 0;

  return (
    <aside className="self-start lg:sticky lg:top-16" aria-label="Attendance tools">
      <TooltipProvider delayDuration={100}>
        <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Sheet date"
                  expanded={openKey === "date"}
                  onToggle={() => toggle("date")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <CalendarDays size={16} />
                  </span>
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Sheet date" hint={date} />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="Sheet date" aria-hidden={openKey === "date" ? undefined : true} className={panel("date")}>
              <KanbanBoard
                title="Sheet date"
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <CalendarDays size={14} />
                  </span>
                }
                description="Pick which meetup sheet to open."
                className="border-0"
              >
                <div className="px-1">
                  <SheetDatePicker date={date} onChange={onDateChange} meetupDates={meetupDates} />
                </div>
              </KanbanBoard>
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <GutterIconButton
                  label="Subjects"
                  expanded={openKey === "subjects"}
                  onToggle={() => toggle("subjects")}
                >
                  <span className="text-amber-500" aria-hidden>
                    <BookOpen size={16} />
                  </span>
                  {slotCards.length > 0 ? (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                      aria-hidden="true"
                    >
                      {slotCards.length}
                    </span>
                  ) : null}
                </GutterIconButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip
                  title="Subjects"
                  hint={slotCards.length > 0 ? `${slotCards.length} to pick from` : "No scheduled subjects"}
                />
              </TooltipContent>
            </Tooltip>
            <div role="dialog" aria-label="Subjects" aria-hidden={openKey === "subjects" ? undefined : true} className={panel("subjects")}>
              <KanbanBoard
                title="Subjects"
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <BookOpen size={14} />
                  </span>
                }
                count={
                  slotCards.length > 0 ? (
                    <span className="text-amber-600 dark:text-amber-500">{slotCards.length}</span>
                  ) : undefined
                }
                description="Pick a subject to open its sheet."
                toolbar={
                  <div className="px-1">
                    <InputGroup className="w-full">
                      <InputGroupInput
                        placeholder="Search subjects..."
                        value={slotQuery}
                        onChange={(event) => onSlotQueryChange(event.target.value)}
                        aria-label="Search subjects"
                      />
                      <InputGroupAddon>
                        <Search size={16} aria-hidden />
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                }
                className="border-0"
              >
                {slotCards.length === 0 ? (
                  <KanbanBoardEmpty>
                    {hasSubjects ? "No subjects match your search." : "No scheduled subjects yet."}
                  </KanbanBoardEmpty>
                ) : (
                  <ScrollList className="max-h-[50dvh] gap-1 px-1" ariaLabel="Subjects">
                    {groups.map((group) => (
                      <div key={group.id} className="flex min-w-0 flex-col gap-1">
                        <p className="px-1 pt-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase first:pt-0">
                          {group.label}
                        </p>
                        {group.items.map((c) => {
                          const active = c.key === activeSlotKey;
                          const approved = c.status === "APPROVED";
                          const idx = rowIndex++;
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => {
                                onSelect(c);
                                setOpenKey(null);
                              }}
                              aria-current={active ? "true" : undefined}
                              aria-label={`${c.subject.name} — ${c.section.name}${c.live ? ", live now" : ""}`}
                              title={`${c.subject.name} — ${c.section.name}${c.live ? " · Live" : ""}`}
                              className={`${kanbanStyles.card} w-full cursor-pointer text-left ${active ? kanbanStyles.cardSelected : ""}`}
                              style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                            >
                              <span className={kanbanStyles.name} title={c.subject.name}>
                                {c.subject.name}{" "}
                                <span className={kanbanStyles.code}>{c.subject.code}</span>
                              </span>
                              <span className={kanbanStyles.meta}>
                                {c.live ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded border border-emerald-600/45 bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/45 dark:text-emerald-400">
                                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    </span>
                                    Live
                                  </span>
                                ) : null}
                                <span className={kanbanStyles.pill} title={`${c.sessionCount} weekly session${c.sessionCount === 1 ? "" : "s"}`}>
                                  {c.sessionCount}×
                                </span>
                                <span
                                  aria-hidden="true"
                                  title={approved ? "approved" : "submitted"}
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${approved ? "bg-green-500" : "bg-blue-500"}`}
                                />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </ScrollList>
                )}
              </KanbanBoard>
            </div>
          </div>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleBlocks}
                  aria-pressed={blocksMode}
                  aria-label={blocksMode ? "Turn meetup blocks off" : "Turn meetup blocks on"}
                  title={blocksMode ? "Blocks view is on — click to turn off" : "Blocks view is off — click to turn on"}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    blocksMode
                      ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
                      : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                  }`}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Blocks size={16} />
                  </span>
                  {blocksMode ? (
                    <span
                      className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-card"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <GutterTip title="Meetup blocks" hint={blocksMode ? "On — click to turn off" : "Off — click to turn on"} />
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
