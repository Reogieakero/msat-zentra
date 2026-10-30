"use client";

import * as React from "react";
import { BookOpenText, FileText, Lock, Pencil, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pill } from "@/components/ui/pill";
import { gradeLabel } from "@/services/teacher/grading.compute";
import type {
  ClassAssignment,
  ClassComponent,
  ClassDetail,
} from "@/services/teacher/grading.types";
import { LockGradesButton } from "./LockGradesButton";
import { AddAssessmentForm } from "./AddAssessmentForm";
import { WeightsEditor } from "./WeightsEditor";
import menuStyles from "../../../classes/components/timetable-menu.module.css";

// Flyout panel — same look as the classes icon-rail menus: solid surface,
// shadow + ring, smooth open/close. Anchored left of the gutter icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

// Wider variant for the weights editor so the three category cards fit
// without wrapping or clipping. Capped to the viewport on small screens.
const WEIGHTS_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-[calc(100vw-6rem)] max-w-[28rem] overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-[28rem]";

function WeightsDonut({ ww, pt, exam }: { ww: number; pt: number; exam: number }) {
  const total = ww + pt + exam;
  const segs = [
    { value: ww, color: "#3b82f6" },
    { value: pt, color: "#f59e0b" },
    { value: exam, color: "#ef4444" },
  ];
  let acc = 0;
  return (
    <div className="relative mx-auto h-32 w-32" role="img" aria-label={`Weights: Written Work ${ww} percent, Performance Task ${pt} percent, Exam ${exam} percent`}>
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
        <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="5" className="stroke-muted" />
        {segs.map((s, i) => {
          const offset = acc;
          acc += s.value;
          if (s.value <= 0) return null;
          return (
            <circle
              key={i}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={s.color}
              strokeWidth="5"
              pathLength={100}
              strokeDasharray={`${s.value} ${100 - s.value}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{total}%</span>
      </span>
    </div>
  );
}

type MenuKey = "subject" | "weights" | "add" | "record" | "lock";

export type WorkspaceView = "scores" | "finals";

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

type Props = {
  assignment: ClassAssignment;
  detail: ClassDetail;
  studentCount: number;
  assignmentId: string;
  components: ClassComponent[];
  unlockCount: number;
  subjectLabel: string;
  termLabel: string;
  onWeightsSaved: () => void;
};

/**
 * Icon-only right gutter. Each icon carries a tooltip and toggles a
 * kanban-board flyout overlay with the details — nothing stays expanded
 * inline. Actions (add, record, lock) live inside their overlays.
 */
export function WorkspaceGutter({
  assignment,
  detail,
  studentCount,
  assignmentId,
  components,
  unlockCount,
  subjectLabel,
  termLabel,
  onWeightsSaved,
}: Props) {
  const [openKey, setOpenKey] = React.useState<MenuKey | null>(null);
  const [editingWeights, setEditingWeights] = React.useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);

  // Re-opening the weights flyout should always land on the summary view,
  // never a half-filled editor left over from a previous open.
  // Render-time adjustment (not an effect) to satisfy the react-compiler gate.
  const [prevOpenKey, setPrevOpenKey] = React.useState<MenuKey | null>(openKey);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (!openKey && editingWeights) setEditingWeights(false);
  }

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled overlays (calendar popover, tooltips) live outside the
      // rail — interacting with them must not dismiss the open panel.
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
  const weightOf = (type: string) => components.find((c) => c.type === type)?.weight ?? 0;
  const panel = (key: MenuKey) =>
    `${MENU_PANEL} ${menuStyles.menu} ${openKey === key ? menuStyles.menuOpen : menuStyles.menuClosed}`;
  const weightsPanel = `${WEIGHTS_PANEL} ${menuStyles.menu} ${openKey === "weights" ? menuStyles.menuOpen : menuStyles.menuClosed}`;

  return (
    <TooltipProvider delayDuration={100}>
      <div ref={railRef} className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton label="Subject info" expanded={openKey === "subject"} onToggle={() => toggle("subject")}>
                <span className="text-amber-500" aria-hidden>
                  <BookOpenText size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip title="Subject info" hint={`${assignment.sectionName} · Grade ${gradeLabel(assignment.gradeLevel)}`} />
            </TooltipContent>
          </Tooltip>
          <div role="dialog" aria-label="Subject info" aria-hidden={openKey === "subject" ? undefined : true} className={panel("subject")}>
            <KanbanBoard
              title={assignment.subjectName}
              icon={
                <span className="text-amber-500" aria-hidden>
                  <BookOpenText size={14} />
                </span>
              }
              actions={
                <span className="flex items-center gap-1.5">
                  <Pill tone="amber" label="Section">{assignment.sectionName}</Pill>
                  <Pill tone="amber" label="Grade level">Grade {gradeLabel(assignment.gradeLevel)}</Pill>
                </span>
              }
              description={`${assignment.subjectCode} · Term ${assignment.termNumber}`}
              className="border-0"
            >
              <span className="flex flex-wrap items-center gap-1.5 px-1">
                <Pill tone="amber" label="Enrolled students">
                  {studentCount} student{studentCount === 1 ? "" : "s"} enrolled
                </Pill>
                <Pill tone="amber" label="Subject category">{assignment.subjectCategory === "ELECTIVE" ? "Elective" : "Core"}</Pill>
              </span>
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton label="Subject weights" expanded={openKey === "weights"} onToggle={() => toggle("weights")}>
                <span className="text-amber-500" aria-hidden>
                  <Scale size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip title="Subject weights" hint={`WW ${weightOf("WRITTEN_WORK")} · PT ${weightOf("PERFORMANCE_TASK")} · E ${weightOf("EXAM")}`} />
            </TooltipContent>
          </Tooltip>
          <div role="dialog" aria-label="Subject weights" aria-hidden={openKey === "weights" ? undefined : true} className={weightsPanel}>
            {editingWeights ? (
              <KanbanBoard
                title="Category weights"
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <Scale size={14} />
                  </span>
                }
                description="Each category's share of the final grade. The three weights must total 100%."
                className="border-0"
              >
                <WeightsEditor
                  key={openKey === "weights" ? "open" : "closed"}
                  detail={detail}
                  onConfirm={() => setOpenKey(null)}
                  onSaved={() => {
                    setEditingWeights(false);
                    setOpenKey(null);
                    onWeightsSaved();
                  }}
                />
              </KanbanBoard>
            ) : (
            <KanbanBoard
              title="Subject weights"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <Scale size={14} />
                </span>
              }
              actions={
                <button
                  type="button"
                  onClick={() => setEditingWeights(true)}
                  aria-label="Edit subject weights"
                  title="Edit weights"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              }
              className="border-0"
            >
              <div className="px-1">
                <WeightsDonut
                  ww={weightOf("WRITTEN_WORK")}
                  pt={weightOf("PERFORMANCE_TASK")}
                  exam={weightOf("EXAM")}
                />
              </div>
              <div className="flex flex-col gap-1.5 px-1 text-sm" aria-label="Weight legend">
                {(
                  [
                    { key: "WRITTEN_WORK", label: "Written Work", color: "#3b82f6" },
                    { key: "PERFORMANCE_TASK", label: "Performance Task", color: "#f59e0b" },
                    { key: "EXAM", label: "Exam", color: "#ef4444" },
                  ] as const
                ).map((row) => (
                  <span key={row.key} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{weightOf(row.key)}%</span>
                  </span>
                ))}
              </div>
            </KanbanBoard>
            )}
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton label="Add assessment" expanded={openKey === "add"} onToggle={() => toggle("add")}>
                <span className="text-amber-500" aria-hidden>
                  <Plus size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip title="Add assessment" hint="New quiz, activity, or exam" />
            </TooltipContent>
          </Tooltip>
          <div role="dialog" aria-label="Add assessment" aria-hidden={openKey === "add" ? undefined : true} className={panel("add")}>
            <KanbanBoard
              title="Add assessment"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <Plus size={14} />
                </span>
              }
              description="New quiz, activity, or exam for this class."
              className="border-0"
            >
              <AddAssessmentForm
                key={openKey === "add" ? "open" : "closed"}
                assignmentId={assignmentId}
                onSaved={() => setOpenKey(null)}
              />
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton label="Class record" expanded={openKey === "record"} onToggle={() => toggle("record")}>
                <span className="text-amber-500" aria-hidden>
                  <FileText size={16} />
                </span>
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip title="Class record" hint="Printable sheet — new tab" />
            </TooltipContent>
          </Tooltip>
          <div role="dialog" aria-label="Class record" aria-hidden={openKey === "record" ? undefined : true} className={panel("record")}>
            <KanbanBoard
              title="Class record"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <FileText size={14} />
                </span>
              }
              description="Printable sheet — opens in a new tab."
              className="border-0"
              footer={
                <div className="flex justify-end px-1 pb-1">
                  <Button
                    asChild
                    size="sm"
                    className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  >
                    <a href={`/record/${assignmentId}`} target="_blank" rel="noopener noreferrer">
                      Open record
                    </a>
                  </Button>
                </div>
              }
            >
              <p className="px-1 text-xs text-muted-foreground">
                {assignment.subjectName} · {assignment.sectionName}
              </p>
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <GutterIconButton
                label={unlockCount > 0 ? `Lock grades (${unlockCount})` : "Lock grades"}
                expanded={openKey === "lock"}
                onToggle={() => toggle("lock")}
                disabled={unlockCount === 0}
              >
                <span className="text-amber-500" aria-hidden>
                  <Lock size={16} />
                </span>
                {unlockCount > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                    aria-hidden="true"
                  >
                    {unlockCount}
                  </span>
                ) : null}
              </GutterIconButton>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              <GutterTip
                title="Lock grades"
                hint={unlockCount > 0 ? `${unlockCount} ready for adviser approval` : "Nothing to lock"}
              />
            </TooltipContent>
          </Tooltip>
          <div role="dialog" aria-label="Lock grades" aria-hidden={openKey === "lock" ? undefined : true} className={panel("lock")}>
            <KanbanBoard
              title="Lock grades"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <Lock size={14} />
                </span>
              }
              description={`Lock ${unlockCount} unlocked final${unlockCount === 1 ? "" : "s"} for adviser approval.`}
              className="border-0"
            >
              <div className="flex justify-end px-1 pb-1">
                <LockGradesButton
                  assignmentId={assignmentId}
                  subjectLabel={subjectLabel}
                  termLabel={termLabel}
                  unlockCount={unlockCount}
                  className="h-6 px-3 text-xs"
                />
              </div>
            </KanbanBoard>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
