"use client";
import * as React from "react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  formatManilaDate,
  formatManilaTime,
  generateLogbookRef,
  inviteeToAttendee,
} from "@/services/coordinator/labels";
import {
  deleteMeetingAttachment,
  uploadMeetingAttachments,
} from "@/services/coordinator/cases.service";
import type {
  AdmMeetingInvitee,
  MeetingAttendee,
  MeetingAttendeeRole,
} from "@/services/coordinator/coordinator.types";
import type { ParentMeetingItem } from "./use-meeting-timing";
export interface LocalMeetingImage {
  name: string;
  url: string;
  file: File | null;
}
export function useMeetingOutcome(
  meeting: ParentMeetingItem,
  onChanged: () => void,
  onAttendedConfirmed: () => void,
) {
  const m = meeting;
  const [step, setStep] = React.useState<"idle" | "yes" | "rebook">("idle");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [logbook, setLogbook] = React.useState(
    m.attendanceLogbookRef ?? generateLogbookRef(m.meetingDatetime, m.id),
  );
  const [minutes, setMinutes] = React.useState(m.minutesOfMeeting ?? "");
  const [attendees, setAttendees] = React.useState<MeetingAttendee[]>(() => [
    ...(m.attendees ?? []),
  ]);
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
  const [images, setImages] = React.useState<LocalMeetingImage[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const imagesRef = React.useRef<LocalMeetingImage[]>([]);
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
    const next: LocalMeetingImage[] = [];
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
    setCheckedInvitees(
      (m.invitees ?? []).map((u) => u.id).filter((id) => recorded.has(id)),
    );
    setAttendees([...(m.attendees ?? [])]);
    setRebookDate("");
    setRebookTime("");
    setRebookLogbook("");
    setError(null);
  }
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
  function updateAttendee(index: number, patch: Partial<MeetingAttendee>) {
    setAttendees((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );
  }
  function removeAttendee(index: number) {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  }
  async function uploadPickedDocs(): Promise<{
    uploaded: number;
    failed: boolean;
  }> {
    const toUpload = images.map((i) => i.file).filter((f): f is File => !!f);
    if (toUpload.length === 0) return { uploaded: 0, failed: false };
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
        ({ uploaded: docsUploaded, failed: docsFailed } =
          await uploadPickedDocs());
      }
      if (attended) {
        if (docsFailed) {
          setError(
            "Outcome saved, but some document images could not be uploaded — retry Attach below.",
          );
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
  return {
    step,
    setStep,
    dialogOpen,
    setDialogOpen,
    logOpen,
    setLogOpen,
    logbook,
    setLogbook,
    minutes,
    setMinutes,
    attendees,
    setAttendees,
    checkedInvitees,
    setCheckedInvitees,
    removingDocId,
    rebookDate,
    setRebookDate,
    rebookTime,
    setRebookTime,
    rebookLogbook,
    setRebookLogbook,
    images,
    setImages,
    pending,
    error,
    setError,
    pickImages,
    removeImage,
    resetFlow,
    backToAsk,
    closeDialog,
    openYesDialog,
    openAskDialog,
    addAttendee,
    updateAttendee,
    removeAttendee,
    removeDoc,
    saveOutcome,
    submitRebook,
  };
}
export type MeetingOutcome = ReturnType<typeof useMeetingOutcome>;
