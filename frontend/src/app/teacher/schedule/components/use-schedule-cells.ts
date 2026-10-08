"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
import type { SlotValue } from "./SlotEntryDialog";
import type { CopiedSlot } from "./CopiedSlotCard";
import type { ScheduleSection } from "../page";
export function cellKey(day: number, period: number): string {
  return `${day}:${period}`;
}
interface CatalogMaps {
  subjectById: Map<string, { id: string; name: string }>;
  teacherById: Map<string, { id: string; name: string }>;
}
export function useScheduleCells(section: ScheduleSection, maps: CatalogMaps) {
  const invalidateTeacher = useTeacherInvalidate();
  const [cells, setCells] = useState<Record<string, SlotValue | null>>(() => {
    const init: Record<string, SlotValue> = {};
    for (const e of section.timetableEntries) {
      init[cellKey(e.day, e.period)] = { subjectId: e.subjectId, teacherNameId: e.teacherNameId };
    }
    return init;
  });
  const [slotModal, setSlotModal] = useState<{ day: number; period: number } | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopiedSlot | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const { subjectById, teacherById } = maps;
  const saveSlot = useMutation({
    mutationFn: async (vars: {
      subjectId: string;
      teacherNameId: string;
      day: number;
      period: number;
      key: string;
    }) => {
      await apiClient.post("/api/teacher/schedule/entries", {
        sectionId: section.id,
        subjectId: vars.subjectId,
        teacherNameId: vars.teacherNameId,
        day: vars.day,
        period: vars.period,
      });
      return vars;
    },
    onSuccess: (vars) => {
      invalidateTeacher.schedule();
      const sub = subjectById.get(vars.subjectId)?.name ?? "Subject";
      const teacher = teacherById.get(vars.teacherNameId)?.name ?? "Teacher";
      toast.success({
        title: "Slot saved",
        description: `${sub} with ${teacher} — ${section.name}.`,
      });
      setSlotModal(null);
    },
    onError: (err: unknown, vars) => {
      setCells((prev) => ({ ...prev, [vars.key]: null }));
      const message = apiErrorMessage(err, "Failed to save timetable slot.");
      setSlotError(message);
      toast.error({ title: "Could not save slot", description: message });
    },
  });
  const removeSlot = useMutation({
    mutationFn: async (vars: { day: number; period: number; key: string }) => {
      await apiClient.delete("/api/teacher/schedule/entries", {
        params: { sectionId: section.id, day: vars.day, period: vars.period },
      });
      return vars;
    },
    onSuccess: (vars) => {
      setCells((prev) => ({ ...prev, [vars.key]: null }));
      invalidateTeacher.schedule();
      toast.success({ title: "Slot cleared", description: "Timetable entry removed." });
      setSlotModal(null);
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, "Failed to clear timetable slot.");
      setSlotError(message);
      toast.error({ title: "Could not clear slot", description: message });
    },
  });
  const filledCount = Object.values(cells).filter((v) => v !== null).length;
  const isLocked =
    section.timetableEntries.length > 0 &&
    section.timetableEntries.every((e) => e.status === "APPROVED");
  const removeAll = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete("/api/teacher/schedule/entries/all", {
        params: { sectionId: section.id },
      });
      return data as { deleted: number; skippedApproved?: number };
    },
    onSuccess: (data) => {
      setCells({});
      setSlotModal(null);
      setConfirmClearOpen(false);
      invalidateTeacher.schedule();
      const skipped = data.skippedApproved ?? 0;
      toast.success({
        title: "Timetable cleared",
        description:
          `${data.deleted} slot${data.deleted === 1 ? "" : "s"} removed for ${section.name}.` +
          (skipped > 0
            ? ` ${skipped} approved slot${skipped === 1 ? "" : "s"} kept — unlock the section to remove ${skipped === 1 ? "it" : "them"}.`
            : ""),
      });
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, "Failed to clear timetable.");
      toast.error({ title: "Could not clear timetable", description: message });
    },
  });
  const unlock = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/api/teacher/schedule/unlock", {
        sectionId: section.id,
      });
      return data as { drafted: number };
    },
    onSuccess: (data) => {
      setConfirmUnlockOpen(false);
      invalidateTeacher.schedule();
      toast.success({
        title: "Schedule unlocked",
        description: `${data.drafted} slot${data.drafted === 1 ? "" : "s"} back to draft — edit, then send for review again.`,
      });
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, "Failed to unlock timetable.");
      toast.error({ title: "Could not unlock timetable", description: message });
    },
  });
  const sectionSubjectTeachers = new Map<string, Set<string>>();
  for (const cell of Object.values(cells)) {
    if (cell?.subjectId && cell.teacherNameId) {
      if (!sectionSubjectTeachers.has(cell.subjectId)) {
        sectionSubjectTeachers.set(cell.subjectId, new Set());
      }
      sectionSubjectTeachers.get(cell.subjectId)!.add(cell.teacherNameId);
    }
  }
  const splitSubjects = [...sectionSubjectTeachers.entries()]
    .filter(([, teachers]) => teachers.size > 1)
    .map(([subjectId, teachers]) => ({
      subjectId,
      subjectName: subjectById.get(subjectId)?.name ?? "Subject",
      teacherNames: [...teachers].map((id) => teacherById.get(id)?.name ?? "another teacher"),
    }));
  const serverStatus = new Map(
    section.timetableEntries.map((e) => [cellKey(e.day, e.period), e]),
  );
  const statusOf = (key: string): "DRAFT" | "SUBMITTED" | "APPROVED" | null => {
    const server = serverStatus.get(key);
    if (server) return server.status;
    return cells[key] != null ? "DRAFT" : null;
  };
  const localOnlyKeys = Object.keys(cells).filter((k) => cells[k] != null && !serverStatus.has(k));
  const hasSubmitted = section.timetableEntries.some((e) => e.status === "SUBMITTED");
  const hasDraft =
    section.timetableEntries.some((e) => e.status === "DRAFT") || localOnlyKeys.length > 0;
  const reviewNote = section.timetableEntries.find((e) => e.reviewNote)?.reviewNote ?? null;
  const handleSlotSave = (subjectId: string, teacherNameId: string) => {
    if (!slotModal || saveSlot.isPending || isLocked) return;
    const key = cellKey(slotModal.day, slotModal.period);
    setCells((prev) => ({ ...prev, [key]: { subjectId, teacherNameId } }));
    setSlotError(null);
    saveSlot.mutate({ subjectId, teacherNameId, day: slotModal.day, period: slotModal.period, key });
  };
  const handleSlotRemove = () => {
    if (!slotModal || removeSlot.isPending || isLocked) return;
    const key = cellKey(slotModal.day, slotModal.period);
    if ((cells[key] ?? null) === null) {
      setSlotModal(null);
      return;
    }
    setSlotError(null);
    removeSlot.mutate({ day: slotModal.day, period: slotModal.period, key });
  };
  const copyCell = (subjectId: string, teacherNameId: string) => {
    if (isLocked) return;
    setCopied({ subjectId, teacherNameId });
    const sub = subjectById.get(subjectId)?.name ?? "Subject";
    const teacher = teacherById.get(teacherNameId)?.name ?? "Teacher";
    toast.success({
      title: "Slot copied",
      description: `${sub} with ${teacher} — tap an empty slot to paste.`,
    });
  };
  const pasteCell = (day: number, period: number) => {
    if (!copied || saveSlot.isPending || isLocked) return;
    const key = cellKey(day, period);
    if ((cells[key] ?? null) !== null) return;
    const owners = sectionSubjectTeachers.get(copied.subjectId);
    if (owners && owners.size > 0 && !owners.has(copied.teacherNameId)) {
      const sub = subjectById.get(copied.subjectId)?.name ?? "This subject";
      const holder = [...owners]
        .map((id) => teacherById.get(id)?.name ?? "another teacher")
        .join(", ");
      toast.error({
        title: "Cannot paste here",
        description: `${sub} in ${section.name} is already assigned to ${holder} — one subject takes one teacher per section.`,
      });
      return;
    }
    setCells((prev) => ({ ...prev, [key]: { ...copied } }));
    saveSlot.mutate({
      subjectId: copied.subjectId,
      teacherNameId: copied.teacherNameId,
      day,
      period,
      key,
    });
  };
  const modalKey = slotModal ? cellKey(slotModal.day, slotModal.period) : null;
  const dialogSubjectTeacherMap: Record<string, string[]> = {};
  for (const [key, cell] of Object.entries(cells)) {
    if (cell?.subjectId && cell.teacherNameId && key !== modalKey) {
      (dialogSubjectTeacherMap[cell.subjectId] ??= []).push(cell.teacherNameId);
    }
  }
  return {
    cells,
    setCells,
    slotModal,
    setSlotModal,
    slotError,
    setSlotError,
    copied,
    setCopied,
    confirmClearOpen,
    setConfirmClearOpen,
    confirmUnlockOpen,
    setConfirmUnlockOpen,
    saveSlot,
    removeSlot,
    removeAll,
    unlock,
    filledCount,
    isLocked,
    sectionSubjectTeachers,
    splitSubjects,
    serverStatus,
    statusOf,
    localOnlyKeys,
    hasSubmitted,
    hasDraft,
    reviewNote,
    handleSlotSave,
    handleSlotRemove,
    copyCell,
    pasteCell,
    dialogSubjectTeacherMap,
  };
}
