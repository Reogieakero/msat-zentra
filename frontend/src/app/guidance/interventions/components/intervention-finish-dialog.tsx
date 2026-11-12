"use client";
import * as React from "react";
import {
  Calendar as CalendarIcon,
  CalendarClock,
  ClipboardCheck,
  Info,
  ListChecks,
  Loader2,
  MapPin,
  NotebookPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ClinicDatePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import type { FinishSessionFields } from "@/components/session-booking/FinishSessionDialog";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import {
  findOverlappingBooking,
  formatClockLabel,
  sessionConflictNote,
} from "@/lib/sessions/conflicts";
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
      const clash = findOverlappingBooking(followTime, taken);
      if (clash) {
        setError(sessionConflictNote(clash));
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
    <KanbanOverlay
      open
      onClose={() => {
        if (!isActionPending) {
          setError(null);
          onClose();
        }
      }}
      dismissable={!isActionPending}
      width="lg"
      busy={isActionPending}
      elevated={false}
      title="Mark session done"
      icon={
        <span className="text-primary" aria-hidden>
          <ClipboardCheck size={14} />
        </span>
      }
      description="Record what happened, and book another talk if one is needed."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {bookFollowUp && followUpComplete ? (
              <span className="font-medium text-foreground">{statusLine}</span>
            ) : (
              statusLine
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onClose}
              disabled={isActionPending}
              className="h-6 px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!canSave}
              aria-busy={isActionPending || undefined}
              className="h-6 px-3 text-xs"
            >
              {isActionPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {isActionPending ? "Marking done…" : bookFollowUp ? "Mark done & book" : "Mark done"}
            </Button>
          </div>
        </div>
      }
    >
      <div aria-busy={isActionPending || undefined} className="flex flex-col gap-3 px-1 pb-1">
        {notStarted ? (
          <p className="px-1 text-xs italic text-red-600 dark:text-red-400" role="alert">
            This session hasn&apos;t started yet — you can mark it done once the scheduled time arrives.
          </p>
        ) : null}

        <KanbanBoard
          title="Session notes (required)"
          icon={
            <span className="text-primary" aria-hidden>
              <NotebookPen size={14} />
            </span>
          }
        >
          <div className="px-1">
            <Textarea
              id="iv-done-notes"
              ref={notesRef}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened? What was discussed…"
              aria-label="Session notes (required)"
              maxLength={5000}
              className="resize-none"
            />
          </div>
        </KanbanBoard>

        <KanbanBoard
          title="Outcome (optional)"
          icon={
            <span className="text-primary" aria-hidden>
              <ListChecks size={14} />
            </span>
          }
        >
          <div className="px-1">
            <Textarea
              id="iv-done-outcome"
              rows={2}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Result or next step…"
              aria-label="Outcome (optional)"
              maxLength={2000}
              className="resize-none"
            />
          </div>
        </KanbanBoard>

        <KanbanBoard
          title="Follow-up session (optional)"
          description="If this needs another talk, book it now so it stays on the plan."
          icon={
            <span className="text-primary" aria-hidden>
              <CalendarClock size={14} />
            </span>
          }
        >
          <div className="flex flex-col gap-3 px-1">
            <div className="flex items-center justify-between gap-3">
              <span id="iv-done-followup-title" className="text-[13px] font-medium">
                Book a follow-up session
              </span>
              <Switch
                checked={bookFollowUp}
                onCheckedChange={setBookFollowUp}
                aria-labelledby="iv-done-followup-title"
              />
            </div>

            {!bookFollowUp ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" aria-hidden />
                <p>If this is the last open session, the follow-up closes on its own.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <span id="iv-done-date-label" className="text-[13px] font-semibold">
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
                            "flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[10px] border border-border text-foreground",
                            selected &&
                              "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-[#0f1a33] dark:text-[#bfdbfe] dark:ring-blue-500"
                          )}
                        >
                          <span className="text-[11px] font-medium uppercase text-muted-foreground">
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
                        "flex h-[60px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-muted-foreground",
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
                    <span id="iv-done-time-label" className="text-[13px] font-semibold">
                      Follow-up time
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {taken.length > 0 ? "Crossed-out times overlap a booked session" : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-2" role="group" aria-labelledby="iv-done-time-label">
                    {TIME_SLOTS.map((slot) => {
                      const selected = followTime === slot.key;
                      const clash = findOverlappingBooking(slot.key, taken);
                      const isTaken = clash !== null;
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          aria-pressed={selected}
                          disabled={isTaken || isActionPending}
                          title={isTaken ? `Overlaps the ${formatClockLabel(clash)} session` : slot.label}
                          onClick={() => setFollowTime(slot.key)}
                          className={cn(
                            "h-[38px] whitespace-nowrap rounded-[10px] border border-border px-1 text-[13px] font-medium text-foreground",
                            selected &&
                              "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-[#0f1a33] dark:text-[#bfdbfe] dark:ring-blue-500",
                            isTaken && "cursor-not-allowed text-muted-foreground line-through"
                          )}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span id="iv-done-kind-label" className="text-[13px] font-semibold">
                    Follow-up kind
                  </span>
                  <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-muted p-1" role="group" aria-labelledby="iv-done-kind-label">
                    {SESSION_KIND_OPTIONS.map((o) => {
                      const selected = followType === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setFollowType(o.value)}
                          className={cn(
                            "h-9 truncate rounded-[9px] px-1 text-[13px] font-medium text-muted-foreground",
                            selected && "bg-card font-semibold text-foreground shadow"
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
                  <div className="mt-1.5 flex items-center gap-2 rounded-[10px] border border-border px-3 transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/25">
                    <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <Input
                      id="iv-done-venue"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="Guidance office"
                      maxLength={200}
                      className="border-0 bg-transparent px-0 focus-visible:border-transparent focus-visible:ring-0"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Held at the guidance office unless another venue is given.
                  </p>
                </div>
              </div>
            )}
          </div>
        </KanbanBoard>

        {error ? (
          <p role="alert" className="px-1 text-xs italic text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </KanbanOverlay>
  );
}
