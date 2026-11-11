"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDock } from "@/components/dock/dock-store";
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
  // Every confirmed write reports into the one shared Dock so the page never
  // has to draw its own floating panel.
  const dock = useDock();
  const dockRef = useRef(dock);
  useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [cells, setCells] = useState<Record<string, SlotValue | null>>(() => buildCells(section));
  const [cellsSectionId, setCellsSectionId] = useState(section.id);
  const [editMode, setEditMode] = useState(false);
  // One unlock per edit session: every write path awaits the same promise so
  // a batch of slot saves can't fire the unlock N times. Keyed by section so a
  // switch starts a fresh session.
  const unlockRef = useRef<{ sectionId: string; promise: Promise<void> } | null>(null);
  // Approved slots captured when the edit session opens. Cancel restores this
  // exact snapshot, so a refetch landing mid-edit can never empty the grid.
  const editSnapshotRef = useRef<{
    sectionId: string;
    entries: ScheduleSection["timetableEntries"];
  } | null>(null);
  // True once this session wrote anything: past that point the server status is
  // a draft, so cancelling can only discard staged picks.
  const sessionWroteRef = useRef(false);
  if (cellsSectionId !== section.id) {
    // Resync when switching sections (template picker) — state init runs once.
    setCellsSectionId(section.id);
    setCells(buildCells(section));
    setEditMode(false);
  }
  // Principal-approved timetable: the server rejects writes to APPROVED slots
  // (409 SCHEDULE_LOCKED), so the grid stays read-only until the user starts an
  // edit. Starting an edit is local-only — the approved status, and with it the
  // principal's sign-off, only changes once the user actually saves.
  const serverLocked =
    section.timetableEntries.length > 0 &&
    section.timetableEntries.every((e) => e.status === "APPROVED");
  const isLocked = serverLocked && !editMode;
  const ensureEditable = useCallback(async () => {
    // Unlock only at write time: an edit the user abandons leaves the approval
    // untouched. Concurrent writes share one in-flight unlock.
    if (!serverLocked) return;
    const current = unlockRef.current;
    if (current && current.sectionId === section.id) {
      await current.promise;
      return;
    }
    const promise = apiClient
      .post("/api/teacher/schedule/unlock", { sectionId: section.id })
      .then(() => undefined)
      .catch((err: unknown) => {
        // Already unlocked (another tab, or an earlier write in this session) —
        // NOTHING_LOCKED is not a failure for us.
        if ((err as { response?: { status?: number } })?.response?.status === 404) return;
        throw err;
      })
      .finally(() => {
        if (unlockRef.current?.promise === promise) unlockRef.current = null;
      });
    unlockRef.current = { sectionId: section.id, promise };
    await promise;
  }, [serverLocked, section.id]);
  const beginEdit = useCallback(() => {
    editSnapshotRef.current = { sectionId: section.id, entries: section.timetableEntries };
    sessionWroteRef.current = false;
    setEditMode(true);
  }, [section.id, section.timetableEntries]);
  // Live server changes (the principal approving/sending back, or another
  // master teacher saving slots) arrive through the realtime channel as a new
  // `timetableEntries` array. Re-seed the grid from it so the open template
  // updates without a refresh, while keeping picks staged but not yet saved.
  const serverSnapshotRef = useRef<{
    sectionId: string;
    entries: ScheduleSection["timetableEntries"];
  }>({ sectionId: section.id, entries: section.timetableEntries });
  useEffect(() => {
    // Mid edit-session the user's working copy wins: a poll / realtime snapshot
    // must never drop slots under their cursor (that emptied the board and
    // looked like the approval itself had been wiped). Cancel restores the
    // approved snapshot explicitly; saving re-syncs after the writes land.
    if (editMode) return;
    const snapshot = serverSnapshotRef.current;
    const next = section.timetableEntries;
    if (snapshot.sectionId === section.id && snapshot.entries === next) return;
    serverSnapshotRef.current = { sectionId: section.id, entries: next };
    // Section switches are reseeded above; only merges concern us here.
    if (snapshot.sectionId !== section.id) return;
    const serialize = (cell: SlotValue | null | undefined) =>
      cell ? `${cell.subjectId}:${cell.teacherNameId ?? ""}` : null;
    const previousByKey = new Map(
      snapshot.entries.map((e) => [
        cellKey(e.day, e.period),
        `${e.subjectId}:${e.teacherNameId ?? ""}`,
      ]),
    );
    const nextByKey = new Map(
      next.map((e) => [
        cellKey(e.day, e.period),
        { subjectId: e.subjectId, teacherNameId: e.teacherNameId },
      ]),
    );
    setCells((current) => {
      let changed = false;
      const merged: Record<string, SlotValue | null> = { ...current };
      // Slots the server dropped: only clear cells still holding the old
      // server value — a staged pick in that cell is the user's, not ours.
      for (const [key, previousServer] of previousByKey) {
        if (nextByKey.has(key)) continue;
        if (serialize(merged[key]) !== previousServer) continue;
        delete merged[key];
        changed = true;
      }
      // Slots the server changed or added win over the old server value.
      for (const [key, entry] of nextByKey) {
        const live = serialize(merged[key]);
        if (live !== null && live !== previousByKey.get(key)) continue;
        merged[key] = { subjectId: entry.subjectId, teacherNameId: entry.teacherNameId };
        changed = true;
      }
      return changed ? merged : current;
    });
  }, [section.id, section.timetableEntries, editMode]);
  useEffect(() => {
    // Persist unsaved local picks so an unexpected reload never restarts
    // the template from scratch. Server-confirmed slots are dropped.
    if (!persistKey || typeof window === "undefined") return;    try {
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
      await ensureEditable();
      sessionWroteRef.current = true;
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
    onMutate: (vars) => {
      const sub = subjectById.get(vars.subjectId)?.name ?? "Subject";
      const teacher = teacherById.get(vars.teacherNameId)?.name ?? "Teacher";
      const dockId = dockRef.current.startTask({
        kind: "timetable-save",
        title: "Saving slot",
        description: `${sub} with ${teacher} — ${section.name}`,
      });
      return { dockId };
    },
    onSuccess: ({ vars, warnings }, _input, ctx) => {
      invalidateTeacher.schedule();
      const sub = subjectById.get(vars.subjectId)?.name ?? "Subject";
      const teacher = teacherById.get(vars.teacherNameId)?.name ?? "Teacher";
      const doneDescription = `${sub} with ${teacher} — ${section.name}`;
      if (ctx?.dockId) {
        if (warnings.length > 0) {
          dockRef.current.failTask(
            ctx.dockId,
            warnings[0]?.message ?? `${doneDescription} was saved with warnings.`,
          );
        } else {
          dockRef.current.completeTask(ctx.dockId, doneDescription);
        }
      }
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
    onError: (err: unknown, input, ctx) => {
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
      if (ctx?.dockId) dockRef.current.failTask(ctx.dockId, message);
      if (!silent) toast.error({ title: "Could not save slot", description: message });
    },
  });
  const removeSlot = useMutation({
    mutationFn: async (vars: { day: number; period: number; key: string }) => {
      await ensureEditable();
      sessionWroteRef.current = true;
      await apiClient.delete("/api/teacher/schedule/entries", {
        params: { sectionId: section.id, day: vars.day, period: vars.period },
      });
      return vars;
    },
    onMutate: () => ({
      dockId: dockRef.current.startTask({
        kind: "timetable-save",
        title: "Clearing slot",
        description: `Removing the entry from ${section.name}`,
      }),
    }),
    onSuccess: (vars, _input, ctx) => {
      setCells((prev) => ({ ...prev, [vars.key]: null }));
      invalidateTeacher.schedule();
      if (ctx?.dockId) dockRef.current.completeTask(ctx.dockId, `Slot cleared — ${section.name}`);
      if (!silent) toast.success({ title: "Slot cleared", description: "Timetable entry removed." });
      setSlotModal(null);
    },
    onError: (err: unknown, _input, ctx) => {
      const message = apiErrorMessage(err, "Failed to clear timetable slot.");
      setSlotError(message);
      if (ctx?.dockId) dockRef.current.failTask(ctx.dockId, message);
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
    try {
      await ensureEditable();
      sessionWroteRef.current = true;
    } catch (err) {
      const message = apiErrorMessage(err, "Failed to unlock the approved timetable.");
      for (const slot of orderedBatch) mark(slot.key, { status: "failed", message });
      setSaveProgress((prev) => (prev ? { ...prev, active: false, done: true } : prev));
      toast.error({ title: "Could not save slots", description: message });
      return;
    }
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
    // The writes unlocked the section: it is a draft now, so leave the local
    // edit session (the server status is authoritative from here on).
    setEditMode(false);
    setSaveProgress((prev) => (prev ? { ...prev, active: false, done: true } : prev));
  }, [cells, section, saveProgress, setSaveProgress, invalidateTeacher, subjectById, teacherById, ensureEditable]);

  // Discard staged (unsaved) picks and revert the grid to last-saved server state.
  const discardStaged = useCallback(() => {
    const next: Record<string, SlotValue | null> = {};
    for (const e of section.timetableEntries) {
      next[cellKey(e.day, e.period)] = { subjectId: e.subjectId, teacherNameId: e.teacherNameId };
    }
    setCells(next);
    setSlotError(null);
    const dockId = dockRef.current.startTask({
      kind: "timetable-save",
      title: "Discarding staged picks",
      description: `${section.name} — reverting to last saved`,
    });
    dockRef.current.completeTask(
      dockId,
      `Staged picks discarded — ${section.name} is back to its last saved slots.`,
    );
  }, [section]);

  /**
   * Leave the approved-schedule edit session without saving: staged picks are
   * dropped and the grid returns to the approved slots captured when the
   * session opened. Nothing was written to the server, so the approval status
   * never changed — and the grid can never be left empty by a mid-edit refetch.
   */
  const cancelEdit = useCallback(() => {
    const snapshot = editSnapshotRef.current;
    const entries =
      snapshot && snapshot.sectionId === section.id ? snapshot.entries : section.timetableEntries;
    // Never wipe the board: only restore when there is something to restore to.
    if (entries.length > 0) {
      const next: Record<string, SlotValue | null> = {};
      for (const e of entries) {
        next[cellKey(e.day, e.period)] = { subjectId: e.subjectId, teacherNameId: e.teacherNameId };
      }
      setCells(next);
    }
    setSlotError(null);
    setEditMode(false);
    editSnapshotRef.current = null;
    if (serverLocked && !sessionWroteRef.current) {
      toast.success({
        title: "Edit cancelled",
        description: `${section.name} is unchanged and still approved.`,
      });
    }
    sessionWroteRef.current = false;
  }, [section, serverLocked]);
  const removeAll = useMutation({
    mutationFn: async () => {
      await ensureEditable();
      sessionWroteRef.current = true;
      const { data } = await apiClient.delete("/api/teacher/schedule/entries/all", {
        params: { sectionId: section.id },
      });
      return data as { deleted: number; skippedApproved?: number };
    },
    onMutate: () => ({
      dockId: dockRef.current.startTask({
        kind: "timetable-save",
        title: "Clearing timetable",
        description: `Removing every slot in ${section.name}`,
      }),
    }),
    onSuccess: (data, _input, ctx) => {
      setCells({});
      setSlotModal(null);
      setConfirmClearOpen(false);
      setEditMode(false);
      invalidateTeacher.schedule();
      const skipped = data.skippedApproved ?? 0;
      const summary =
        `${data.deleted} slot${data.deleted === 1 ? "" : "s"} removed for ${section.name}.` +
        (skipped > 0
          ? ` ${skipped} approved slot${skipped === 1 ? "" : "s"} kept — unlock the section to remove ${skipped === 1 ? "it" : "them"}.`
          : "");
      if (ctx?.dockId) {
        if (skipped > 0) dockRef.current.failTask(ctx.dockId, summary);
        else dockRef.current.completeTask(ctx.dockId, summary);
      }
      toast.success({ title: "Timetable cleared", description: summary });
    },
    onError: (err: unknown, _input, ctx) => {
      const message = apiErrorMessage(err, "Failed to clear timetable.");
      if (ctx?.dockId) dockRef.current.failTask(ctx.dockId, message);
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
    onMutate: () => ({
      dockId: dockRef.current.startTask({
        kind: "timetable-save",
        title: "Unlocking schedule",
        description: `Sending ${section.name} back to draft`,
      }),
    }),
    onSuccess: (data, _input, ctx) => {
      setConfirmUnlockOpen(false);
      invalidateTeacher.schedule();
      const summary = `${data.drafted} slot${data.drafted === 1 ? "" : "s"} back to draft — edit, then send for review again.`;
      if (ctx?.dockId) dockRef.current.completeTask(ctx.dockId, summary);
      toast.success({ title: "Schedule unlocked", description: summary });
    },
    onError: (err: unknown, _input, ctx) => {
      const message = apiErrorMessage(err, "Failed to unlock timetable.");
      if (ctx?.dockId) dockRef.current.failTask(ctx.dockId, message);
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
    serverLocked,
    editMode,
    beginEdit,
    cancelEdit,
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
