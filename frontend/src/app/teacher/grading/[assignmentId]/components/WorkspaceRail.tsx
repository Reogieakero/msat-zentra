"use client";

import * as React from "react";
import { ChevronRight, FileText, Pencil, Plus } from "lucide-react";
import { gradeLabel } from "@/services/teacher/grading.compute";
import type {
  ClassAssignment,
  ClassComponent,
} from "@/services/teacher/grading.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

/* Donut of the WW / PT / E shares (0–100 scale). */
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

export type WorkspaceView = "scores" | "finals";

type Props = {
  assignment: ClassAssignment;
  studentCount: number;
  assignmentId: string;
  components: ClassComponent[];
  onOpenWeights: () => void;
  onAddAssessment: () => void;
};

export function WorkspaceRail({
  assignment,
  studentCount,
  assignmentId,
  components,
  onOpenWeights,
  onAddAssessment,
}: Props) {
  const weightOf = (type: string) => components.find((c) => c.type === type)?.weight ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-4" aria-label="Class tools">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-black p-5 text-white shadow-xl">
        <span
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-white/70">
            ZENTRA GRADEBOOK
          </span>
          <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-white uppercase">
            {assignment.subjectCategory === "ELECTIVE" ? "Elective" : "Core"}
          </span>
        </div>
        <p className="relative mt-3 text-lg font-semibold tracking-wide">
          {assignment.subjectName}
        </p>
        <p className="relative text-sm font-medium tracking-[0.3em] text-white/80">
          {assignment.subjectCode}
        </p>
        <div className="relative mt-4 flex items-end justify-between gap-2 text-[11px] tracking-wider text-white/70 uppercase">
          <span className="min-w-0">
            <span className="block text-white/50">Section</span>
            <span className="block truncate font-semibold text-white">
              {assignment.sectionName} · Grade {gradeLabel(assignment.gradeLevel)}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-white/50">Term {assignment.termNumber}</span>
            <span className="block font-semibold text-white tabular-nums">
              {studentCount} student{studentCount === 1 ? "" : "s"}
            </span>
          </span>
        </div>
      </div>

      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center justify-between gap-2">
          <h2 className="font-semibold">Subject weights</h2>
          <button
            type="button"
            onClick={onOpenWeights}
            aria-label="Edit subject weights"
            title="Edit weights"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="relative">
          <WeightsDonut
            ww={weightOf("WRITTEN_WORK")}
            pt={weightOf("PERFORMANCE_TASK")}
            exam={weightOf("EXAM")}
          />
        </div>
        <div className="relative flex flex-col gap-1.5 text-sm" aria-label="Weight legend">
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
      </div>

      <button
        type="button"
        className={assign.card}
        onClick={onAddAssessment}
        aria-label="Add assessment"
      >
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <span className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <Plus size={20} className="text-primary" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block font-semibold">Add assessment</span>
            <span className="block text-xs text-muted-foreground">
              New quiz, activity, or exam
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </span>
      </button>

      <a
        href={`/record/${assignmentId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={assign.card}
        aria-label="Open class record in a new tab"
      >
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <span className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <FileText size={20} className="text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Class record</span>
            <span className="block text-xs text-muted-foreground">
              Printable sheet — opens in a new tab
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </span>
      </a>
    </div>
  );
}
