"use client";

import * as React from "react";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardModal } from "@/components/ui/CardModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./BookSessionDialog.module.css";

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
  badgeText?: string;
  badgeVariant?: "red" | "amber" | "outline";
}

const INVITE_ROLE_LABELS: Record<string, string> = {
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adviser: "Adviser",
};

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

function nowTimeKey(): string {
  const n = new Date();
  return `${String(n.getUTCHours()).padStart(2, "0")}:${String(n.getUTCMinutes()).padStart(2, "0")}`;
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

  inviteStaff?: InviteStaffOption[];
  initialInviteIds?: string[];
  inviteHint?: string;

  sectionAdviserId?: string | null;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
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
  inviteStaff,
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
  const isToday = date === today;
  const nowKey = nowTimeKey();
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

  const showInvites = inviteStaff !== undefined;
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
  const effectiveTime = timeIsCustom ? customTime : time;
  const selectedSlot = TIME_SLOTS.find((s) => s.key === time);
  const kindLabel =
    sessionTypeOptions.find((o) => o.value === sessionType)?.label ?? sessionType;

  function pickDay(key: string) {
    setDate(key);
    setUseCustomDate(false);
    setError(null);
    setTaken([]);
    setTakenLoading(true);
  }

  function pickTime(key: string) {
    setTime(key);
    setCustomTime("");
    setError(null);
  }

  function slotDisabled(slot: TimeSlot): string | null {
    if (taken.includes(slot.key)) return "Already taken";
    if (isToday && slot.key <= nowKey) return "Already passed";
    return null;
  }

  function goToInvites() {
    const scheduledAt = toScheduledAt(date, effectiveTime);
    if (!scheduledAt) {
      setError("Pick both a date and a time for the session.");
      return;
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Session must be set in the future.");
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
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Session must be set in the future.");
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
        ? `${formatSummaryDate(date)} · ${effectiveTime}`
        : "Pick a date and time";

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
                    {studentCard.sub ? (
                      <span className={styles.studentSub}>{studentCard.sub}</span>
                    ) : null}
                  </span>
                  {studentCard.badgeText ? (
                    <Badge variant={studentCard.badgeVariant ?? "outline"}>
                      {studentCard.badgeText}
                    </Badge>
                  ) : null}
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
                    const selected = date === d.key;
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
                      onChange={(v) => {
                        setDate(v);
                        setError(null);
                        setTaken([]);
                        setTakenLoading(true);
                      }}
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
                      onChange={(v) => {
                        setTime(v);
                        setCustomTime("");
                        setError(null);
                      }}
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
