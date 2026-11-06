"use client";
import * as React from "react";
import { Calendar as CalendarIcon, CheckCircle2, Info, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ClinicDatePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import type { FinishSessionFields } from "@/components/session-booking/FinishSessionDialog";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import { fetchDaySchedule } from "@/services/guidance/sessions.service";
import type { CounselingSessionItem } from "@/services/guidance/interventions.types";
import {
  TIME_SLOTS,
  formatChipSummary,
  nextDayChips,
  todayKey,
  toScheduledAt,
} from "./session-slot-helpers";

export function InterventionFinishDialog({
  open,
  onClose,
  activeSession,
  now,
  isActionPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeSession: CounselingSessionItem | null;
  now: number;
  isActionPending: boolean;
  onSubmit: (fields: FinishSessionFields) => void;
}) {
  const [notes, setNotes] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [bookFollowUp, setBookFollowUp] = React.useState(false);
  const [followDate, setFollowDate] = React.useState("");
  const [useCustomDate, setUseCustomDate] = React.useState(false);
  const [followTime, setFollowTime] = React.useState("");
  const [followType, setFollowType] = React.useState("individual");
  const [venue, setVenue] = React.useState("");
  const [taken, setTaken] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const notesRef = React.useRef<HTMLTextAreaElement | null>(null);

  const openKey = open ? (activeSession?.id ?? "new") : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setNotes("");
    setOutcome("");
    setBookFollowUp(false);
    setFollowDate("");
    setUseCustomDate(false);
    setFollowTime("");
    setFollowType("individual");
    setVenue("");
    setTaken([]);
    setError(null);
  }

  const notStarted =
    !!activeSession &&
    activeSession.status === "scheduled" &&
    new Date(activeSession.scheduledAt).getTime() > now;

  React.useEffect(() => {
    if (!open || !followDate) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchDaySchedule(followDate, { signal: controller.signal })
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
  }, [open, followDate]);

  if (!open) return null;

  const notesOk = notes.trim() !== "";
  const followUpComplete = followDate !== "" && followTime !== "";
  const canSave = !isActionPending && !notStarted && notesOk && (!bookFollowUp || followUpComplete);

  const slotLabel = TIME_SLOTS.find((s) => s.key === followTime)?.label ?? followTime;
  const statusLine = !notesOk
    ? "Add session notes to continue"
    : bookFollowUp && !followUpComplete
      ? "Pick a date and time for the follow-up"
      : bookFollowUp
        ? `Follow-up: ${formatChipSummary(followDate)} · ${slotLabel}`
        : "No follow-up will be booked";

  const dayChips = nextDayChips(3);
  const customSelected = useCustomDate && followDate !== "" && !dayChips.some((d) => d.key === followDate);

  function pickDay(key: string) {
    setFollowDate((prev) => (prev === key ? "" : key));
    setUseCustomDate(false);
    setFollowTime("");
    setTaken([]);
    setError(null);
  }

  function save() {
    if (notStarted) {
      setError("This session hasn't started yet — you can mark it done once the scheduled time arrives.");
      return;
    }
    if (!notesOk) {
      setError("Write what happened in the session first.");
      return;
    }
    let followUpSession: FinishSessionFields["followUpSession"];
    if (bookFollowUp) {
      const scheduledAt = toScheduledAt(followDate, followTime);
      if (!scheduledAt) {
        setError("Pick both a date and a time for the follow-up.");
        return;
      }
      followUpSession = {
        scheduledAt,
        sessionType: followType,
        ...(venue.trim() ? { venue: venue.trim() } : {}),
      };
    }
    setError(null);
    onSubmit({
      sessionNotes: notes.trim(),
      ...(outcome.trim() ? { outcome: outcome.trim() } : {}),
      ...(followUpSession ? { followUpSession } : {}),
    });
  }

  return (
    <CardModal
      open
      onClose={() => {
        if (!isActionPending) {
          setError(null);
          onClose();
        }
      }}
      dismissable={!isActionPending}
      size="md"
      initialFocusRef={notesRef}
      title={
        <span className="flex items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          Mark session done
        </span>
      }
      description="Record what happened, and book another talk if one is needed."
      watchKey={`${bookFollowUp}-${followDate}-${followTime}`}
    >
      <div aria-busy={isActionPending || undefined} className="flex flex-col gap-5">
        {notStarted ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="alert">
            This session hasn&apos;t started yet — you can mark it done once the scheduled time arrives.
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="iv-done-notes">Session notes</Label>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">
              Required
            </span>
          </div>
          <Textarea
            id="iv-done-notes"
            ref={notesRef}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What happened? What was discussed…"
            maxLength={5000}
            className="mt-1.5 resize-none rounded-[10px] text-sm leading-5 focus-visible:border-blue-400 focus-visible:ring-blue-400/25"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="iv-done-outcome">Outcome</Label>
            <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Optional</span>
          </div>
          <Textarea
            id="iv-done-outcome"
            rows={2}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Result or next step…"
            maxLength={2000}
            className="mt-1.5 resize-none rounded-[10px] text-sm leading-5 focus-visible:border-blue-400 focus-visible:ring-blue-400/25"
          />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-slate-200 dark:border-[#2f2f35]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <h3 id="iv-done-followup-title" className="text-sm font-semibold leading-5 text-slate-900 dark:text-[#f4f4f5]">
                Book a follow-up session
              </h3>
              <p className="mt-0.5 text-[13px] leading-[18px] text-slate-500 dark:text-[#a1a1aa]">
                If this needs another talk, book it now so it stays on the plan.
              </p>
            </div>
            <Switch
              checked={bookFollowUp}
              onCheckedChange={setBookFollowUp}
              aria-labelledby="iv-done-followup-title"
              className="h-[26px]! w-[44px]! [&_[data-slot=switch-thumb]]:size-[22px]! data-checked:[&_[data-slot=switch-thumb]]:translate-x-[20px]"
            />
          </div>

          {!bookFollowUp ? (
            <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <Info className="size-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
              <p className="text-[13px] leading-[18px] text-slate-500 dark:text-[#a1a1aa]">
                If this is the last open session, the follow-up closes on its own.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-4 dark:border-white/10">
              <div>
                <span id="iv-done-date-label" className="text-[13px] font-semibold text-slate-900 dark:text-[#f4f4f5]">
                  Follow-up date
                </span>
                <div className="mt-1.5 grid grid-cols-4 gap-2" role="group" aria-labelledby="iv-done-date-label">
                  {dayChips.map((d) => {
                    const selected = followDate === d.key;
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
                      {customSelected && followDate ? formatChipSummary(followDate) : "Other date"}
                    </span>
                  </button>
                </div>
                {useCustomDate && (
                  <div className="mt-2">
                    <ClinicDatePicker
                      id="iv-done-follow-date"
                      label="Custom date"
                      value={followDate}
                      onChange={(v) => {
                        setFollowDate(v);
                        setFollowTime("");
                        setTaken([]);
                        setError(null);
                      }}
                      min={todayKey()}
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span id="iv-done-time-label" className="text-[13px] font-semibold text-slate-900 dark:text-[#f4f4f5]">
                    Follow-up time
                  </span>
                  <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
                    {taken.length > 0 ? "Crossed-out times are already taken" : ""}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-2" role="group" aria-labelledby="iv-done-time-label">
                  {TIME_SLOTS.map((slot) => {
                    const selected = followTime === slot.key;
                    const isTaken = taken.includes(slot.key);
                    return (
                      <button
                        key={slot.key}
                        type="button"
                        aria-pressed={selected}
                        disabled={isTaken || isActionPending}
                        title={isTaken ? "Already taken" : slot.label}
                        onClick={() => setFollowTime(slot.key)}
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
                <span id="iv-done-kind-label" className="text-[13px] font-semibold text-slate-900 dark:text-[#f4f4f5]">
                  Follow-up kind
                </span>
                <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="group" aria-labelledby="iv-done-kind-label">
                  {SESSION_KIND_OPTIONS.map((o) => {
                    const selected = followType === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setFollowType(o.value)}
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
                <Label htmlFor="iv-done-venue">Venue (optional)</Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-[10px] border border-slate-200 px-3 transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/25 dark:border-[#2f2f35]">
                  <MapPin className="size-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                  <Input
                    id="iv-done-venue"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
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

        {error ? (
          <p role="alert" className="-mt-2 text-[13px] leading-5 text-red-700 dark:text-[#fca5a5]">
            {error}
          </p>
        ) : null}

        <div className="-mx-5 -mb-5 flex items-center gap-4 border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <p className="min-w-0 flex-1 truncate text-[13px] text-slate-500 dark:text-[#a1a1aa]">
            {bookFollowUp && followUpComplete ? (
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
            onClick={save}
            disabled={!canSave}
            aria-busy={isActionPending || undefined}
            className="h-8 shrink-0 rounded-[8px] bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
          >
            {isActionPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isActionPending ? "Marking done…" : bookFollowUp ? "Mark done & book" : "Mark done"}
          </Button>
        </div>
      </div>
    </CardModal>
  );
}
