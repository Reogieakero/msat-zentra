"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
import { useTemplateSaveProgress } from "./template-save-context";
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

export interface PendingSlot {
  key: string;
  day: number;
  period: number;
  subjectId: string;
  teacherNameId: string | null;
}

export type SaveRowStatus = "saving" | "saved" | "warned" | "failed" | "empty";

export interface SaveRowState {
  key: string;
  day: number;
  period: number;
  subjectName: string;
  teacherName: string;
  status: SaveRowStatus;
  message?: string;
}

export interface SaveProgress {
  active: boolean;
  done: boolean;
  sectionName: string;
  rows: SaveRowState[];
  batchTotal: number;
  startedAt: number;
}
export function useScheduleCells(
  section: ScheduleSection,
  maps: CatalogMaps,
  opts?: { silent?: boolean; persistKey?: string },
) {
  const silent = opts?.silent ?? false;
  const persistKey = opts?.persistKey ?? null;
  const readPending = (): Record<string, SlotValue> => {
    if (!persistKey || typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, SlotValue | null>;
      const out: Record<string, SlotValue> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v.subjectId === "string" && v.subjectId !== "") {
          out[k] = {
            subjectId: v.subjectId,
            teacherNameId: typeof v.teacherNameId === "string" ? v.teacherNameId : null,
          };
        }
      }
      return out;
    } catch {
      return {};
    }
  };
  const buildCells = (s: ScheduleSection): Record<string, SlotValue | null> => {
    const init: Record<string, SlotValue> = {};
    for (const e of s.timetableEntries) {
      init[cellKey(e.day, e.period)] = { subjectId: e.subjectId, teacherNameId: e.teacherNameId };
    }
    if (persistKey) {
      // Restore unsaved local picks (e.g. after reload/crash) for slots the
      // server doesn't already fill — saved server slots always win.
      const serverKeys = new Set(Object.keys(init));
      for (const [k, v] of Object.entries(readPending())) {
        if (!serverKeys.has(k)) init[k] = v;
      }
    }
    return init;
  };
  const invalidateTeacher = useTeacherInvalidate();
  const [cells, setCells] = useState<Record<string, SlotValue | null>>(() => buildCells(section));
  const [cellsSectionId, setCellsSectionId] = useState(section.id);
  if (cellsSectionId !== section.id) {
    // Resync when switching sections (template picker) — state init runs once.
    setCellsSectionId(section.id);
    setCells(buildCells(section));
  }
  useEffect(() => {
    // Persist unsaved local picks so an unexpected reload never restarts
    // the template from scratch. Server-confirmed slots are dropped.
    if (!persistKey || typeof window === "undefined") return;
    try {
      const serverMap = new Map(
        section.timetableEntries.map((e) => [
          cellKey(e.day, e.period),
          { subjectId: e.subjectId, teacherNameId: e.teacherNameId },
        ]),
      );
      const pending: Record<string, SlotValue> = {};
      for (const [k, v] of Object.entries(cells)) {
        if (v === null) continue;
        const s = serverMap.get(k);
        if (!s || s.subjectId !== v.subjectId || s.teacherNameId !== v.teacherNameId) {
          pending[k] = v;
        }
      }
      localStorage.setItem(persistKey, JSON.stringify(pending));
    } catch {
      // ignore quota errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, persistKey, section.id]);
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
      const { data } = await apiClient.post<{ warnings?: Array<{ message: string }> }>(
        "/api/teacher/schedule/entries",
        {
          sectionId: section.id,
          subjectId: vars.subjectId,
          teacherNameId: vars.teacherNameId,
          day: vars.day,
          period: vars.period,
        },
      );
      return { vars, warnings: data?.warnings ?? [] };
    },
    onSuccess: ({ vars, warnings }) => {
      invalidateTeacher.schedule();
      const sub = subjectById.get(vars.subjectId)?.name ?? "Subject";
      const teacher = teacherById.get(vars.teacherNameId)?.name ?? "Teacher";
      if (!silent) {
        if (warnings.length > 0) {
          toast.success({
            title: "Slot saved with warning",
            description: `${sub} with ${teacher} — ${section.name}. ${warnings[0]?.message ?? ""}`.trim(),
          });
        } else {
          toast.success({
            title: "Slot saved",
            description: `${sub} with ${teacher} — ${section.name}.`,
          });
        }
      }
      setSlotModal(null);
    },
    onError: (err: unknown, input) => {
      // Revert to the last server value (not blank) so a failed save never
      // wipes a previously saved slot from view.
      const serverEntry = section.timetableEntries.find(
        (e) => cellKey(e.day, e.period) === input.key,
      );
      setCells((prev) => ({
        ...prev,
        [input.key]: serverEntry
          ? { subjectId: serverEntry.subjectId, teacherNameId: serverEntry.teacherNameId }
          : null,
      }));
      const message = apiErrorMessage(err, "Failed to save timetable slot.");
      setSlotError(message);
      if (!silent) toast.error({ title: "Could not save slot", description: message });
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
      if (!silent) toast.success({ title: "Slot cleared", description: "Timetable entry removed." });
      setSlotModal(null);
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, "Failed to clear timetable slot.");
      setSlotError(message);
      if (!silent) toast.error({ title: "Could not clear slot", description: message });
    },
  });
  const filledCount = Object.values(cells).filter((v) => v !== null).length;

  // Staged batch save (template grid): slots that differ from the server.
  // The grid updates instantly (low latency); Save flushes them with progress.
  const pendingSlots = useMemo<PendingSlot[]>(() => {
    const serverMap = new Map(
      section.timetableEntries.map((e) => [cellKey(e.day, e.period), e]),
    );
    const out: PendingSlot[] = [];
    for (const [k, v] of Object.entries(cells)) {
      if (!v || !v.teacherNameId) continue;
      const s = serverMap.get(k);
      if (!s || s.subjectId !== v.subjectId || s.teacherNameId !== v.teacherNameId) {
        const [day, period] = k.split(":").map(Number);
        out.push({ key: k, day, period, subjectId: v.subjectId, teacherNameId: v.teacherNameId });
      }
    }
    return out;
  }, [cells, section]);

  const [saveProgressFallback, setSaveProgressFallback] = useState<SaveProgress | null>(null);
  const saveCtx = useTemplateSaveProgress();
  const saveProgress = saveCtx ? saveCtx.progress : saveProgressFallback;
  const setSaveProgress = saveCtx ? saveCtx.setProgress : setSaveProgressFallback;
  const dismissSaveProgress = useCallback(() => {
    if (saveCtx) saveCtx.dismiss();
    else setSaveProgressFallback(null);
  }, [saveCtx]);

  const saveAll = useCallback(async () => {
    if (saveProgress?.active) return;
    const serverMap = new Map(section.timetableEntries.map((e) => [cellKey(e.day, e.period), e]));
    const batch: PendingSlot[] = [];
    for (const [k, v] of Object.entries(cells)) {
      if (!v || !v.teacherNameId) continue;
      const s = serverMap.get(k);
      if (!s || s.subjectId !== v.subjectId || s.teacherNameId !== v.teacherNameId) {
        const [day, period] = k.split(":").map(Number);
        batch.push({ key: k, day, period, subjectId: v.subjectId, teacherNameId: v.teacherNameId });
      }
    }
    if (batch.length === 0) return;
    const toRow = (s: PendingSlot, status: SaveRowStatus): SaveRowState => ({
      key: s.key,
      day: s.day,
      period: s.period,
      subjectName: subjectById.get(s.subjectId)?.name ?? "Subject",
      teacherName: s.teacherNameId ? (teacherById.get(s.teacherNameId)?.name ?? "Teacher") : "—",
      status,
    });
    // Bulk view: every filled slot in the section (already-saved show Saved
    // from the start), ordered by day then period. Empty slots are excluded.
    const byDayPeriod = (a: PendingSlot, b: PendingSlot) => a.day - b.day || a.period - b.period;
    const batchKeys = new Set(batch.map((b) => b.key));
    const rest: SaveRowState[] = [];
    for (const [k, v] of Object.entries(cells)) {
      if (batchKeys.has(k)) continue;
      if (!v || !v.teacherNameId) continue;
      const [day, period] = k.split(":").map(Number);
      rest.push({
        key: k,
        day,
        period,
        subjectName: subjectById.get(v.subjectId)?.name ?? "Subject",
        teacherName: teacherById.get(v.teacherNameId)?.name ?? "Teacher",
        status: "saved",
      });
    }
    rest.sort((a, b) => a.day - b.day || a.period - b.period);
    const orderedBatch = [...batch].sort(byDayPeriod);
    setSaveProgress({
      active: true,
      done: false,
      sectionName: section.name,
      rows: [...orderedBatch.map((s) => toRow(s, "saving")), ...rest],
      batchTotal: orderedBatch.length,
      startedAt: Date.now(),
    });
    const mark = (key: string, patch: Partial<SaveRowState>) => {
      setSaveProgress((prev) =>
        prev ? { ...prev, rows: prev.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } : prev,
      );
    };
    await Promise.all(
      batch.map(async (slot) => {
        try {
          const { data } = await apiClient.post<{ warnings?: Array<{ message: string }> }>(
            "/api/teacher/schedule/entries",
            {
              sectionId: section.id,
              subjectId: slot.subjectId,
              teacherNameId: slot.teacherNameId,
              day: slot.day,
              period: slot.period,
            },
          );
          const warnings = data?.warnings ?? [];
          if (warnings.length > 0) {
            mark(slot.key, { status: "warned", message: warnings[0]?.message });
          } else {
            mark(slot.key, { status: "saved" });
          }
        } catch (err) {
          mark(slot.key, { status: "failed", message: apiErrorMessage(err, "Failed to save slot.") });
        }
      }),
    );
    invalidateTeacher.schedule();
    setSaveProgress((prev) => (prev ? { ...prev, active: false, done: true } : prev));
  }, [cells, section, saveProgress, setSaveProgress, invalidateTeacher, subjectById, teacherById]);

  // Discard staged (unsaved) picks and revert the grid to last-saved server state.
  const discardStaged = useCallback(() => {
    const next: Record<string, SlotValue | null> = {};
    for (const e of section.timetableEntries) {
      next[cellKey(e.day, e.period)] = { subjectId: e.subjectId, teacherNameId: e.teacherNameId };
    }
    setCells(next);
    setSlotError(null);
  }, [section]);
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
  // One-subject-one-teacher: a cell holding a subject but no teacher inherits
  // the subject's single owner (e.g. picked while another cell owned it).
  // Self-terminating — filled cells drop out of the next pass.
  const ownerless = Object.entries(cells).filter(
    ([, cell]) =>
      cell &&
      cell.subjectId &&
      !cell.teacherNameId &&
      (sectionSubjectTeachers.get(cell.subjectId)?.size ?? 0) === 1,
  );
  if (ownerless.length > 0) {
    const filled: Record<string, SlotValue> = {};
    for (const [k, cell] of ownerless) {
      const owner = [...sectionSubjectTeachers.get(cell!.subjectId)!][0];
      filled[k] = { subjectId: cell!.subjectId, teacherNameId: owner };
    }
    setCells((prev) => ({ ...prev, ...filled }));
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
  const reviewNote =
    section.timetableEntries.find((e) => e.status === "DRAFT" && e.reviewNote)?.reviewNote ?? null;
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
    pendingSlots,
    saveProgress,
    saveAll,
    dismissSaveProgress,
    discardStaged,
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
