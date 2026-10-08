"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { CardModal } from "@/components/ui/CardModal";
import {
  formatManilaDate,
  formatManilaTime,
  venueLabel,
} from "@/services/coordinator/labels";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "../case-page.module.css";
import type {
  ParentMeetingItem,
  MeetingTiming,
} from "./use-meeting-timing";
import type { MeetingOutcome } from "./use-meeting-outcome";
import { AttendeeEditor } from "./attendee-editor";
export function OutcomeDialog({
  meeting,
  timing,
  outcome,
}: {
  meeting: ParentMeetingItem;
  timing: MeetingTiming;
  outcome: MeetingOutcome;
}) {
  const m = meeting;
  const {
    step,
    dialogOpen,
    pending,
    error,
    logbook,
    minutes,
    setMinutes,
    checkedInvitees,
    setCheckedInvitees,
    attendees,
    removingDocId,
    rebookDate,
    setRebookDate,
    rebookTime,
    setRebookTime,
    rebookLogbook,
    setRebookLogbook,
    images,
    pickImages,
    removeImage,
    backToAsk,
    closeDialog,
    openYesDialog,
    removeDoc,
    addAttendee,
    updateAttendee,
    removeAttendee,
    saveOutcome,
    submitRebook,
  } = outcome;
  return (
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
          <AttendeeEditor
            meetingId={m.id}
            invitees={m.invitees ?? []}
            checkedInvitees={checkedInvitees}
            onToggleInvitee={(id) =>
              setCheckedInvitees((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : [...prev, id],
              )
            }
            attendees={attendees}
            onUpdateAttendee={updateAttendee}
            onRemoveAttendee={removeAttendee}
            onAddAttendee={addAttendee}
            pending={pending}
          />
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
                  <img
                    src={d.fileUrl}
                    alt={d.fileName}
                    className={styles.thumb}
                  />
                  <figcaption
                    className={styles.thumbName}
                    title={d.fileName}
                  >
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
                  <img
                    src={img.url}
                    alt={img.name}
                    className={styles.thumb}
                  />
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
              disabled={pending}
              aria-busy={pending || undefined}
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
            <Button variant="outline" disabled={pending} onClick={backToAsk}>
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
              disabled={pending}
              aria-busy={pending || undefined}
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
            <Button variant="outline" disabled={pending} onClick={closeDialog}>
              Later
            </Button>
          </div>
        </div>
      ) : null}
    </CardModal>
  );
}
