"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanBoardHeader } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { cn, formatGrade, formatSection } from "@/lib/utils";
import type { RegistryDesk } from "@/services/registry/overview.service";
import dialogStyles from "./FinalGradeSetDialog.module.css";

export interface GradeSetSubject {
  id: string;
  subject: string;
  code: string;
  teacher: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: string;
  status: "approved";
}

export interface GradeSetStudent {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: string;
  section: string;
  term: string;
  overall: number;
  mascot: string | null;
  subjects: GradeSetSubject[];
  status: "approved";
}

const MILESTONES = [25, 50, 75, 100];

/** Amber chip matching the final-grades row's subject/grade/section pills. */
function AmberPill({
  label,
  title,
  className,
}: {
  label: string;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title ?? label}
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold leading-tight text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        className
      )}
    >
      {label}
    </span>
  );
}

/* Traffic-light tones for risk pills: green safe / amber moderate / red high. */
const RISK_TONE: Record<"Low" | "Moderate" | "High", string> = {
  Low: "border-green-500/40 bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  Moderate:
    "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  High: "border-red-500/40 bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400",
};

/** Rectangle status pill (not a "·"-joined badge) for risk segments. */
function RiskPill({
  level,
  icon,
  children,
  title,
}: {
  level: "Low" | "Moderate" | "High";
  icon?: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight ${RISK_TONE[level]}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Remarks pill — red for Failed, green for Passed. */
function RemarkPill({ remarks }: { remarks: string }) {
  const failed = remarks === "Failed";
  return (
    <span
      title={`Remarks: ${remarks}`}
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight ${failed ? RISK_TONE.High : RISK_TONE.Low}`}
    >
      {remarks}
    </span>
  );
}

/**
 * Read-only grade set detail as a kanban board — one column per lens
 * (overall + completion, the student, the subjects in the set). Opened
 * from the registry final-grades row eye button on both desks
 * (record keeper / registrar); no dedicated route.
 */
export function FinalGradeSetDialog({
  desk,
  student,
  onClose,
}: {
  desk: RegistryDesk;
  student: GradeSetStudent | null;
  onClose: () => void;
}) {
  const deskLabel = desk === "registrar" ? "Registrar" : "Record keeper";
  const open = student !== null;
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [showFullAbout, setShowFullAbout] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted || !student) return null;

  const codes = [...new Set(student.subjects.map((sub) => sub.code))];
  const failedCount = student.subjects.filter((sub) => sub.remarks === "Failed").length;
  const riskLevel = student.overall < 75 ? "High" : failedCount > 0 ? "Moderate" : "Low";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150 dark:bg-black/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="final-grade-set-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] animate-in fade-in-0 zoom-in-95 duration-150 dark:bg-background"
      >
        <div className="-mx-2.5 flex min-w-0 items-start gap-1.5 border-b border-border px-3.5 pb-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2 id="final-grade-set-title" className="truncate text-[13px] font-semibold">
              Final grade set
            </h2>
            {/* Name + LRN as separate pills (12px) — no "·" separator. */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className="inline-flex max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium leading-tight text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                title={student.name}
              >
                {student.name}
              </span>
              <span
                className="inline-flex max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium leading-tight text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                title={student.lrn}
              >
                {student.lrn}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-6 w-6 shrink-0 px-0"
            onClick={onClose}
            aria-label="Close grade set"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
          </Button>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 px-1">
          <Badge variant="green" className="rounded-md px-2 py-0.5 text-[10px] font-semibold">
            Complete
          </Badge>
          {codes.map((code) => (
            <AmberPill key={code} label={code} title={`Subject code: ${code}`} />
          ))}
          <AmberPill label={formatGrade(student.gradeLevel)} />
          <AmberPill label={formatSection(student.section)} />
          <AmberPill label={student.term} />
        </div>

        <div className="grid min-w-0 items-start gap-2.5 lg:grid-cols-3">
          {/* Overall + completion */}
          <section
            aria-label="Overall"
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-background p-2.5 dark:bg-card/40"
          >
            <KanbanBoardHeader
              icon={<GraduationCap size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden />}
              title="Overall"
            />
            <div className="flex min-w-0 flex-col items-center gap-2.5 rounded-lg border border-border bg-card py-5 text-center shadow-sm">
              <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {student.overall}
              </span>
              <span className="text-xs font-medium text-muted-foreground">Overall Average</span>
              <Badge variant="green" className="rounded-md px-2.5 font-semibold">
                Complete
              </Badge>
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
              {/* Bar + milestone nodes share one track, so each number sits
                  exactly where its percentage lands on the line. The track is
                  inset by half a node (mx-3.5 = half of size-7) so the 100%
                  node stays inside the card. */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="relative mx-3.5 h-7"
                      tabIndex={0}
                      aria-label={`Overall average ${student.overall} of 100`}
                    >
                      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-primary/20">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(student.overall, 100)}%` }}
                        />
                      </div>
                      {MILESTONES.map((m) => (
                        <span
                          key={m}
                          style={{ left: `${m}%` }}
                          className={`absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border text-[11px] font-bold ${
                            student.overall >= m
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    <span className="font-medium">Overall average</span>
                    <span className="opacity-60">{student.overall} / 100</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="rounded-lg border border-border bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {failedCount === 0
                  ? `Great job! ${student.name}'s final grades are complete and all subjects are passing.`
                  : `${student.name} has ${failedCount} subject(s) below 75. Adviser follow-up may be needed.`}
              </p>
            </div>
          </section>

          {/* Student */}
          <section
            aria-label="Student"
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-background p-2.5 dark:bg-card/40"
          >
            <KanbanBoardHeader
              icon={<User size={14} className="text-blue-500" aria-hidden />}
              title="Student"
            />
            <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <StudentMascot
                  name={student.name}
                  seed={student.lrn}
                  character={student.mascot ?? undefined}
                  size={36}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-semibold text-foreground" title={student.name}>
                    {student.name}
                  </p>
                  <span
                    className="inline-flex w-fit max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium leading-tight text-secondary-foreground"
                    title={student.lrn}
                  >
                    {student.lrn}
                  </span>
                </div>
              </div>
              {riskLevel === "Low" ? (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <RiskPill level="Low" icon={<Check size={11} strokeWidth={2.4} aria-hidden />}>
                    Not at risk
                  </RiskPill>
                </div>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <RiskPill
                    level={riskLevel}
                    icon={<AlertTriangle size={11} aria-hidden />}
                    title={`Academic risk: ${riskLevel}`}
                  >
                    At risk
                  </RiskPill>
                  <RiskPill level={riskLevel} title={`Academic risk: ${riskLevel}`}>
                    {riskLevel}
                  </RiskPill>
                  <RiskPill
                    level={riskLevel}
                    title={`${failedCount} subject(s) below the passing grade of 75`}
                  >
                    {failedCount} below 75
                  </RiskPill>
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-2.5 shadow-sm">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                About this grade set
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {showFullAbout
                  ? `This is the complete final grade set for ${student.name} (${student.term}). All ${student.subjects.length} subject(s) have been locked by the subject teacher and approved by the class adviser. ${deskLabel} access is view-only — no further approval is required.`
                  : `This is the complete final grade set for ${student.name} (${student.term}). All ${student.subjects.length} subject(s) have been locked by the subject teacher and approved by the class adviser.`}
              </p>
              <button
                type="button"
                onClick={() => setShowFullAbout((v) => !v)}
                className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-foreground transition-colors hover:text-primary"
              >
                {showFullAbout ? "Show less" : "Show more"}
                <ChevronDown
                  className={`size-3.5 transition-transform ${showFullAbout ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>
          </section>

          {/* Subjects in the set */}
          <section
            aria-label="Subjects"
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-background p-2.5 dark:bg-card/40"
          >
            <KanbanBoardHeader
              icon={<BookOpen size={14} className="text-amber-600 dark:text-amber-400" aria-hidden />}
              title="Subjects"
              count={student.subjects.length}
            />
            {/* Shows three cards; taller sets scroll with a thin amber
                thumb that only appears while the list is hovered. */}
            <div className={`${dialogStyles.subjectsScroll} flex min-w-0 flex-col gap-2`}>
              {student.subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 shadow-sm"
                >
                  <div className="flex min-w-0 items-center justify-between gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground" title={sub.subject}>
                      {sub.subject}
                    </span>
                    <AmberPill label={sub.code} title={`Subject code: ${sub.code}`} />
                  </div>
                  <AmberPill label={sub.teacher} className="w-fit text-xs" />
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      Computed{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {sub.computedAverage}
                      </span>
                      <span className="px-1 text-border">·</span>
                      Transmuted{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {sub.transmutedGrade}
                      </span>
                    </span>
                    <RemarkPill remarks={sub.remarks} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="rounded-xl border border-border bg-background p-2.5 text-[11px] leading-relaxed text-muted-foreground dark:bg-card/40">
          All {student.subjects.length} subject(s) are locked and adviser-approved for{" "}
          {student.term}. {deskLabel} access is read-only — no further approval is required.{" "}
          {failedCount === 0
            ? "The student passed all subjects with a transmuted grade of 75 or above."
            : `${failedCount} subject(s) are below the passing grade of 75.`}
        </div>
      </div>
    </div>,
    document.body
  );
}
