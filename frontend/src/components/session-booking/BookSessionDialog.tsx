"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, CalendarPlus, ClipboardList, Clock, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardModal } from "@/components/ui/CardModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./BookSessionDialog.module.css";
import board from "./BookSessionDialog.board.module.css";

export interface BookSessionFields {
  scheduledAt: string;
  sessionType: string;
  venue: string;

  inviteeIds?: string[];
}

export interface InviteStaffOption {
  id: string;
  fullName: string;
  role: string;
}

export interface BookSessionStudentCard {
  name: string;
  sub?: string;
  /** Board variant: LRN and section rendered as separate pills (LRN first). */
  lrn?: string;
  /** Section name shown on the amber pill. */
  section?: string;
  /** Grade level shown as the section pill's tooltip label. */
  grade?: string;
  badgeText?: string;
  badgeVariant?: "red" | "amber" | "outline";
}

const INVITE_ROLE_LABELS: Record<string, string> = {
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adviser: "Adviser",
};

/* Primary action uses the shared Pill blue (translucent fill + blue text)
   so the CTA matches every blue pill on the desks. */
const PILL_BLUE_BUTTON =
  "bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30 font-semibold";

function inviteRoleLabel(role: string): string {
  return INVITE_ROLE_LABELS[role] ?? role.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  const first = parts[0].replace(/[^A-Za-z]/g, "").charAt(0) || parts[0].charAt(0);
  const last =
    parts.length > 1
      ? parts[parts.length - 1].replace(/[^A-Za-z]/g, "").charAt(0) || parts[parts.length - 1].charAt(0)
      : "";
  return `${first}${last}`.toUpperCase();
}

