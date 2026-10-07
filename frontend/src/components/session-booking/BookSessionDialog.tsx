"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardModal } from "@/components/ui/CardModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDropdown } from "@/app/guidance/referrals/components/form-dropdown";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./BookSessionDialog.module.css";

export interface BookSessionFields {
  scheduledAt: string;
  sessionType: string;
  venue: string;
  /** Invited staff user ids — present only when the invite picker is shown. */
  inviteeIds?: string[];
}

/* One invitable staff member for the meeting-invite picker. */
export interface InviteStaffOption {
  id: string;
  fullName: string;
  role: string;
}

const INVITE_ROLE_LABELS: Record<string, string> = {
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adviser: "Adviser",
};

function inviteRoleLabel(role: string): string {
  return INVITE_ROLE_LABELS[role] ?? role.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

interface BookSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: BookSessionFields) => void;
  /** "Book a clinic session for Maria." */
  description: string;
  /** Shown under the venue field, e.g. where the session is held. */
  venueHint?: string;
  /** Label for the free-text venue box — defaults to "Venue (optional)".
      The ADM coordinator reuses it as the logbook-ref field. */
  venueLabel?: string;
  venuePlaceholder?: string;
  /** Counseling desks pick a kind; the clinic desk books one-on-one only. */
  showSessionType?: boolean;
  /** Label for the kind dropdown — defaults to "Session kind". The ADM
      coordinator reuses it as the venue picker ("Venue"). */
  sessionTypeLabel?: string;
  sessionTypeOptions?: { value: string; label: string }[];
  defaultSessionType?: string;
  /** One-active-session rule: set when a session is already booked. */
  hasActiveSession?: boolean;
  activeSessionMessage?: string;
  busy?: boolean;
  /** Save failure from the caller's API call (shown under validation errors). */
  serverError?: string | null;
  submitLabel?: string;
  busyLabel?: string;
  title?: string;
  initialDate?: string;
  initialTime?: string;
  initialVenue?: string;
  initialSessionType?: string;
  idPrefix?: string;
  /** Invite picker (ADM coordinator parent meetings only) — omitted everywhere
      else, so the nurse/guidance dialogs render exactly as before. */
  inviteStaff?: InviteStaffOption[];
  initialInviteIds?: string[];
  inviteHint?: string;
  /** The case's section adviser: grouped under Adviser even when their login
      role is subject_teacher. Omitted everywhere else. */
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

/**
 * Shared book-session modal — the same dialog on the nurse clinic desk, the
 * guidance desks, and the ADM coordinator referrals desk. Date + time
 * pickers, optional venue, and an optional session-kind dropdown, with the
 * future-date and one-active-session guards built in. The caller performs
 * the save.
 */
export function BookSessionDialog({
  open,
  onClose,
  onSubmit,
  description,
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
  const [venue, setVenue] = React.useState(initialVenue);
  const [sessionType, setSessionType] = React.useState(
    initialSessionType ?? defaultSessionType,
  );
  const [invites, setInvites] = React.useState<string[]>(initialInviteIds);
  const [error, setError] = React.useState<string | null>(null);
  // Stepper (invite picker present only): step 1 captures schedule +
  // details, step 2 picks attendees — one short screen at a time so the
  // modal never overflows the viewport. Always restarts at step 1 on open.
  const [step, setStep] = React.useState(1);

  // Fresh form every time the modal opens — synced during render, never
  // in an effect. Reschedule opens prefill from the booked meeting.
  const inviteKey = [...initialInviteIds].sort().join(",");
  const openKey = open
    ? `${defaultSessionType}|${initialDate}|${initialTime}|${initialVenue}|${initialSessionType ?? ""}|${inviteKey}`
    : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setDate(initialDate);
    setTime(initialTime);
    setVenue(initialVenue);
    setSessionType(initialSessionType ?? defaultSessionType);
    setInvites(initialInviteIds);
    setError(null);
    setStep(1);
  }

  const showInvites = inviteStaff !== undefined;
  const inviteGroups = React.useMemo(() => {
    if (!inviteStaff) return [];
    const order = ["guidance_counselor", "nurse", "adviser"];
    const groups = new Map<string, InviteStaffOption[]>();
    for (const s of inviteStaff) {
      // The section adviser belongs to the Adviser group by function, even
      // when their login role is subject_teacher.
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

  // Step 1 → 2 gate: schedule must be complete and future-dated before
  // attendees can be picked. The one-active-session and submit guards stay
  // on the final save.
  function goToInvites() {
    const scheduledAt = toScheduledAt(date, time);
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
    const scheduledAt = toScheduledAt(date, time);
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

  return (
    <CardModal
      open
      onClose={() => {
        // Locked while the booking is in flight — closes only on server
        // confirmation, never early.
        if (!busy) {
          onClose();
          setError(null);
        }
      }}
      dismissable={!busy}
      size="lg"
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
              <Card className={styles.card}>
                <span className={styles.glowClip} aria-hidden="true">
                  <span className={styles.cardGlow} />
                </span>
                <CardHeader>
                  <CardTitle className={styles.sectionTitle}>Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={styles.formGrid}>
                    <ClinicDatePicker
                      id={`${idPrefix}-date`}
                      label="Date"
                      value={date}
                      onChange={setDate}
                      min={todayKey()}
                    />
                    <ClinicTimePicker
                      id={`${idPrefix}-time`}
                      label="Time"
                      value={time}
                      onChange={setTime}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className={styles.card}>
                <span className={styles.glowClip} aria-hidden="true">
                  <span className={styles.cardGlow} />
                </span>
                <CardHeader>
                  <CardTitle className={styles.sectionTitle}>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={styles.formGrid}>
                    {showSessionType && sessionTypeOptions.length > 0 && (
                      <FormDropdown
                        id={`${idPrefix}-type`}
                        label={sessionTypeLabel}
                        value={sessionType}
                        onChange={setSessionType}
                        placeholder="Pick a kind"
                        options={sessionTypeOptions}
                      />
                    )}
                    <div className={styles.formFull}>
                      <Label htmlFor={`${idPrefix}-venue`}>{venueLabel}</Label>
                      <Input
                        id={`${idPrefix}-venue`}
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        placeholder={venuePlaceholder}
                        maxLength={200}
                      />
                      {venueHint ? <p className={styles.hint}>{venueHint}</p> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
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
        <div className={styles.modalActions}>
          {isStepped && step === 2 ? (
            <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
              Back
            </Button>
          ) : (
            <Button
              variant="destructive"
              className={styles.btnRed}
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
    </CardModal>
  );
}
