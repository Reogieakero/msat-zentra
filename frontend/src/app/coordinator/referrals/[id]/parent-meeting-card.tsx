"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardModal } from "@/components/ui/CardModal";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { apiErrorMessage } from "@/services/coordinator/utils";
import {
  attendeeLabel,
  formatManilaDate,
  formatManilaTime,
  generateLogbookRef,
  inviteeToAttendee,
  MEETING_ATTENDEE_ROLE_LABELS,
  meetingInviteeLabel,
  venueLabel,
} from "@/services/coordinator/labels";
import {
  uploadMeetingAttachments,
  deleteMeetingAttachment,
} from "@/services/coordinator/cases.service";
import type {
  AdmMeetingAttachment,
  AdmMeetingInvitee,
  MeetingAttendee,
  MeetingAttendeeRole,
} from "@/services/coordinator/coordinator.types";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./case-page.module.css";

export interface ParentMeetingItem {
  id: string;
  meetingDatetime: string;
  venue: string;
  attended: boolean;
  minutesOfMeeting: string | null;
  attendanceLogbookRef: string | null;
  attendees: MeetingAttendee[];
  invitees?: AdmMeetingInvitee[];
  attachments?: AdmMeetingAttachment[];
  recordedBy: string;
}

/* A meeting opens for attendance 15 min early and stays "live" for
   60 min after its start. Past that, an unrecorded meeting is overdue. */
const JOIN_EARLY_MS = 15 * 60_000;
const MEETING_LEN_MS = 60 * 60_000;

type Timing =
  | { state: "done" }
  | { state: "upcoming"; msUntil: number }
  | { state: "live" }
  | { state: "overdue"; msOverdue: number }
  | { state: "unknown" };

function timingOf(m: ParentMeetingItem, now: number): Timing {
  if (m.attended) return { state: "done" };
  const start = new Date(m.meetingDatetime).getTime();
  if (!Number.isFinite(start)) return { state: "unknown" };
  const msUntil = start - now;
  if (msUntil > JOIN_EARLY_MS) return { state: "upcoming", msUntil };
  if (now <= start + MEETING_LEN_MS) return { state: "live" };
  return { state: "overdue", msOverdue: now - (start + MEETING_LEN_MS) };
}

/* "2d 4h 12m 5s" / "12m 5s" / "45s" — days, hours, minutes, seconds.
   Seconds always show so the latest schedule reads as a live countdown. */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const mins = Math.floor((totalSeconds % 3_600) / 60);
  const secs = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

interface LocalImage {
  name: string;
  url: string;
  file: File | null;
}

