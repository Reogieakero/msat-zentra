"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookPlus,
  CalendarDays,
  ExternalLink,
  Send,
  SlidersHorizontal,
  UserPlus,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ScheduleSectionSummary, ScheduleSubject } from "../page";
import menuStyles from "../../classes/components/timetable-menu.module.css";

// Flyout panel — same look as the grading workspace gutter: solid surface,
// shadow + ring, smooth open/close. Anchored left of the gutter icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type MenuKey = "template" | "subjects" | "teachers" | "send" | "configure";
type TeacherName = { id: string; name: string; code: string | null; linked: boolean };

function GutterIconButton({
  label,
  expanded,
  onToggle,
  disabled,
  children,
  ref,
  ...triggerProps
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
} & Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "aria-label">) {
  return (
    <button
      ref={ref}
      type="button"
      {...triggerProps}
      onClick={disabled ? undefined : onToggle}
      aria-disabled={disabled || undefined}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label={expanded ? `Close ${label}` : `Open ${label}`}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
        disabled
          ? "cursor-not-allowed border-border bg-card opacity-40"
          : expanded
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
 * Icon-only right gutter for /teacher/schedule.
 * Same tooltip + flyout interaction as the grading WorkspaceGutter, but
 * navigation-only: every action links to /teacher/schedule/template where
 * the work actually happens. No modals live on this page.
 */
export function ScheduleGutter() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const [openKey, setOpenKey] = React.useState<MenuKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled tooltips live outside the rail — interacting with them
      // must not dismiss the open panel.
      if (target?.closest?.('[data-slot="tooltip-content"]')) return;
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

  const subjectsQuery = useQuery<{ subjects: ScheduleSubject[] }>({
    queryKey: ["teacher-schedule-subjects", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ subjects: ScheduleSubject[] }>(
        "/api/teacher/schedule/subjects",
      );
      return data;
    },
  });
  const teachersQuery = useQuery<{ teachers: TeacherName[] }>({
    queryKey: ["teacher-schedule-teachers", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teachers: TeacherName[] }>(
        "/api/teacher/schedule/teachers",
      );
      return data;
    },
  });
  const sectionsQuery = useQuery<{ sections: ScheduleSectionSummary[] }>({
    queryKey: ["teacher-schedule-summary", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSectionSummary[] }>(
        "/api/teacher/schedule?summary=1",
      );
      return data;
    },
  });

  const subjects = subjectsQuery.data?.subjects ?? [];
  const teacherNames = teachersQuery.data?.teachers ?? [];
  const totalDrafts = (sectionsQuery.data?.sections ?? []).reduce(
    (n, s) => n + s.timetableEntries.filter((e) => e.status === "DRAFT").length,
    0,
  );

  return (
    <TooltipProvider delayDuration={100}>
      <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton
                label="Schedule template"
                expanded={openKey === "template"}
                onToggle={() => toggle("template")}
              >
                <span className="text-amber-500" aria-hidden>
                  <CalendarDays size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip title="Schedule template" hint="Per-section builder — new tab" />
            </TooltipContent>
          </Tooltip>
          <div
            role="dialog"
            aria-label="Schedule template"
            aria-hidden={openKey === "template" ? undefined : true}
            className={panel("template")}
          >
            <KanbanBoard
              title="Schedule template"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <CalendarDays size={14} />
                </span>
              }
              description="Generic per-section builder — teachers, subjects, day shape, then slots."
              className="border-0"
              footer={
                <div className="flex justify-end gap-1.5 px-1 pb-1">
                  <Button asChild size="sm" className="h-6 px-2 text-xs">
                    <a href="/teacher/schedule/template" target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} aria-hidden />
                      Open schedule template
                    </a>
                  </Button>
                </div>
              }
            >
              <p className="flex-1 px-1 text-xs text-muted-foreground">
                Opens in a new tab so the workspace stays in place.
              </p>
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton
                label="Add Subject"
                expanded={openKey === "subjects"}
                onToggle={() => toggle("subjects")}
              >
                <span className="text-amber-500" aria-hidden>
                  <BookPlus size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip
                title="Add Subject"
                hint={
                  subjectsQuery.isPending
                    ? "Loading…"
                    : subjectsQuery.isError
                      ? "Could not load"
                      : `${subjects.length} in catalog`
                }
              />
            </TooltipContent>
          </Tooltip>
          <div
            role="dialog"
            aria-label="Add Subject"
            aria-hidden={openKey === "subjects" ? undefined : true}
            className={panel("subjects")}
          >
            <KanbanBoard
              title="Add Subject"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <BookPlus size={14} />
                </span>
              }
              count={<span className="text-amber-600 dark:text-amber-500">{subjects.length}</span>}
              description="Create one or more subjects for grades 7–10. Usable immediately."
              className="border-0"
              footer={
                <div className="flex justify-end gap-1.5 px-1 pb-1">
                  <Button asChild variant="outline" size="sm" className="h-6 px-2 text-xs">
                    <a href="/teacher/schedule/template?view=subjects" target="_blank" rel="noopener noreferrer">
                      See all
                    </a>
                  </Button>
                  <Button asChild size="sm" className="h-6 px-2 text-xs">
                    <a href="/teacher/schedule/template?view=add-subject" target="_blank" rel="noopener noreferrer">
                      Add subject
                    </a>
                  </Button>
                </div>
              }
            >
              <p className="flex-1 px-1 text-xs text-muted-foreground">
                {subjectsQuery.isPending
                  ? "Loading subjects…"
                  : subjectsQuery.isError
                    ? "Could not load subjects."
                    : `${subjects.length} subject${subjects.length === 1 ? "" : "s"} in catalog.`}
              </p>
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton
                label="Add Teachers"
                expanded={openKey === "teachers"}
                onToggle={() => toggle("teachers")}
              >
                <span className="text-amber-500" aria-hidden>
                  <UserPlus size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip
                title="Add Teachers"
                hint={
                  teachersQuery.isPending
                    ? "Loading…"
                    : teachersQuery.isError
                      ? "Could not load"
                      : `${teacherNames.length} in catalog`
                }
              />
            </TooltipContent>
          </Tooltip>
          <div
            role="dialog"
            aria-label="Add Teachers"
            aria-hidden={openKey === "teachers" ? undefined : true}
            className={panel("teachers")}
          >
            <KanbanBoard
              title="Add Teachers"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <UserPlus size={14} />
                </span>
              }
              count={<span className="text-amber-600 dark:text-amber-500">{teacherNames.length}</span>}
              description="Type a name once, pick it forever. Just a name list."
              className="border-0"
              footer={
                <div className="flex justify-end gap-1.5 px-1 pb-1">
                  <Button asChild variant="outline" size="sm" className="h-6 px-2 text-xs">
                    <a href="/teacher/schedule/template?view=teachers" target="_blank" rel="noopener noreferrer">
                      See all
                    </a>
                  </Button>
                  <Button asChild size="sm" className="h-6 px-2 text-xs">
                    <a href="/teacher/schedule/template?view=add-teacher" target="_blank" rel="noopener noreferrer">
                      Add teacher
                    </a>
                  </Button>
                </div>
              }
            >
              <p className="flex-1 px-1 text-xs text-muted-foreground">
                {teachersQuery.isPending
                  ? "Loading teachers…"
                  : teachersQuery.isError
                    ? "Could not load teachers."
                    : `${teacherNames.length} teacher${teacherNames.length === 1 ? "" : "s"} in catalog.`}
              </p>
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton
                label={totalDrafts > 0 ? `Send to principal (${totalDrafts})` : "Send to principal"}
                expanded={openKey === "send"}
                onToggle={() => toggle("send")}
              >
                <span className="text-amber-500" aria-hidden>
                  <Send size={16} />
                </span>
                {totalDrafts > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                    aria-hidden="true"
                  >
                    {totalDrafts}
                  </span>
                ) : null}
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip
                title="Send to principal"
                hint={totalDrafts > 0 ? `${totalDrafts} draft${totalDrafts === 1 ? "" : "s"} awaiting review` : "No drafts"}
              />
            </TooltipContent>
          </Tooltip>
          <div
            role="dialog"
            aria-label="Send to principal"
            aria-hidden={openKey === "send" ? undefined : true}
            className={panel("send")}
          >
            <KanbanBoard
              title="Send to Principal"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <Send size={14} />
                </span>
              }
              count={<span className="text-amber-600 dark:text-amber-500">{totalDrafts}</span>}
              description={
                totalDrafts > 0
                  ? `${totalDrafts} draft slot${totalDrafts === 1 ? "" : "s"} awaiting review. Submitted slots await principal approval.`
                  : "No draft slots right now."
              }
              className="border-0"
              footer={
                <div className="flex justify-end gap-1.5 px-1 pb-1">
                  <Button asChild size="sm" className="h-6 px-2 text-xs">
                    <a href="/teacher/schedule/template?view=send" target="_blank" rel="noopener noreferrer">
                      {`Send to principal${totalDrafts > 0 ? ` (${totalDrafts})` : ""}`}
                    </a>
                  </Button>
                </div>
              }
            >
              <p className="flex-1 px-1 text-xs text-muted-foreground">
                {totalDrafts > 0
                  ? "Review and send from the template — drafts flip to submitted there."
                  : "Stage timetable cells first — drafts appear here."}
              </p>
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton
                label="Configure"
                expanded={openKey === "configure"}
                onToggle={() => toggle("configure")}
              >
                <span className="text-amber-500" aria-hidden>
                  <SlidersHorizontal size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip title="Configure" hint="Day shape, breaks, periods" />
            </TooltipContent>
          </Tooltip>
          <div
            role="dialog"
            aria-label="Configure"
            aria-hidden={openKey === "configure" ? undefined : true}
            className={panel("configure")}
          >
            <KanbanBoard
              title="Configure"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <SlidersHorizontal size={14} />
                </span>
              }
              description="School day shape, breaks and period lengths."
              className="border-0"
              footer={
                <div className="flex justify-end gap-1.5 px-1 pb-1">
                  <Button asChild size="sm" className="h-6 px-2 text-xs">
                    <a href="/teacher/schedule/template?view=config" target="_blank" rel="noopener noreferrer">
                      <SlidersHorizontal size={14} aria-hidden />
                      Configure
                    </a>
                  </Button>
                </div>
              }
            >
              <p className="flex-1 px-1 text-xs text-muted-foreground">
                General shape for the whole term — edit it in the template.
              </p>
            </KanbanBoard>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