interface TimeSlot {
  key: string;
  label: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { key: "08:00", label: "8:00 AM" },
  { key: "09:00", label: "9:00 AM" },
  { key: "10:30", label: "10:30 AM" },
  { key: "11:00", label: "11:00 AM" },
  { key: "13:00", label: "1:00 PM" },
  { key: "14:00", label: "2:00 PM" },
  { key: "15:00", label: "3:00 PM" },
  { key: "16:00", label: "4:00 PM" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface DayCard {
  key: string;
  dow: string;
  label: string;
}

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date | null {
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Next `count` school days (skips Sundays), starting tomorrow. */
function nextDayCards(count: number, todayKey: string): DayCard[] {
  const out: DayCard[] = [];
  const cursor = parseDateKey(todayKey) ?? new Date();
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (out.length < count) {
    if (cursor.getUTCDay() !== 0) {
      out.push({
        key: toDateKey(cursor),
        dow: DAY_NAMES[cursor.getUTCDay()],
        label: `${MONTH_NAMES[cursor.getUTCMonth()]} ${cursor.getUTCDate()}`,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function formatSummaryDate(key: string): string {
  const d = parseDateKey(key);
  if (!d) return key;
  return `${DAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "13:05" → "1:05 PM" for the footer summary. */
function formatTimeKey(key: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(key);
  if (!match) return key;
  const h24 = Number(match[1]);
  return `${h24 % 12 || 12}:${match[2]} ${h24 < 12 ? "AM" : "PM"}`;
}


/**
 * True when `dateKey` + `HH:MM` is already behind us. The current minute still
 * counts as bookable ("today at this time" is allowed, the past is not).
 */
function isPastMoment(dateKey: string, time: string): boolean {
  if (!dateKey || !time) return false;
  const at = new Date(`${dateKey}T${time}:00`).getTime();
  if (!Number.isFinite(at)) return false;
  const nowMinute = Math.floor(Date.now() / 60_000) * 60_000;
  return at < nowMinute;
}

export interface BookSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: BookSessionFields) => void;

  description?: string;

  studentCard?: BookSessionStudentCard | null;

  /** Async lookup of taken `HH:MM` slots for a date key. Omit = no taken state. */
  fetchTakenTimes?: (dateKey: string, signal: AbortSignal) => Promise<string[]>;

  venueHint?: string;

  venueLabel?: string;
  venuePlaceholder?: string;

  showSessionType?: boolean;

  sessionTypeLabel?: string;
  sessionTypeOptions?: { value: string; label: string }[];
  defaultSessionType?: string;

  hasActiveSession?: boolean;
  activeSessionMessage?: string;
  busy?: boolean;

  serverError?: string | null;
  submitLabel?: string;
  busyLabel?: string;
  title?: string;
  initialDate?: string;
  initialTime?: string;
  initialVenue?: string;
  initialSessionType?: string;
  idPrefix?: string;

  /** "card" = shared centred modal (default). "board" = wide kanban overlay. */
  variant?: "card" | "board";

  inviteStaff?: InviteStaffOption[];
  /** True while the invitee list is still being fetched — renders a skeleton. */
  inviteStaffLoading?: boolean;
  initialInviteIds?: string[];
  inviteHint?: string;

  sectionAdviserId?: string | null;
}

function todayKey(): string {
  // Local calendar day — the booking values are written as local wall-clock
  // time, so "today" has to be local too or the past-time guard drifts.
  const n = new Date();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${n.getFullYear()}-${m}-${d}`;
}

/** Local current time as "HH:MM" — the floor for today's clock picker. */
function currentTimeKey(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function toScheduledAt(date: string, time: string): string | null {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}:00`);
  if (Number.isNaN(at.getTime())) return null;
  return `${date}T${time}:00`;
}

export function BookSessionDialog({
  open,
  onClose,
  onSubmit,
  description = "Schedule a counseling session",
  studentCard = null,
  fetchTakenTimes,
  venueHint,
  venueLabel = "Venue (optional)",
  venuePlaceholder = "e.g. School clinic",
  showSessionType = false,
  sessionTypeLabel = "Session kind",
  sessionTypeOptions = [],
  defaultSessionType = "individual",
  hasActiveSession = false,
  activeSessionMessage = "This case already has a session that is not done yet — finish or cancel it before booking another one.",
  busy = false,
  serverError = null,
  submitLabel = "Book session",
  busyLabel,
  title = "Book session",
  initialDate = "",
  initialTime = "",
  initialVenue = "",
  initialSessionType,
  idPrefix = "book-session",
  variant = "card",
  inviteStaff,
  inviteStaffLoading = false,
  initialInviteIds = [],
  inviteHint,
  sectionAdviserId = null,
}: BookSessionDialogProps) {
  const [date, setDate] = React.useState(initialDate);
  const [time, setTime] = React.useState(initialTime);
  const [customTime, setCustomTime] = React.useState("");
  const [useCustomDate, setUseCustomDate] = React.useState(false);
  const [venue, setVenue] = React.useState(initialVenue);
  const [sessionType, setSessionType] = React.useState(
    initialSessionType ?? defaultSessionType,
  );
  const [invites, setInvites] = React.useState<string[]>(initialInviteIds);
  const [error, setError] = React.useState<string | null>(null);
  const [taken, setTaken] = React.useState<string[]>([]);
  const [takenLoading, setTakenLoading] = React.useState(false);

  const [step, setStep] = React.useState(1);

  const boardMode = variant === "board";
  const [mounted, setMounted] = React.useState(false);  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Portal target only exists after mount (no document during prerender).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open || !boardMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, boardMode]);

  React.useEffect(() => {
    if (!open || !boardMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, boardMode, busy, onClose]);

  const inviteKey = [...initialInviteIds].sort().join(",");
  const openKey = open
    ? `${defaultSessionType}|${initialDate}|${initialTime}|${initialVenue}|${initialSessionType ?? ""}|${inviteKey}`
    : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setDate(initialDate);
    const slotMatch = TIME_SLOTS.some((s) => s.key === initialTime);
    setTime(slotMatch ? initialTime : "");
    setCustomTime(slotMatch ? "" : initialTime);
    setUseCustomDate(
      initialDate !== "" && !nextDayCards(3, todayKey()).some((d) => d.key === initialDate),
    );
    setVenue(initialVenue);
    setSessionType(initialSessionType ?? defaultSessionType);
    setInvites(initialInviteIds);
    setError(null);
    setTaken([]);
    setTakenLoading(!!fetchTakenTimes && !!initialDate);
    setStep(1);
  }

  const dayCards = nextDayCards(3, todayKey());
  const today = todayKey();
  const timeIsCustom = time !== "" && !TIME_SLOTS.some((s) => s.key === time);

  React.useEffect(() => {
    if (!open || !fetchTakenTimes || !date || !takenLoading) return;
    const controller = new AbortController();
    fetchTakenTimes(date, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setTaken(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTaken([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTakenLoading(false);
      });
    return () => controller.abort();
  }, [open, date, fetchTakenTimes, takenLoading]);

  const showInvites = inviteStaff !== undefined || inviteStaffLoading;
  const inviteGroups = React.useMemo(() => {
    if (!inviteStaff) return [];
    const order = ["guidance_counselor", "nurse", "adviser"];
    const groups = new Map<string, InviteStaffOption[]>();
    for (const s of inviteStaff) {

      const key = sectionAdviserId && s.id === sectionAdviserId ? "adviser" : s.role;
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    return [...groups.entries()].sort(
      ([a], [b]) => order.indexOf(a) - order.indexOf(b),
    );
  }, [inviteStaff, sectionAdviserId]);

  function toggleInvite(id: string) {
    setInvites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  if (!open) return null;

  const isStepped = showInvites;
  // Board mode always uses the clock picker's `time`; the card mode keeps the
  // quick slots plus its own custom-time field.
  const effectiveTime = boardMode ? time : timeIsCustom ? customTime : time;
  const selectedSlot = TIME_SLOTS.find((s) => s.key === time);
  const kindLabel =
    sessionTypeOptions.find((o) => o.value === sessionType)?.label ?? sessionType;

  function pickDay(key: string) {
    setDate(key);
    setUseCustomDate(false);
    setError(null);
    setTaken([]);
    setTakenLoading(true);
    // Switching to today can strand a time that has already passed.
    if (key === todayKey() && isPastMoment(key, timeIsCustom ? customTime : time)) {
      setTime("");
      setCustomTime("");
    }
  }

  function pickTime(key: string) {
    setTime(key);
    setCustomTime("");
    setError(null);
  }

  function pickCustomDate(value: string) {
    setDate(value);
    setError(null);
    setTaken([]);
    setTakenLoading(true);
    if (value === todayKey() && isPastMoment(value, timeIsCustom ? customTime : time)) {
      setTime("");
      setCustomTime("");
    }
  }

  function pickCustomTime(value: string) {
    setError(null);
    if (isPastMoment(date, value)) {
      // Never hold a past time in the form — the footer error explains why.
      setTime("");
      setCustomTime("");
      setError("Pick the current time or a later date and time.");
      return;
    }
    setTime(value);
    setCustomTime("");
  }

  /** Clock picker used by the board — mirrors the other desk time pickers. */
  function pickClockTime(value: string) {
    setError(null);
    if (taken.includes(value)) {
      setTime("");
      setError("That time is already booked. Pick another time.");
      return;
    }
    if (isPastMoment(date, value)) {
      setTime("");
      setError("Pick the current time or a later date and time.");
      return;
    }
    setTime(value);
    setCustomTime("");
  }

  function slotDisabled(slot: TimeSlot): string | null {
    if (taken.includes(slot.key)) return "Already taken";
    if (isPastMoment(date, slot.key)) return "Already passed";
    return null;
  }

  function goToInvites() {
    const scheduledAt = toScheduledAt(date, effectiveTime);
    if (!scheduledAt) {
      setError("Pick both a date and a time for the session.");
      return;
    }
    if (isPastMoment(date, effectiveTime)) {
      setError("Pick the current time or a later date and time.");
      return;
    }
    if (taken.includes(effectiveTime)) {
      setError("That time is already booked. Pick another time.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function save() {
    const scheduledAt = toScheduledAt(date, effectiveTime);
    if (!scheduledAt) {
      setError("Pick both a date and a time for the session.");
      return;
    }
    if (isPastMoment(date, effectiveTime)) {
      setError("Pick the current time or a later date and time.");
      return;
    }
    if (taken.includes(effectiveTime)) {
      setError("That time is already booked. Pick another time.");
      return;
    }
    if (hasActiveSession) {
      setError(activeSessionMessage);
      return;
    }
    setError(null);
    onSubmit({
      scheduledAt,
      sessionType,
      venue: venue.trim(),
      ...(showInvites ? { inviteeIds: invites } : {}),
    });
  }

  const summaryDateTime =
    date && effectiveTime && selectedSlot
      ? `${formatSummaryDate(date)} · ${selectedSlot.label}`
      : date && effectiveTime
        ? `${formatSummaryDate(date)} · ${formatTimeKey(effectiveTime)}`
        : "Pick a date and time";

  if (boardMode) {
    if (!mounted) return null;
    return createPortal(
      <div
        className={board.overlay}
        onMouseDown={(e) => {
          if (!busy && e.target === e.currentTarget) {
            onClose();
            setError(null);
          }
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          tabIndex={-1}
          aria-busy={busy || undefined}
          className={board.shell}
        >
          <div className={board.header}>
            <span className={board.headIcon} aria-hidden="true">
              <CalendarDays />
            </span>
            <div className={board.headText}>
              <h2 className={board.title}>{title}</h2>
              {description ? (
                <p className={board.description}>{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              className={board.close}
              onClick={() => {
                if (!busy) {
                  onClose();
                  setError(null);
                }
              }}
              disabled={busy}
              aria-label="Close dialog"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className={board.scroll}>
            {studentCard ? (
              <div className={board.caseStrip}>
                <StudentMascot
                  name={studentCard.name}
                  seed={studentCard.lrn ?? studentCard.name}
                  size={36}
                />
                <div className={board.caseText}>
                  <span className={board.caseName}>{studentCard.name}</span>
                  <div className={board.casePills}>
                    {studentCard.lrn ? <Pill label="LRN">{studentCard.lrn}</Pill> : null}
                    {(studentCard.section ?? studentCard.grade) ? (
                      <Pill
                        label={studentCard.grade ?? "Section"}
                        tone="amber"
                      >
                        {studentCard.section ?? studentCard.grade}
                      </Pill>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className={board.lanes}>
              <section className={board.lane} aria-label="Schedule">
                <div className={board.laneHead}>
                  <span className={board.laneTitle}>
                    <CalendarDays
                      className={`${board.laneIcon} ${board.iconSchedule}`}
                      aria-hidden="true"
                    />
                    Schedule
                  </span>
                </div>
                <div className={board.laneCards}>
                  <div className={styles.field}>
                    <span
                      id={`${idPrefix}-board-date-label`}
                      className={styles.fieldLabel}
                    >
                      Date
                    </span>
                    <div
                      className={board.dayStack}
                      role="group"
                      aria-labelledby={`${idPrefix}-board-date-label`}
                    >
                      {dayCards.map((d) => {
                        const selected = !useCustomDate && date === d.key;
                        return (
                          <button
                            key={d.key}
                            type="button"
                            className={`${styles.dayCard}${selected ? ` ${styles.daySelected} ${board.chipSelected}` : ""}`}
                            aria-pressed={selected}
                            onClick={() => pickDay(d.key)}
                          >
                            <span className={styles.dayDow}>{d.dow}</span>
                            <span className={styles.dayLabel}>{d.label}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={`${styles.dayCard}${useCustomDate ? ` ${styles.daySelected} ${board.chipSelected}` : ""}`}
                        aria-pressed={useCustomDate}
                        onClick={() => setUseCustomDate(true)}
                      >
                        <CalendarDays className={styles.dayIcon} aria-hidden="true" />
                        <span className={styles.dayLabel}>Other date</span>
                      </button>
                    </div>
                    {useCustomDate ? (
                      <div className={styles.customDate}>
                        <ClinicDatePicker
                          id={`${idPrefix}-board-date`}
                          label="Custom date"
                          value={date}
                          onChange={pickCustomDate}
                          min={today}
                          popoverClassName="z-[70]"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className={board.lane} aria-label="Time">
                <div className={board.laneHead}>
                  <span className={board.laneTitle}>
                    <Clock
                      className={`${board.laneIcon} ${board.iconTime}`}
                      aria-hidden="true"
                    />
                    Time
                  </span>
                  <span className={board.laneHint}>
                    {takenLoading
                      ? "Checking…"
                      : taken.length > 0
                        ? "Booked times can't be reused"
                        : ""}
                  </span>
                </div>
                <div className={board.laneCards}>
                  <div className={styles.field}>
                    <ClinicTimePicker
                      id={`${idPrefix}-board-time`}
                      label="Time"
                      value={time}
                      onChange={pickClockTime}
                      popoverClassName="z-[70]"
                      minTime={date === today ? currentTimeKey() : undefined}
                    />
                  </div>
                </div>
              </section>

              <section className={board.lane} aria-label="Details">
                <div className={board.laneHead}>
                  <span className={board.laneTitle}>
                    <ClipboardList
                      className={`${board.laneIcon} ${board.iconDetails}`}
                      aria-hidden="true"
                    />
                    Details
                  </span>
                </div>
                <div className={board.laneCards}>
                  {showSessionType && sessionTypeOptions.length > 0 ? (
                    <div className={styles.field}>
                      <span
                        id={`${idPrefix}-board-type-label`}
                        className={styles.fieldLabel}
                      >
                        {sessionTypeLabel}
                      </span>
                      <div
                        className={`${styles.kindTrack} ${board.typeTabs}`}
                        role="group"
                        aria-labelledby={`${idPrefix}-board-type-label`}
                      >
                        {sessionTypeOptions.map((o) => {
                          const selected = sessionType === o.value;
                          return (
                            <button
                              key={o.value}
                              type="button"
                              className={`${styles.kindBtn} ${board.typeTab}${selected ? ` ${board.typeTabSelected}` : ""}`}
                              aria-pressed={selected}
                              onClick={() => {
                                setSessionType(o.value);
                                setError(null);
                              }}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.field}>
                    <Label htmlFor={`${idPrefix}-board-venue`}>{venueLabel}</Label>
                    <div className={styles.venueWrap}>
                      <MapPin className={styles.venueIcon} aria-hidden="true" />
                      <Input
                        id={`${idPrefix}-board-venue`}
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        placeholder={venuePlaceholder}
                        maxLength={200}
                        className={styles.venueInput}
                      />
                    </div>
                    {venueHint ? <p className={styles.hint}>{venueHint}</p> : null}
                  </div>

                  {showInvites ? (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>
                        Invite staff
                        {invites.length > 0 ? ` · ${invites.length} invited` : ""}
                      </span>
                      {inviteStaffLoading ? (
                        <div
                          className={styles.inviteGroup}
                          aria-busy="true"
                          aria-label="Loading invitable staff"
                        >
                          <span className="block h-3 w-28 animate-pulse rounded bg-muted" />
                          <div className={`${board.invitePills} pt-1`}>
                            <span className="block h-7 w-28 animate-pulse rounded-md bg-muted" />
                            <span className="block h-7 w-32 animate-pulse rounded-md bg-muted" />
                          </div>
                        </div>
                      ) : (
                        <>
                          {inviteHint ? <p className={styles.hint}>{inviteHint}</p> : null}
                          {inviteStaff!.length === 0 ? (
                            <p className={styles.hint}>No invitable staff right now.</p>
                          ) : (
                            inviteGroups.map(([role, members]) => (
                              <div key={role} className={styles.inviteGroup}>
                                <p className={styles.inviteGroupLabel}>
                                  {inviteRoleLabel(role)}
                                </p>
                                <div
                                  className={board.invitePills}
                                  role="group"
                                  aria-label="Invite staff"
                                >
                                  {members.map((s) => {
                                    const checked = invites.includes(s.id);
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        className={`${board.invitePill}${checked ? ` ${board.invitePillSelected}` : ""}`}
                                        aria-pressed={checked}
                                        onClick={() => toggleInvite(s.id)}
                                        title={s.fullName}
                                      >
                                        {s.fullName}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>

          {error || serverError ? (
            <div className={board.errorWrap}>
              <div className={styles.errorBlock} role="alert">
                <p className={styles.errorText}>{error ?? serverError}</p>
              </div>
            </div>
          ) : null}

          <div className={board.footer}>
            <div className={styles.summary}>
              <div className={board.summaryPills}>
                {date ? (
                  <span className={board.summaryPill}>{formatSummaryDate(date)}</span>
                ) : null}
                {effectiveTime ? (
                  <span className={board.summaryPill}>
                    {selectedSlot?.label ?? formatTimeKey(effectiveTime)}
                  </span>
                ) : null}
                {!date && !effectiveTime ? (
                  <span className={board.summaryEmpty}>Pick a date and time</span>
                ) : null}
              </div>
              <div className={board.summaryPills}>
                {showSessionType ? <Pill label="Session kind">{kindLabel}</Pill> : null}
                <Pill label="Venue">{venue.trim() || "No venue set"}</Pill>
              </div>
            </div>
            <div className={board.actions}>
              <Button
                onClick={save}
                disabled={busy}
                aria-busy={busy || undefined}
                className={board.footerBtn}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <CalendarPlus className="size-3.5" aria-hidden />
                )}
                {busy ? (busyLabel ?? "Booking…") : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <CardModal
      open
      onClose={() => {

        if (!busy) {
          onClose();
          setError(null);
        }
      }}
      dismissable={!busy}
      size="md"
      title={title}
      description={description}
      watchKey={step}
    >
        <div aria-busy={busy || undefined}>
        {isStepped ? (
          <div className={styles.steps} role="list" aria-label="Booking progress">
            <span
              role="listitem"
              aria-current={step === 1 ? "step" : undefined}
              className={step === 1 ? styles.stepActive : styles.step}
            >
              1 · Schedule
            </span>
            <span className={styles.stepGap} aria-hidden="true">
              →
            </span>
            <span
              role="listitem"
              aria-current={step === 2 ? "step" : undefined}
              className={step === 2 ? styles.stepActive : styles.step}
            >
              2 · Invite staff
            </span>
          </div>
        ) : null}
        <div className={styles.sections}>
          {!isStepped || step === 1 ? (
            <>
              {studentCard ? (
                <div className={styles.studentCard}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initialsOf(studentCard.name)}
                  </span>
                  <span className={styles.studentText}>
                    <span className={styles.studentName}>{studentCard.name}</span>
                    <span className={styles.studentPills}>
                      {studentCard.lrn ? <Pill label="LRN">{studentCard.lrn}</Pill> : null}
                      {studentCard.grade ? (
                        <Pill label="Section" tone="amber">
                          {studentCard.grade}
                        </Pill>
                      ) : null}
                      {!studentCard.lrn && !studentCard.grade && studentCard.sub ? (
                        <Pill label="Section">{studentCard.sub}</Pill>
                      ) : null}
                      {studentCard.badgeText ? (
                        <Pill
                          label="Risk level"
                          tone={studentCard.badgeVariant === "red" ? "red" : "amber"}
                        >
                          {studentCard.badgeText}
                        </Pill>
                      ) : null}
                    </span>
                  </span>
                </div>
              ) : null}

              <div className={styles.field}>
                <span id={`${idPrefix}-date-label`} className={styles.fieldLabel}>
                  Date
                </span>
                <div
                  className={styles.dayGrid}
                  role="group"
                  aria-labelledby={`${idPrefix}-date-label`}
                >
                  {dayCards.map((d) => {
                    const selected = !useCustomDate && date === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        className={`${styles.dayCard}${selected ? ` ${styles.daySelected}` : ""}`}
                        aria-pressed={selected}
                        onClick={() => pickDay(d.key)}
                      >
                        <span className={styles.dayDow}>{d.dow}</span>
                        <span className={styles.dayLabel}>{d.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`${styles.dayCard}${useCustomDate ? ` ${styles.daySelected}` : ""}`}
                    aria-pressed={useCustomDate}
                    onClick={() => setUseCustomDate(true)}
                  >
                    <CalendarDays className={styles.dayIcon} aria-hidden="true" />
                    <span className={styles.dayLabel}>Other date</span>
                  </button>
                </div>
                {useCustomDate ? (
                  <div className={styles.customDate}>
                    <ClinicDatePicker
                      id={`${idPrefix}-date`}
                      label="Custom date"
                      value={date}
                      onChange={pickCustomDate}
                      min={today}
                    />
                  </div>
                ) : null}
              </div>

              <div className={styles.field}>
                <div className={styles.fieldRow}>
                  <span id={`${idPrefix}-time-label`} className={styles.fieldLabel}>
                    Time
                  </span>
                  <span className={styles.fieldHint}>
                    {takenLoading
                      ? "Checking availability…"
                      : taken.length > 0
                        ? "Crossed-out times are already taken"
                        : null}
                  </span>
                </div>
                <div
                  className={styles.timeGrid}
                  role="group"
                  aria-labelledby={`${idPrefix}-time-label`}
                >
                  {TIME_SLOTS.map((slot) => {
                    const selected = time === slot.key && !timeIsCustom;
                    const reason = slotDisabled(slot);
                    return (
                      <button
                        key={slot.key}
                        type="button"
                        className={`${styles.timePill}${selected ? ` ${styles.timeSelected}` : ""}${reason ? ` ${styles.timeTaken}` : ""}`}
                        aria-pressed={selected}
                        disabled={reason !== null || busy}
                        title={reason ?? slot.label}
                        onClick={() => pickTime(slot.key)}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
                {timeIsCustom || customTime !== "" ? (
                  <div className={styles.customDate}>
                    <ClinicTimePicker
                      id={`${idPrefix}-time`}
                      label="Custom time"
                      value={timeIsCustom ? time : customTime}
                      onChange={pickCustomTime}
                      minTime={date === today ? currentTimeKey() : undefined}
                    />
                  </div>
                ) : null}
              </div>

              {showSessionType && sessionTypeOptions.length > 0 && (
                <div className={styles.field}>
                  <span id={`${idPrefix}-type-label`} className={styles.fieldLabel}>
                    {sessionTypeLabel}
                  </span>
                  <div
                    className={styles.kindTrack}
                    role="group"
                    aria-labelledby={`${idPrefix}-type-label`}
                  >
                    {sessionTypeOptions.map((o) => {
                      const selected = sessionType === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          className={`${styles.kindBtn}${selected ? ` ${styles.kindSelected}` : ""}`}
                          aria-pressed={selected}
                          onClick={() => {
                            setSessionType(o.value);
                            setError(null);
                          }}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <Label htmlFor={`${idPrefix}-venue`}>{venueLabel}</Label>
                <div className={styles.venueWrap}>
                  <MapPin className={styles.venueIcon} aria-hidden="true" />
                  <Input
                    id={`${idPrefix}-venue`}
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder={venuePlaceholder}
                    maxLength={200}
                    className={styles.venueInput}
                  />
                </div>
                {venueHint ? <p className={styles.hint}>{venueHint}</p> : null}
              </div>
            </>
          ) : null}
          {showInvites && (!isStepped || step === 2) ? (
            <Card className={styles.card}>
              <span className={styles.glowClip} aria-hidden="true">
                <span className={styles.cardGlow} />
              </span>
              <CardHeader>
                <CardTitle className={styles.sectionTitle}>
                  Invite staff{invites.length > 0 ? ` · ${invites.length} invited` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={styles.formGrid}>
                  <div className={styles.inviteGroup}>
                    {inviteStaffLoading ? (
                      <div
                        className={styles.inviteGroup}
                        aria-busy="true"
                        aria-label="Loading invitable staff"
                      >
                        <span className="block h-3 w-28 animate-pulse rounded bg-muted" />
                        <div className="flex flex-col gap-1.5 pt-1">
                          <span className="block h-8 w-full animate-pulse rounded-md bg-muted" />
                          <span className="block h-8 w-full animate-pulse rounded-md bg-muted" />
                        </div>
                      </div>
                    ) : (
                      <>
                        {inviteHint ? <p className={styles.hint}>{inviteHint}</p> : null}
                        {inviteStaff!.length === 0 ? (
                          <p className={styles.hint}>No invitable staff right now.</p>
                        ) : (
                          inviteGroups.map(([role, members]) => (
                            <div key={role} className={styles.inviteGroup}>
                              <p className={styles.inviteGroupLabel}>{inviteRoleLabel(role)}</p>
                              <div className={styles.inviteList}>
                                {members.map((s) => {
                                  const checked = invites.includes(s.id);
                                  return (
                                    <label key={s.id} className={styles.inviteRow}>
                                      <input
                                        type="checkbox"
                                        className={styles.inviteCheck}
                                        checked={checked}
                                        onChange={() => toggleInvite(s.id)}
                                        aria-label={`Invite ${s.fullName}`}
                                      />
                                      <span className={styles.inviteName} title={s.fullName}>
                                        {s.fullName}
                                      </span>
                                      <span className={styles.inviteRole}>
                                        {inviteRoleLabel(s.role)}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
        {error || serverError ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>{error ?? serverError}</p>
          </div>
        ) : null}
        <div className={styles.footer}>
          <div className={styles.summary}>
            <p className={styles.summaryMain}>{summaryDateTime}</p>
            <p className={styles.summarySub}>
              {showSessionType ? `${kindLabel} · ` : ""}
              {venue.trim() || "No venue set"}
            </p>
          </div>
          <div className={styles.modalActions}>
            {isStepped && step === 2 ? (
              <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
                Back
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </Button>
            )}
            {isStepped && step === 1 ? (
              <Button onClick={goToInvites}>Continue</Button>
            ) : (
              <Button
                onClick={save}
                disabled={busy}
                aria-busy={busy || undefined}
                className={PILL_BLUE_BUTTON}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {busy ? (busyLabel ?? "Booking…") : submitLabel}
              </Button>
            )}
          </div>
        </div>
        </div>
    </CardModal>
  );
}