export function ParentMeetingCard({
  meeting: m,
  now,
  isLatest,
  active,
  onChanged,
  onAttendedConfirmed,
}: {
  meeting: ParentMeetingItem;
  now: number;
  /** Only the latest schedule shows a countdown — older entries stay
      as plain history. */
  isLatest: boolean;
  /** Carousel visibility — inactive cards stay mounted (typed minutes
      and picked images are kept) but are hidden. */
  active: boolean;
  onChanged: () => void;
  /** Fired after an attendance save — the page slides in the
      certification sheet when the case is certifiable. */
  onAttendedConfirmed: () => void;
}) {
  // The latest schedule ticks every second so its countdown (incl.
  // seconds) stays live. Older entries reuse the page-level 30s clock.
  const ticking = isLatest && !m.attended;
  const [nowMs, setNowMs] = React.useState(now);
  // Resync the live clock when the meeting slot changes (render-phase
  // adjustment from the pure `now` prop — no impure calls during render,
  // no setState inside an effect body). The interval below advances the
  // clock every second and corrects any residual staleness within 1s.
  const [trackedSlot, setTrackedSlot] = React.useState(m.meetingDatetime);
  if (trackedSlot !== m.meetingDatetime) {
    setTrackedSlot(m.meetingDatetime);
    setNowMs(now);
  }
  React.useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking, m.meetingDatetime]);
  const timing = timingOf(m, ticking ? nowMs : now);
  // Logbook + minutes are recorded only once the meeting is ongoing:
  // live, or overdue when the outcome still needs logging. Upcoming
  // meetings never show the attendance question or its forms.
  const needsOutcome =
    !m.attended && (timing.state === "live" || timing.state === "overdue");
  const showCountdown =
    isLatest &&
    !m.attended &&
    (timing.state === "upcoming" ||
      timing.state === "live" ||
      timing.state === "overdue");
  // Booked logbook/minutes must not leak while the meeting is still
  // upcoming — the ADM can only attach files, minutes, and the log
  // once the meeting is live. Attended meetings always show theirs.
  const showOutcomeRecords =
    m.attended || timing.state === "live" || timing.state === "overdue";

  const [step, setStep] = React.useState<"idle" | "yes" | "rebook">("idle");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  // The logbook ref is system-generated (stable per meeting) — the
  // coordinator never types it. A previously saved ref is kept as-is.
  const [logbook, setLogbook] = React.useState(
    m.attendanceLogbookRef ?? generateLogbookRef(m.meetingDatetime, m.id),
  );
  const [minutes, setMinutes] = React.useState(m.minutesOfMeeting ?? "");
  const [attendees, setAttendees] = React.useState<MeetingAttendee[]>(() => [
    ...(m.attendees ?? []),
  ]);
  // Invitee attendance checklist: which invited staff actually attended.
  // Prefilled from previously recorded userId-linked entries.
  const [checkedInvitees, setCheckedInvitees] = React.useState<string[]>(() => {
    const recorded = new Set(
      (m.attendees ?? []).map((a) => a.userId).filter((v): v is string => !!v),
    );
    return (m.invitees ?? []).map((u) => u.id).filter((id) => recorded.has(id));
  });
  const [removingDocId, setRemovingDocId] = React.useState<string | null>(null);
  const [rebookDate, setRebookDate] = React.useState("");
  const [rebookTime, setRebookTime] = React.useState("");
  const [rebookLogbook, setRebookLogbook] = React.useState("");
  const [images, setImages] = React.useState<LocalImage[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-overlay the outcome dialog on every visit/reload while the
  // latest schedule still needs an outcome (live or overdue). Opens on
  // the false→true flip only, so closing it stays closed until the case
  // genuinely needs attention again.
  const needsAction =
    isLatest &&
    !m.attended &&
    (timing.state === "live" || timing.state === "overdue");
  const [wasNeedingOutcome, setWasNeedingOutcome] = React.useState(false);
  if (needsAction !== wasNeedingOutcome) {
    setWasNeedingOutcome(needsAction);
    if (needsAction && !dialogOpen) {
      setStep("idle");
      setError(null);
      setDialogOpen(true);
    }
  }

  // Revoke preview URLs when the card unmounts. The ref mirror is synced
  // inside an effect (never during render) so the unmount cleanup always
  // sees the latest list without reading a ref during render.
  const imagesRef = React.useRef<LocalImage[]>([]);
  React.useEffect(() => {
    imagesRef.current = images;
  });
  React.useEffect(
    () => () => {
      for (const img of imagesRef.current) URL.revokeObjectURL(img.url);
    },
    [],
  );

  function pickImages(files: FileList | null) {
    if (!files) return;
    const next: LocalImage[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      next.push({ name: f.name, url: URL.createObjectURL(f), file: f });
    }
    setImages((prev) => [...prev, ...next].slice(0, 10));
  }

  function removeImage(url: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.url === url);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.url !== url);
    });
  }

  function resetFlow() {
    setStep("idle");
    setLogbook(
      m.attendanceLogbookRef ?? generateLogbookRef(m.meetingDatetime, m.id),
    );
    setMinutes(m.minutesOfMeeting ?? "");
    const recorded = new Set(
      (m.attendees ?? []).map((a) => a.userId).filter((v): v is string => !!v),
    );
    setCheckedInvitees((m.invitees ?? []).map((u) => u.id).filter((id) => recorded.has(id)));
    setAttendees([...(m.attendees ?? [])]);
    setRebookDate("");
    setRebookTime("");
    setRebookLogbook("");
    setError(null);
  }

  // Back to the Yes/No question inside the open dialog (keeps it open).
  function backToAsk() {
    resetFlow();
  }

  function closeDialog() {
    resetFlow();
    setDialogOpen(false);
  }

  function openYesDialog() {
    setError(null);
    setStep("yes");
    setDialogOpen(true);
  }

  function openAskDialog() {
    setError(null);
    setStep("idle");
    setDialogOpen(true);
  }

  function addAttendee() {
    if (attendees.length >= 20) return;
    setAttendees((prev) => [
      ...prev,
      { name: "", role: "parent_guardian" as MeetingAttendeeRole },
    ]);
  }

  function updateAttendee(
    index: number,
    patch: Partial<MeetingAttendee>,
  ) {
    setAttendees((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );
  }

  function removeAttendee(index: number) {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPickedDocs(): Promise<{ uploaded: number; failed: boolean }> {
    const toUpload = images.map((i) => i.file).filter((f): f is File => !!f);
    if (toUpload.length === 0) return { uploaded: 0, failed: false };
    // One batched request for all files (same helper the case sheet uses) —
    // a failure leaves the picker untouched so retry never duplicates.
    try {
      await uploadMeetingAttachments(m.id, toUpload);
      const done = new Set(toUpload);
      setImages((prev) => prev.filter((i) => !done.has(i.file as File)));
      return { uploaded: toUpload.length, failed: false };
    } catch {
      return { uploaded: 0, failed: true };
    }
  }

  async function removeDoc(id: string) {
    if (removingDocId) return;
    setRemovingDocId(id);
    setError(null);
    try {
      await deleteMeetingAttachment(m.id, id);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRemovingDocId(null);
    }
  }

  async function saveOutcome(attended: boolean) {
    if (attended && (!minutes.trim() || !logbook.trim())) {
      setError("Log the minutes of meeting.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      // Drop unnamed rows; cap at the API's 20-entry limit. Free-text
      // entries carry no userId; invitee-linked entries are rebuilt from the
      // checklist below so unchecking removes them.
      const inviteesById = new Map((m.invitees ?? []).map((u) => [u.id, u]));
      const freeText = attendees
        .filter((a) => a.name.trim())
        .map((a) => ({ name: a.name.trim(), role: a.role }));
      const checked = attended
        ? checkedInvitees
            .map((id) => inviteesById.get(id))
            .filter((u): u is AdmMeetingInvitee => !!u)
            .map(inviteeToAttendee)
        : [];
      // Checked invitees win the 20-entry cap over free-text rows.
      const merged = [...checked, ...freeText].slice(0, 20);
      await apiClient.patch(`/api/adm/meetings/${m.id}`, {
        attended,
        ...(minutes.trim() ? { minutesOfMeeting: minutes.trim() } : {}),
        ...(logbook.trim() ? { attendanceLogbookRef: logbook.trim() } : {}),
        ...(attended ? { attendees: merged } : {}),
      });
      let docsFailed = false;
      let docsUploaded = 0;
      if (attended) {
        ({ uploaded: docsUploaded, failed: docsFailed } = await uploadPickedDocs());
      }
      if (attended) {
        if (docsFailed) {
          setError("Outcome saved, but some document images could not be uploaded — retry Attach below.");
        } else {
          closeDialog();
        }
        toast.success({
          title: "Attendance recorded",
          description:
            docsUploaded > 0 && !docsFailed
              ? `Minutes and logbook saved with ${docsUploaded} image${docsUploaded === 1 ? "" : "s"} attached.`
              : "Minutes and logbook saved — the case can move to certification.",
        });
        // Parents attended, so no home visitation is needed — let the page
        // slide the certification fill-up straight in when certifiable.
        onAttendedConfirmed();
      } else {
        toast.success({
          title: "Marked as not attended",
          description: "Rebook it as a home visitation below.",
        });
        setStep("rebook");
        setDialogOpen(true);
      }
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  // A no-show keeps its booked slot, so the backend blocks a second
  // booking (409) — move the same meeting to a home visitation instead.
  async function submitRebook() {
    if (!rebookDate || !rebookTime) {
      setError("Pick both a date and a time for the home visitation.");
      return;
    }
    const next = new Date(`${rebookDate}T${rebookTime}:00`);
    if (Number.isNaN(next.getTime()) || next.getTime() <= Date.now()) {
      setError("Pick a future date and time for the home visitation.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiClient.patch(`/api/adm/meetings/${m.id}/reschedule`, {
        meetingDatetime: next.toISOString(),
        venue: "home",
        ...(rebookLogbook.trim()
          ? { attendanceLogbookRef: rebookLogbook.trim() }
          : {}),
      });
      toast.success({
        title: "Home visitation booked",
        description: `Moved to ${formatManilaDate(next.toISOString())} at ${formatManilaTime(next.toISOString())}.`,
      });
      closeDialog();
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <li
      className={styles.evidenceItem}
      style={{
        alignItems: "flex-start",
        flexDirection: "column",
        display: active ? undefined : "none",
      }}
      aria-hidden={active ? undefined : true}
    >
      <div className={styles.badgeRow} style={{ marginTop: 0 }}>
        <Badge variant={m.venue === "home" ? "secondary" : "outline"}>
          {venueLabel(m.venue)}
        </Badge>
        <Badge variant={m.attended ? "success" : "outline"}>
          {m.attended ? "Attended" : "Booked"}
        </Badge>
        {showCountdown && timing.state === "upcoming" ? (
          <Badge variant="outline">
            Starts in {formatCountdown(timing.msUntil)}
          </Badge>
        ) : null}
        {timing.state === "live" ? (
          <Badge variant="success">Live now</Badge>
        ) : null}
        {showCountdown && timing.state === "overdue" ? (
          <Badge variant="destructive">
            Overdue by {formatCountdown(timing.msOverdue)}
          </Badge>
        ) : null}
      </div>

      <div className={styles.attendBtns} style={{ marginTop: "0.625rem" }}>
        <Button
          variant="outline"
          className={styles.logBtn}
          onClick={() => setLogOpen(true)}
        >
          See attendance log
        </Button>
      </div>

      <CardModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Attendance log"
        description="Full record of this parent meeting."
        size="md"
      >
        <div
          className={styles.modalBody}
          style={needsOutcome ? undefined : { marginBottom: 0 }}
        >
          <dl className={styles.kpiGrid} style={{ margin: 0 }}>
            <div className={styles.kpi}>
              <dt className={styles.metaLabel}>Date</dt>
              <dd className={styles.kpiValue} style={{ margin: 0 }}>
                {formatManilaDate(m.meetingDatetime)}
              </dd>
            </div>
            <div className={styles.kpi}>
              <dt className={styles.metaLabel}>Time</dt>
              <dd className={styles.kpiValue} style={{ margin: 0 }}>
                {formatManilaTime(m.meetingDatetime)}
              </dd>
            </div>
            <div className={styles.kpi}>
              <dt className={styles.metaLabel}>Venue</dt>
              <dd className={styles.kpiValue} style={{ margin: 0 }}>
                {venueLabel(m.venue)}
              </dd>
            </div>
            <div className={styles.kpi}>
              <dt className={styles.metaLabel}>Status</dt>
              <dd style={{ margin: 0 }}>
                {m.attended ? (
                  <Badge variant="success">Attended</Badge>
                ) : timing.state === "live" ? (
                  <Badge variant="success">Live now</Badge>
                ) : timing.state === "overdue" ? (
                  <Badge variant="destructive">Overdue</Badge>
                ) : timing.state === "upcoming" ? (
                  <Badge variant="outline">Upcoming</Badge>
                ) : (
                  <Badge variant="outline">Booked</Badge>
                )}
              </dd>
            </div>
            <div className={`${styles.kpi} ${styles.kpiFull}`}>
              <dt className={styles.metaLabel}>Booked by</dt>
              <dd className={styles.kpiValue} style={{ margin: 0 }}>
                {m.recordedBy}
              </dd>
            </div>
            {showOutcomeRecords && m.attendanceLogbookRef ? (
              <div className={`${styles.kpi} ${styles.kpiFull}`}>
                <dt className={styles.metaLabel}>Logbook ref</dt>
                <dd
                  className={`${styles.kpiValue} ${styles.mono}`}
                  style={{ margin: 0 }}
                >
                  {m.attendanceLogbookRef}
                </dd>
              </div>
            ) : null}
          </dl>
          {(m.invitees ?? []).length > 0 ? (
            <div>
              <p
                className={styles.metaLabel}
                style={{ margin: "0 0 0.375rem" }}
              >
                Invited · {(m.invitees ?? []).length}
              </p>
              <ul
                className={styles.badgeRow}
                style={{ margin: 0, padding: 0, listStyle: "none" }}
              >
                {(m.invitees ?? []).map((u) => (
                  <li key={u.id}>
                    <Badge variant="secondary">
                      {meetingInviteeLabel(u)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {showOutcomeRecords && (m.attendees ?? []).length > 0 ? (
            <div>
              <p
                className={styles.metaLabel}
                style={{ margin: "0 0 0.375rem" }}
              >
                Attendees · {m.attendees.length}
              </p>
              <ul
                className={styles.badgeRow}
                style={{ margin: 0, padding: 0, listStyle: "none" }}
              >
                {m.attendees.map((a, idx) => (
                  <li key={`${a.name}-${idx}`}>
                    <Badge variant="secondary">{attendeeLabel(a)}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {showOutcomeRecords && (m.attachments ?? []).length > 0 ? (
            <div>
              <p
                className={styles.metaLabel}
                style={{ margin: "0 0 0.375rem" }}
              >
                Documents · {(m.attachments ?? []).length}
              </p>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {(m.attachments ?? []).map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={d.fileName}
                      className={`${styles.metaValue} ${styles.mono}`}
                    >
                      {d.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {showOutcomeRecords && m.minutesOfMeeting ? (
            <div>
              <p
                className={styles.metaLabel}
                style={{ margin: "0 0 0.375rem" }}
              >
                Minutes
              </p>
              <div className={styles.logCard} style={{ marginTop: 0 }}>
                <p className={styles.cardText} style={{ margin: 0 }}>
                  {m.minutesOfMeeting}
                </p>
              </div>
            </div>
          ) : null}
          {images.length > 0 ? (
            <div className={styles.thumbGrid}>
              {images.map((img) => (
                <figure key={img.url} className={styles.thumbItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.name}
                    className={styles.thumb}
                  />
                  <figcaption className={styles.thumbName} title={img.name}>
                    {img.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>
        {needsOutcome ? (
          <div className={styles.attendBtns}>
            <Button
              disabled={pending}
              onClick={() => {
                setLogOpen(false);
                openYesDialog();
              }}
            >
              {pending ? (
                <Loader2
                  className="animate-spin"
                  aria-hidden="true"
                  style={{ width: "0.875rem", height: "0.875rem" }}
                />
              ) : null}
              Yes
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setLogOpen(false);
                openAskDialog();
              }}
            >
              {pending ? (
                <Loader2
                  className="animate-spin"
                  aria-hidden="true"
                  style={{ width: "0.875rem", height: "0.875rem" }}
                />
              ) : null}
              No
            </Button>
          </div>
        ) : null}
      </CardModal>

      <CardModal
        open={dialogOpen}
        onClose={closeDialog}
        title={
          step === "rebook"
            ? "Book home visitation"
            : step === "yes"
              ? "Log attendance"
              : "Did the parent/guardian attend?"
        }
        description={
          step === "rebook"
            ? "Pick a new schedule for the home visitation."
            : step === "yes"
              ? "Log the attendance and minutes for this meeting."
              : "Choose an answer to record the outcome."
        }
        size={step === "yes" ? "md" : "sm"}
      >
          {step === "idle" ? (
            <>
              <dl className={styles.kpiGrid} style={{ margin: 0 }}>
                <div className={styles.kpi}>
                  <dt className={styles.metaLabel}>Venue</dt>
                  <dd className={styles.kpiValue} style={{ margin: 0 }}>
                    {venueLabel(m.venue)}
                  </dd>
                </div>
                <div className={styles.kpi}>
                  <dt className={styles.metaLabel}>Date</dt>
                  <dd className={styles.kpiValue} style={{ margin: 0 }}>
                    {formatManilaDate(m.meetingDatetime)}
                  </dd>
                </div>
                <div className={styles.kpi}>
                  <dt className={styles.metaLabel}>Time</dt>
                  <dd className={styles.kpiValue} style={{ margin: 0 }}>
                    {formatManilaTime(m.meetingDatetime)}
                  </dd>
                </div>
                <div className={styles.kpi}>
                  <dt className={styles.metaLabel}>Status</dt>
                  <dd style={{ margin: 0 }}>
                    {m.attended ? (
                      <Badge variant="success">Attended</Badge>
                    ) : timing.state === "live" ? (
                      <Badge variant="success">Live now</Badge>
                    ) : timing.state === "overdue" ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge variant="outline">Upcoming</Badge>
                    )}
                  </dd>
                </div>
              </dl>
              <div className={styles.choiceGrid}>
                <Button
                  className={styles.choiceBtn}
                  disabled={pending}
                  onClick={openYesDialog}
                >
                  {pending ? (
                    <Loader2
                      className="animate-spin"
                      aria-hidden="true"
                      style={{ width: "0.875rem", height: "0.875rem" }}
                    />
                  ) : null}
                  Yes
                </Button>
                <Button
                  variant="outline"
                  className={styles.choiceBtn}
                  disabled={pending}
                  aria-busy={pending || undefined}
                  onClick={() => void saveOutcome(false)}
                >
                  {pending ? (
                    <Loader2
                      className="animate-spin"
                      aria-hidden="true"
                      style={{ width: "0.875rem", height: "0.875rem" }}
                    />
                  ) : null}
                  No
                </Button>
              </div>
            </>
          ) : null}

          {step === "yes" ? (
            <div className={styles.attendBox} style={{ marginTop: 0 }}>
              <label className={styles.metaLabel} htmlFor={`logbook-${m.id}`}>
                Attendance logbook ref (auto-generated)
              </label>
              <Input
                id={`logbook-${m.id}`}
                value={logbook}
                readOnly
                aria-readonly="true"
              />
              {(m.invitees ?? []).length > 0 ? (
                <>
                  <p className={styles.metaLabel} style={{ margin: 0 }}>
                    Invited staff who attended
                    {checkedInvitees.length > 0 ? ` · ${checkedInvitees.length} present` : ""}
                  </p>
                  {(m.invitees ?? []).map((u) => {
                    const checked = checkedInvitees.includes(u.id);
                    return (
                      <label key={u.id} className={styles.inviteeRow}>
                        <input
                          type="checkbox"
                          className={styles.nativeCheck}
                          checked={checked}
                          onChange={() =>
                            setCheckedInvitees((prev) =>
                              prev.includes(u.id)
                                ? prev.filter((x) => x !== u.id)
                                : [...prev, u.id],
                            )
                          }
                          aria-label={`Mark ${u.fullName} attended`}
                        />
                        <span
                          className={styles.customCheck}
                          data-checked={checked ? "true" : "false"}
                          aria-hidden="true"
                        >
                          {checked ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                        <span className={styles.inviteeName} title={meetingInviteeLabel(u)}>
                          {meetingInviteeLabel(u)}
                        </span>
                      </label>
                    );
                  })}
                </>
              ) : null}
              <p className={styles.metaLabel} style={{ margin: 0 }}>
                Attendees
              </p>
              {attendees.map((a, i) => (
                <div key={i} className={styles.attendeeRow}>
                  <Input
                    value={a.name}
                    onChange={(e) =>
                      updateAttendee(i, { name: e.target.value })
                    }
                    placeholder="Full name"
                    aria-label={`Attendee ${i + 1} name`}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Attendee ${i + 1} role`}
                        className={styles.attendeeRoleBtn}
                      >
                        {MEETING_ATTENDEE_ROLE_LABELS[a.role]}
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(
                        Object.entries(MEETING_ATTENDEE_ROLE_LABELS) as [
                          MeetingAttendeeRole,
                          string,
                        ][]
                      ).map(([value, label]) => (
                        <DropdownMenuCheckboxItem
                          key={value}
                          checked={a.role === value}
                          onCheckedChange={() =>
                            updateAttendee(i, { role: value })
                          }
                        >
                          {label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove attendee ${i + 1}`}
                    onClick={() => removeAttendee(i)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Add attendee"
                  disabled={pending || attendees.length >= 20}
                  onClick={addAttendee}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
              <label className={styles.metaLabel} htmlFor={`minutes-${m.id}`}>
                Minutes of meeting
              </label>
              <Textarea
                id={`minutes-${m.id}`}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="What was discussed and agreed…"
              />
              <label className={styles.metaLabel} htmlFor={`docs-${m.id}`}>
                Document images (optional)
              </label>
              <Input
                id={`docs-${m.id}`}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => pickImages(e.target.files)}
              />
              {(m.attachments ?? []).length > 0 ? (
                <div className={styles.thumbGrid}>
                  {(m.attachments ?? []).map((d) => (
                    <figure key={d.id} className={styles.thumbItem}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.fileUrl} alt={d.fileName} className={styles.thumb} />
                      <figcaption className={styles.thumbName} title={d.fileName}>
                        {d.fileName}
                      </figcaption>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={removingDocId === d.id}
                        aria-busy={removingDocId === d.id || undefined}
                        onClick={() => void removeDoc(d.id)}
                      >
                        {removingDocId === d.id ? "Removing…" : "Remove"}
                      </Button>
                    </figure>
                  ))}
                </div>
              ) : null}
              {images.length > 0 ? (
                <div className={styles.thumbGrid}>
                  {images.map((img) => (
                    <figure key={img.url} className={styles.thumbItem}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.name} className={styles.thumb} />
                      <figcaption className={styles.thumbName} title={img.name}>
                        {img.name}
                      </figcaption>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => removeImage(img.url)}
                      >
                        Remove
                      </Button>
                    </figure>
                  ))}
                </div>
              ) : null}
              <p className={styles.muted} style={{ margin: 0 }}>
                New images upload when you save attendance.
              </p>
              {error ? (
                <p className={styles.formError} role="alert">
                  {error}
                </p>
              ) : null}
              <div className={styles.attendBtns}>
                <Button
                  disabled={pending} aria-busy={pending || undefined}
                  onClick={() => void saveOutcome(true)}
                >
                  {pending ? (
                    <Loader2
                      className="animate-spin"
                      aria-hidden="true"
                      style={{ width: "0.875rem", height: "0.875rem" }}
                    />
                  ) : null}
                  {pending ? "Saving…" : "Save attendance"}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={backToAsk}
                >
                  Back
                </Button>
              </div>
            </div>
          ) : null}

          {step === "rebook" ? (
            <div className={styles.attendBox} style={{ marginTop: 0 }}>
              <p className={styles.muted} style={{ margin: 0 }}>
                No-show rebooks as a home visitation — venue is fixed to home.
              </p>
              <ClinicDatePicker
                id={`rebook-${m.id}-date`}
                label="New date"
                value={rebookDate}
                onChange={setRebookDate}
                min={new Date().toISOString().slice(0, 10)}
              />
              <ClinicTimePicker
                id={`rebook-${m.id}-time`}
                label="New time"
                value={rebookTime}
                onChange={setRebookTime}
              />
              <label
                className={styles.metaLabel}
                htmlFor={`rebook-logbook-${m.id}`}
              >
                Attendance logbook ref (optional)
              </label>
              <Input
                id={`rebook-logbook-${m.id}`}
                value={rebookLogbook}
                onChange={(e) => setRebookLogbook(e.target.value)}
                placeholder="e.g. Logbook p. 42"
              />
              {error ? (
                <p className={styles.formError} role="alert">
                  {error}
                </p>
              ) : null}
              <div className={styles.attendBtns}>
                <Button
                  disabled={pending} aria-busy={pending || undefined}
                  onClick={() => void submitRebook()}
                >
                  {pending ? (
                    <Loader2
                      className="animate-spin"
                      aria-hidden="true"
                      style={{ width: "0.875rem", height: "0.875rem" }}
                    />
                  ) : null}
                  {pending ? "Booking…" : "Book home visitation"}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={closeDialog}
                >
                  Later
                </Button>
              </div>
            </div>
          ) : null}
      </CardModal>
    </li>
  );
}
