"use client";
import * as React from "react";
import {
  Calendar as CalendarIcon,
  Flag,
  MapPin,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ClinicDatePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import { fetchDaySchedule } from "@/services/guidance/sessions.service";
import { Busy } from "./busy";
import {
  TIME_SLOTS,
  formatChipSummary,
  nextDayChips,
  todayKey,
} from "./session-slot-helpers";

const QUICK_ADD = ["Weekly one-on-one", "Call parents about attendance"];

const URGENCY = [
  { value: "low", label: "Low", dot: "bg-green-500" },
  { value: "normal", label: "Normal", dot: "bg-blue-500" },
  { value: "high", label: "High", dot: "bg-red-500" },
];

function initialsOf(name: string | null): string {
  if (!name) return "–";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  const first = parts[0].charAt(0).toUpperCase();
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : "";
  return `${first}${last}`;
}

export function InterventionStartDialog({
  open,
  onClose,
  activeStudent,
  actionText,
  onActionText,
  priority,
  onPriority,
  intakeNotes,
  onIntakeNotes,
  sessDate,
  onSessDate,
  sessTime,
  onSessTime,
  sessType,
  onSessType,
  sessVenue,
  onSessVenue,
  bookFirst,
  onBookFirst,
  isActionPending,
  onSubmit,
  canSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeStudent: string | null;
  actionText: string;
  onActionText: (v: string) => void;
  priority: string;
  onPriority: (v: string) => void;
  intakeNotes: string;
  onIntakeNotes: (v: string) => void;
  sessDate: string;
  onSessDate: (v: string) => void;
  sessTime: string;
  onSessTime: (v: string) => void;
  sessType: string;
  onSessType: (v: string) => void;
  sessVenue: string;
  onSessVenue: (v: string) => void;
  bookFirst: boolean;
  onBookFirst: (v: boolean) => void;
  isActionPending: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  const [taken, setTaken] = React.useState<string[]>([]);
  const [useCustomDate, setUseCustomDate] = React.useState(false);
  const planRef = React.useRef<HTMLTextAreaElement | null>(null);

  const openKey = open ? (activeStudent ?? "new") : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setTaken([]);
    setUseCustomDate(false);
  }

  React.useEffect(() => {
    if (!open || !sessDate) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchDaySchedule(sessDate, { signal: controller.signal })
      .then((rows) => {
        if (!cancelled) setTaken(rows);
      })
      .catch(() => {
        if (!cancelled) setTaken([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, sessDate]);

  if (!open) return null;

  const planOk = actionText.trim() !== "";
  const sessionComplete = sessDate !== "" && sessTime !== "";
  const slotLabel = TIME_SLOTS.find((s) => s.key === sessTime)?.label ?? sessTime;
  const statusLine = !planOk
    ? "Describe what you will do to continue"
    : bookFirst && !sessionComplete
      ? "Pick a date and time for the first session"
      : bookFirst
        ? `First session: ${formatChipSummary(sessDate)} · ${slotLabel}`
        : "No session will be booked yet";

  const dayChips = nextDayChips(3);
  const customSelected =
    useCustomDate && sessDate !== "" && !dayChips.some((d) => d.key === sessDate);

  function pickDay(key: string) {
    onSessDate(sessDate === key ? "" : key);
    setUseCustomDate(false);
    onSessTime("");
    setTaken([]);
  }

  function quickAdd(text: string) {
    const current = actionText.trim();
    onActionText(current === "" ? text : `${actionText.trimEnd()}; ${text}`);
    planRef.current?.focus();
  }

  return (
    <CardModal
      open
      onClose={() => {
        if (!isActionPending) onClose();
      }}
      dismissable={!isActionPending}
      size="md"
      initialFocusRef={planRef}
      title={
        <span className="flex items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <Flag className="size-5" aria-hidden />
          </span>
          Start a follow-up
        </span>
      }
      description={
        <span className="flex items-center gap-1.5 text-sm">
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
          >
            {initialsOf(activeStudent)}
          </span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {activeStudent ?? "Student"}
          </span>
          <span aria-hidden>·</span>
          <span>Assigned to you</span>
        </span>
      }
      watchKey={`${bookFirst}-${sessDate}-${sessTime}-${actionText.length}`}
      footer={
        <>
          <p className="min-w-0 flex-1 truncate text-[13px] text-slate-500 dark:text-[#a1a1aa]">
            {bookFirst && sessionComplete ? (
              <span className="font-medium text-slate-900 dark:text-[#f4f4f5]">{statusLine}</span>
            ) : (
              statusLine
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isActionPending}
            className="h-8 shrink-0 rounded-[8px] px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            aria-busy={isActionPending || undefined}
            className="h-8 shrink-0 rounded-[8px] bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
          >
            <Busy busy={isActionPending} />
            {isActionPending ? "Starting…" : "Start follow-up"}
          </Button>
        </>
      }
    >
      <div aria-busy={isActionPending || undefined} className="flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="startAction">What will you do?</Label>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">
              Required
            </span>
          </div>
          <Textarea
            id="startAction"
            ref={planRef}
            rows={3}
            value={actionText}
            onChange={(e) => onActionText(e.target.value)}
            placeholder="e.g. Weekly one-on-one every Friday, call parents about attendance…"
            maxLength={2000}
            className="mt-1.5 resize-none rounded-[10px] text-sm leading-5 focus-visible:border-blue-400 focus-visible:ring-blue-400/25"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Quick add</span>
            {QUICK_ADD.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => quickAdd(q)}
                className="flex h-[26px] items-center gap-1 rounded-full border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:border-slate-400 dark:border-[#46464e] dark:text-slate-300 dark:hover:border-slate-500"
              >
                <Plus className="size-3" aria-hidden />
                {q}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span id="startPriority-label" className="text-sm font-medium text-slate-900 dark:text-[#f4f4f5]">
            How urgent is this?
          </span>
          <div
            className="mt-1.5 grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5"
            role="group"
            aria-labelledby="startPriority-label"
          >
            {URGENCY.map((o) => {
              const selected = priority === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPriority(o.value)}
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-1 text-[13px] font-medium text-slate-500 dark:text-[#a1a1aa]",
                    selected &&
                      "bg-white font-semibold text-slate-900 shadow dark:bg-[#3a3a41] dark:text-[#f4f4f5]"
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", o.dot)} aria-hidden />
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="startIntake">First impressions</Label>
            <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Optional</span>
          </div>
          <Textarea
            id="startIntake"
            rows={2}
            value={intakeNotes}
            onChange={(e) => onIntakeNotes(e.target.value)}
            placeholder="What stands out? Anything the next reader should know…"
            maxLength={2000}
            className="mt-1.5 resize-none rounded-[10px] text-sm leading-5 focus-visible:border-blue-400 focus-visible:ring-blue-400/25"
          />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-slate-200 dark:border-[#2f2f35]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <h3 id="start-book-title" className="text-sm font-semibold leading-5 text-slate-900 dark:text-[#f4f4f5]">
                Book the first session
              </h3>
              <p className="mt-0.5 text-[13px] leading-[18px] text-slate-500 dark:text-[#a1a1aa]">
                Optional — you can also book it later.
              </p>
            </div>
            <Switch
              checked={bookFirst}
              onCheckedChange={onBookFirst}
              aria-labelledby="start-book-title"
              className="h-[26px]! w-[44px]! [&_[data-slot=switch-thumb]]:size-[22px]! data-checked:[&_[data-slot=switch-thumb]]:translate-x-[20px]"
            />
          </div>

          {bookFirst && (
            <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-4 dark:border-white/10">
              <div>
                <span id="start-date-label" className="text-[13px] font-semibold text-slate-900 dark:text-[#f4f4f5]">
                  Date
                </span>
                <div className="mt-1.5 grid grid-cols-4 gap-2" role="group" aria-labelledby="start-date-label">
                  {dayChips.map((d) => {
                    const selected = sessDate === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => pickDay(d.key)}
                        className={cn(
                          "flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[10px] border border-slate-200 text-slate-900 dark:border-[#2f2f35] dark:text-[#f4f4f5]",
                          selected &&
                            "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-[#0f1a33] dark:text-[#bfdbfe] dark:ring-blue-500"
                        )}
                      >
                        <span className="text-[11px] font-medium uppercase text-slate-500 dark:text-[#a1a1aa]">
                          {d.dow}
                        </span>
                        <span className="text-[13px] font-semibold">{d.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={customSelected}
                    onClick={() => setUseCustomDate((v) => !v)}
                    className={cn(
                      "flex h-[60px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-slate-300 text-slate-500 dark:border-[#46464e] dark:text-[#a1a1aa]",
                      customSelected &&
                        "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-[#0f1a33] dark:text-[#bfdbfe] dark:ring-blue-500"
                    )}
                  >
                    <CalendarIcon className="size-4" aria-hidden />
                    <span className="px-1 text-[11px] font-medium leading-tight">
                      {customSelected && sessDate ? formatChipSummary(sessDate) : "Other date"}
                    </span>
                  </button>
                </div>
                {useCustomDate && (
                  <div className="mt-2">
                    <ClinicDatePicker
                      id="startSessDate"
                      label="Custom date"
                      value={sessDate}
                      onChange={(v) => {
                        onSessDate(v);
                        onSessTime("");
                        setTaken([]);
                      }}
                      min={todayKey()}
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span id="start-time-label" className="text-[13px] font-semibold text-slate-900 dark:text-[#f4f4f5]">
                    Time
                  </span>
                  <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
                    {taken.length > 0 ? "Crossed-out times are already taken" : ""}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-2" role="group" aria-labelledby="start-time-label">
                  {TIME_SLOTS.map((slot) => {
                    const selected = sessTime === slot.key;
                    const isTaken = taken.includes(slot.key);
                    return (
                      <button
                        key={slot.key}
                        type="button"
                        aria-pressed={selected}
                        disabled={isTaken || isActionPending}
                        title={isTaken ? "Already taken" : slot.label}
                        onClick={() => onSessTime(slot.key)}
                        className={cn(
                          "h-[38px] whitespace-nowrap rounded-[10px] border border-slate-200 px-1 text-[13px] font-medium text-slate-900 dark:border-[#2f2f35] dark:text-[#f4f4f5]",
                          selected &&
                            "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-[#0f1a33] dark:text-[#bfdbfe] dark:ring-blue-500",
                          isTaken && "cursor-not-allowed text-slate-400 line-through dark:text-slate-600"
                        )}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span id="start-kind-label" className="text-[13px] font-semibold text-slate-900 dark:text-[#f4f4f5]">
                  Session kind
                </span>
                <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="group" aria-labelledby="start-kind-label">
                  {SESSION_KIND_OPTIONS.map((o) => {
                    const selected = sessType === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSessType(o.value)}
                        className={cn(
                          "h-9 truncate rounded-[9px] px-1 text-[13px] font-medium text-slate-500 dark:text-[#a1a1aa]",
                          selected &&
                            "bg-white font-semibold text-slate-900 shadow dark:bg-[#3a3a41] dark:text-[#f4f4f5]"
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="startSessVenue">Venue (optional)</Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-[10px] border border-slate-200 px-3 transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/25 dark:border-[#2f2f35]">
                  <MapPin className="size-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                  <Input
                    id="startSessVenue"
                    value={sessVenue}
                    onChange={(e) => onSessVenue(e.target.value)}
                    placeholder="Guidance office"
                    maxLength={200}
                    className="border-0 bg-transparent px-0 focus-visible:border-transparent focus-visible:ring-0"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-[#a1a1aa]">
                  Held at the guidance office unless another venue is given.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </CardModal>
  );
}
