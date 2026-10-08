"use client";
import { Check, Clock, Info, Pencil, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { CatalogCards } from "./CatalogCards";
import { CopiedSlotCard, type CopiedSlot } from "./CopiedSlotCard";
import type { ScheduleSubject } from "../page";
import type { CatalogTeacher } from "./use-schedule-catalog";
interface Props {
  railOpen: boolean;
  hasSubmitted: boolean;
  reviewNote: string | null;
  hasDraft: boolean;
  entriesLength: number;
  sectionName: string;
  copied: CopiedSlot | null;
  onClearCopied: () => void;
  onReadMessage: () => void;
  subjects: ScheduleSubject[];
  teachers: CatalogTeacher[];
  subjectsPending: boolean;
  subjectsError: boolean;
  teachersPending: boolean;
  teachersError: boolean;
}
export function ScheduleRail({
  railOpen,
  hasSubmitted,
  reviewNote,
  hasDraft,
  entriesLength,
  sectionName,
  copied,
  onClearCopied,
  onReadMessage,
  subjects,
  teachers,
  subjectsPending,
  subjectsError,
  teachersPending,
  teachersError,
}: Props) {
  void sectionName;
  const variant = hasSubmitted
    ? "blue"
    : reviewNote
      ? "amber"
      : hasDraft
        ? "red"
        : entriesLength > 0
          ? "green"
          : null;
  if (!variant && !copied) {
    return (
      <div
        className={`flex w-[17rem] max-w-[17rem] flex-col gap-4 transition-all duration-300 ease-out motion-reduce:transition-none ${
          railOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
        }`}
      >
        <CatalogCards
          layout="rail"
          subjects={subjects}
          teachers={teachers}
          subjectsPending={subjectsPending}
          subjectsError={subjectsError}
          teachersPending={teachersPending}
          teachersError={teachersError}
        />
        <div className={assign.card} aria-label="Slot status legend">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
              aria-hidden="true"
            >
              <Info size={20} className="text-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Legend</h3>
              <p className="text-xs text-muted-foreground">
                What each slot dot means.
              </p>
            </div>
          </div>
          <div className="relative flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
              Draft — only you see it
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
              Returned — sent back by principal
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
              Submitted — awaiting principal
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
              Approved — official
            </span>
          </div>
        </div>
      </div>
    );
  }
  const meta = variant
    ? {
        blue: {
          title: "Submitted",
          message: "Awaiting principal approval.",
          from: "#3b82f6",
          to: "#2563d1",
          chip: "bg-blue-500/15",
          icon: "text-blue-500",
          Icon: Clock,
        },
        amber: {
          title: "Returned",
          message: "Sent back for revision — rework the amber slots.",
          from: "#f59e0b",
          to: "#d9770f",
          chip: "bg-amber-500/15",
          icon: "text-amber-500",
          Icon: Undo2,
        },
        red: {
          title: "Draft",
          message: "Not official until approved.",
          from: "#ef4444",
          to: "#dc2626",
          chip: "bg-red-500/15",
          icon: "text-red-500",
          Icon: Pencil,
        },
        green: {
          title: "Approved",
          message: "Official schedule.",
          from: "#22c55e",
          to: "#16a34a",
          chip: "bg-green-500/15",
          icon: "text-green-500",
          Icon: Check,
        },
      }[variant]
    : null;
  const Icon = meta?.Icon ?? Info;
  return (
    <div
      className={`flex w-[17rem] max-w-[17rem] flex-col gap-4 transition-all duration-300 ease-out motion-reduce:transition-none ${
        railOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
      }`}
    >
      {meta ? (
        <div
          className={assign.card}
          role="status"
          aria-label={`Schedule status: ${meta.title} — ${meta.message}`}
          style={{
            borderColor: `color-mix(in oklch, ${meta.from} 45%, transparent)`,
            background: `linear-gradient(135deg, color-mix(in oklch, ${meta.from} 26%, var(--card)), color-mix(in oklch, ${meta.to} 18%, var(--card)))`,
          }}
        >
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.chip}`}
              aria-hidden="true"
            >
              <Icon size={20} className={meta.icon} />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">{meta.title}</h3>
              <p className="text-xs text-muted-foreground">{meta.message}</p>
            </div>
          </div>
          {variant === "amber" && reviewNote ? (
            <div className="relative">
              <Button
                variant="link"
                size="sm"
                onClick={onReadMessage}
                aria-haspopup="dialog"
                className="h-auto p-0 text-xs"
              >
                Read message
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <CatalogCards
        layout="rail"
        subjects={subjects}
        teachers={teachers}
        subjectsPending={subjectsPending}
        subjectsError={subjectsError}
        teachersPending={teachersPending}
        teachersError={teachersError}
      />
      {copied ? (
        <CopiedSlotCard copied={copied} onClear={onClearCopied} />
      ) : null}
      <div className={assign.card} aria-label="Slot status legend">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <Info size={20} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">Legend</h3>
            <p className="text-xs text-muted-foreground">
              What each slot dot means.
            </p>
          </div>
        </div>
        <div className="relative flex flex-col gap-1.5 text-sm">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
            Draft — only you see it
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
            Returned — sent back by principal
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
            Submitted — awaiting principal
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
            Approved — official
          </span>
        </div>
      </div>
    </div>
  );
}
