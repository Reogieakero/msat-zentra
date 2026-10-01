"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, Coffee, Copy, Info, Loader2, PanelRightClose, PanelRightOpen, Pencil, Trash2, Undo2, Utensils } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WEEK_LABELS_SHORT } from "../../classes/components/classes-data";
import { buildTimetable, formatRange, type DayConfig } from "./schedule-time";
import { SlotEntryDialog, type SlotValue } from "./SlotEntryDialog";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { AddSubjectDialog, AddTeacherDialog, CatalogCards } from "./CatalogCards";
import { CopiedSlotCard, type CopiedSlot } from "./CopiedSlotCard";
import styles from "../schedule-empty.module.css";
import type { ScheduleSection, ScheduleSubject } from "../page";

type Props = {
  section: ScheduleSection;
};

const DAYS = [1, 2, 3, 4, 5];

function getErrorMessage(err: unknown, fallback: string): string {
  // The backend envelopes errors as { error: { code, message } } — read that
  // first so users see "Santos already teaches…" instead of axios's raw
  // "Request failed with status code 409".
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function cellKey(day: number, period: number): string {
  return `${day}:${period}`;
}

// Weekly setup view for one section: the empty Mon–Fri template (same table
// framing as My Classes). Tapping a slot opens the entry overlay to pick the
// subject name and the teacher running it for this section; saving persists
// the cell immediately, and clearing an entry drops its assignment once the
// subject's last cell is gone.
export function ScheduleWeekSetup({ section }: Props) {
  const queryClient = useQueryClient();
  // Mount-time snapshot of the saved grid; session edits layer on top.
  const [cells, setCells] = useState<Record<string, SlotValue | null>>(() => {
    const init: Record<string, SlotValue> = {};
    for (const e of section.timetableEntries) {
      init[cellKey(e.day, e.period)] = { subjectId: e.subjectId, teacherNameId: e.teacherNameId };
    }
    return init;
  });
  const [slotModal, setSlotModal] = useState<{ day: number; period: number } | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  // Copied slot content for paste-into-empty-slot setup. Survives across
  // pastes so one copy can fill many slots; cleared explicitly.
  const [copied, setCopied] = useState<CopiedSlot | null>(null);
  // Persisted per browser (default open). Effect-applied after mount so
  // server and client render the same first frame (no hydration mismatch).
  const [railOpen, setRailOpenState] = useState(true);
  useEffect(() => {
    const apply = () => {
      try {
        const stored = window.localStorage.getItem("zentra.schedule-rail");
        if (stored === "open" || stored === "closed") {
          setRailOpenState((current) =>
            (current ? "open" : "closed") === stored ? current : stored === "open",
          );
        }
      } catch {
        // Private mode etc. — default holds for the visit.
      }
    };
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);
  const setRailOpen = (next: boolean | ((v: boolean) => boolean)) => {
    setRailOpenState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      try {
        window.localStorage.setItem("zentra.schedule-rail", value ? "open" : "closed");
      } catch {
        // Private mode etc. — choice holds for the visit.
      }
      return value;
    });
  };
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [createTeacherOpen, setCreateTeacherOpen] = useState(false);
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);

  const subjectsQuery = useQuery<{ subjects: ScheduleSubject[] }>({
    queryKey: ["teacher-schedule-subjects"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ subjects: ScheduleSubject[] }>(
        "/api/teacher/schedule/subjects",
      );
      return data;
    },
  });

  const teachersQuery = useQuery<{ teachers: { id: string; name: string; code: string | null; linked: boolean }[] }>({
    queryKey: ["teacher-schedule-teachers"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teachers: { id: string; name: string; code: string | null; linked: boolean }[] }>(
        "/api/teacher/schedule/teachers",
      );
      return data;
    },
  });

  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
  });

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
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule"] });
      const sub = subjectById.get(vars.subjectId)?.name ?? "Subject";
      const teacher = teacherById.get(vars.teacherNameId)?.name ?? "Teacher";
      toast.success({
        title: "Slot saved",
        description: `${sub} with ${teacher} — ${section.name}.`,
      });
      setSlotModal(null);
    },
    onError: (err: unknown, vars) => {
      // Nothing was saved — revert the optimistic cell.
      setCells((prev) => ({ ...prev, [vars.key]: null }));
      const message = getErrorMessage(err, "Failed to save timetable slot.");
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
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule"] });
      toast.success({ title: "Slot cleared", description: "Timetable entry removed." });
      setSlotModal(null);
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to clear timetable slot.");
      setSlotError(message);
      toast.error({ title: "Could not clear slot", description: message });
    },
  });

  const filledCount = Object.values(cells).filter((v) => v !== null).length;

  // An approved timetable is locked: no fills, swaps, pastes, or clears
  // until the master explicitly unlocks it for editing.
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
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule"] });
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
      const message = getErrorMessage(err, "Failed to clear timetable.");
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
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule"] });
      toast.success({
        title: "Schedule unlocked",
        description: `${data.drafted} slot${data.drafted === 1 ? "" : "s"} back to draft — edit, then send for review again.`,
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to unlock timetable.");
      toast.error({ title: "Could not unlock timetable", description: message });
    },
  });

  // One subject takes one teacher per section (a teacher may still own
  // several subjects). Owners derive from the live grid so every timeslot
  // in this section stays consistent.
  // Subjects scope to the section's grade; any of them may repeat across
  // cells but each subject keeps a single teacher in this section.
  const gradeSubjects = (subjectsQuery.data?.subjects ?? []).filter(
    (s) => s.gradeLevel === section.gradeLevel,
  );
  const subjectById = new Map((subjectsQuery.data?.subjects ?? []).map((s) => [s.id, s]));
  const teacherById = new Map((teachersQuery.data?.teachers ?? []).map((t) => [t.id, t]));

  // subjectId -> distinct teacherIds holding it in this section's grid.
  const sectionSubjectTeachers = new Map<string, Set<string>>();
  for (const cell of Object.values(cells)) {
    if (cell?.subjectId && cell.teacherNameId) {
      if (!sectionSubjectTeachers.has(cell.subjectId)) {
        sectionSubjectTeachers.set(cell.subjectId, new Set());
      }
      sectionSubjectTeachers.get(cell.subjectId)!.add(cell.teacherNameId);
    }
  }
  // Legacy splits already saved (e.g. Mathematics 7 held by 5 teachers):
  // surface them so the master unifies instead of extending the split.
  const splitSubjects = [...sectionSubjectTeachers.entries()]
    .filter(([, teachers]) => teachers.size > 1)
    .map(([subjectId, teachers]) => ({
      subjectId,
      subjectName: subjectById.get(subjectId)?.name ?? "Subject",
      teacherNames: [...teachers].map((id) => teacherById.get(id)?.name ?? "another teacher"),
    }));

  const activeConfig = configQuery.data?.config ?? null;
  if (!activeConfig) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading timetable">
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="h-72 rounded-lg border bg-muted/40" />
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-24 rounded-full bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // The table re-renders from this on every Apply — recess rows appear,
  // clock times shift, cell keys (day + period number) stay stable.
  const rows = buildTimetable(activeConfig);

  // Review state comes from the fresh prop, never local state: cells hold
  // just subject+teacher (new fills read as DRAFT until the refetch lands),
  // so a principal decision can never strand the UI on stale statuses.
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

  const modalRow = slotModal
    ? rows.find((r) => r.kind === "period" && r.periodIndex === slotModal.period)
    : undefined;
  const modalLabel =
    slotModal && modalRow && modalRow.kind === "period"
      ? `${WEEK_LABELS_SHORT[slotModal.day - 1]} · ${formatRange(modalRow.startMin, modalRow.endMin)}`
      : "";
  const modalInitial = slotModal ? (cells[cellKey(slotModal.day, slotModal.period)] ?? null) : null;

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
    // Pasting must not split a subject across teachers: the pasted teacher
    // has to match the subject's existing owner in this section.
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

  // Owners for the slot dialog: this section's holders per subject, excluding
  // the slot being edited so editing a subject's own slot never self-blocks.
  const modalKey = slotModal ? cellKey(slotModal.day, slotModal.period) : null;
  const dialogSubjectTeacherMap: Record<string, string[]> = {};
  for (const [key, cell] of Object.entries(cells)) {
    if (cell?.subjectId && cell.teacherNameId && key !== modalKey) {
      (dialogSubjectTeacherMap[cell.subjectId] ??= []).push(cell.teacherNameId);
    }
  }

  return (
    <div
      className={`grid items-start gap-4 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
        railOpen ? "lg:grid-cols-[minmax(0,1fr)_17rem]" : "lg:grid-cols-[minmax(0,1fr)_0rem]"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/teacher/schedule">
            <ArrowLeft size={16} aria-hidden />
            Sections
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Schedule for {section.name}
            </h1>
          </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setRailOpen((v) => !v)}
            aria-label={railOpen ? "Hide sidebar" : "Show sidebar"}
            title={railOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={railOpen}
          >
            {railOpen ? (
              <PanelRightClose size={16} aria-hidden />
            ) : (
              <PanelRightOpen size={16} aria-hidden />
            )}
          </Button>
          {isLocked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmUnlockOpen(true)}
              disabled={unlock.isPending}
            >
              <Pencil size={16} aria-hidden />
              Edit schedule
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClearOpen(true)}
              disabled={filledCount === 0 || removeAll.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 size={16} aria-hidden />
              Remove all
            </Button>
          )}
        </div>
      </div>
      </div>
      {splitSubjects.length > 0 && !isLocked ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
        >
          <p className="font-medium">
            {splitSubjects.length === 1 ? "Subject" : "Subjects"} split across teachers in{" "}
            {section.name}:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {splitSubjects.map((s) => (
              <li key={s.subjectId}>
                {s.subjectName} — {s.teacherNames.join(", ")}. Clear its slots to unify
                it to one teacher.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={`overflow-x-auto rounded-lg border ${styles.noScrollbar}`}>
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-28 p-2 text-left">
                <span className="sr-only">Time</span>
              </th>
              {DAYS.map((day) => (
                <th key={day} scope="col" className="p-2 text-center text-xs font-semibold">
                  {WEEK_LABELS_SHORT[day - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.kind !== "period") {
                const isLunch = row.kind === "lunch";
                return (
                  <tr key={`break-${ri}`}>
                    <td
                      colSpan={DAYS.length + 1}
                      className="border-t bg-muted/40 px-2 py-1 text-center text-xs text-muted-foreground"
                    >
                      {isLunch ? (
                        <>
                          <Utensils size={12} className="mr-1 inline" aria-hidden />
                          Lunch Break · {formatRange(row.startMin, row.endMin)}
                        </>
                      ) : (
                        <>
                          <Coffee size={12} className="mr-1 inline" aria-hidden /> {row.label} ·{" "}
                          {formatRange(row.startMin, row.endMin)}
                        </>
                      )}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={`period-${row.periodIndex}`}>
                  <th
                    scope="row"
                    className="border-t p-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
                  >
                    {formatRange(row.startMin, row.endMin)}
                  </th>
                  {DAYS.map((day) => {
                    const key = cellKey(day, row.periodIndex);
                    const cell = cells[key] ?? null;
                    const sub = cell ? subjectById.get(cell.subjectId) : undefined;
                    const teacher = cell?.teacherNameId
                      ? teacherById.get(cell.teacherNameId)
                      : undefined;
                    const teacherName = teacher?.name;
                    const teacherCode = teacher?.code;
                    const timeLabel = `${WEEK_LABELS_SHORT[day - 1]} ${formatRange(row.startMin, row.endMin)}`;
                    const status = statusOf(key);
                    // A draft slot that still carries the principal's note was
                    // sent back — it reads as "returned" (amber) until the
                    // teacher reworks it (edits clear the note) or resubmits.
                    const returned = status === "DRAFT" && !!serverStatus.get(key)?.reviewNote;
                    const statusName =
                      status === "APPROVED"
                        ? "approved"
                        : status === "SUBMITTED"
                          ? "submitted"
                          : returned
                            ? "returned"
                            : "draft";
                    const label = cell
                      ? `${timeLabel}, ${sub ? `${sub.name}${teacherName ? ` with ${teacherName}` : ""}` : "filled"} (${statusName})`
                      : copied
                        ? `${timeLabel}, empty — tap to paste ${subjectById.get(copied.subjectId)?.name ?? "copied slot"}`
                        : `${timeLabel}, empty`;
                    return (
                      <td key={day} className="border-t p-1">
                        {cell && sub && cell.teacherNameId ? (
                          <div className="relative">
                            {isLocked ? (
                              <div
                                aria-label={label}
                                title={
                                  sub
                                    ? `${sub.name}${teacherName ? ` — ${teacherName}${teacherCode ? ` (${teacherCode})` : ""}` : ""} (${statusName}) — unlock to edit`
                                    : "Locked slot — unlock to edit"
                                }
                                className="flex min-h-14 w-full items-center justify-center rounded-md border border-solid bg-primary/5 px-1 py-1 text-center text-xs"
                              >
                                <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                                  <span className="w-full truncate font-medium">{sub.name}</span>
                                  {teacherName ? (
                                    <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
                                      {teacherName}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSlotModal({ day, period: row.periodIndex });
                                  setSlotError(null);
                                }}
                                aria-label={label}
                                title={
                                  sub
                                    ? `${sub.name}${teacherName ? ` — ${teacherName}${teacherCode ? ` (${teacherCode})` : ""}` : ""} (${statusName})`
                                    : "Empty slot — tap to schedule"
                                }
                                className="flex min-h-14 w-full items-center justify-center rounded-md border border-solid bg-primary/5 px-1 py-1 pr-6 text-center text-xs transition-colors"
                              >
                                <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                                  <span className="w-full truncate font-medium">{sub.name}</span>
                                  {teacherName ? (
                                    <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
                                      {teacherName}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            )}
                            <span
                              aria-hidden="true"
                              title={statusName}
                              className={`absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${
                                status === "APPROVED"
                                  ? "bg-green-500"
                                  : status === "SUBMITTED"
                                    ? "bg-blue-500"
                                    : returned
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                              }`}
                            />
                            {isLocked ? null : (
                              <button
                                type="button"
                                onClick={() => copyCell(cell.subjectId, cell.teacherNameId as string)}
                                aria-label={`Copy ${sub.name}${teacherName ? ` with ${teacherName}` : ""}`}
                                title="Copy slot"
                                className="absolute top-1 right-1 rounded-md border border-input bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground"
                              >
                                <Copy size={12} aria-hidden />
                              </button>
                            )}
                          </div>
                        ) : isLocked ? (
                          <div
                            aria-label={`${timeLabel}, locked`}
                            title="Approved — unlock to edit"
                            className="flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-input px-1 text-center text-xs text-muted-foreground"
                          >
                            <span aria-hidden="true">—</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (copied) {
                                pasteCell(day, row.periodIndex);
                              } else {
                                setSlotModal({ day, period: row.periodIndex });
                                setSlotError(null);
                              }
                            }}
                            aria-label={label}
                            title={copied ? "Tap to paste copied slot" : "Empty slot — tap to schedule"}
                            className="flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-input px-1 text-center text-xs text-muted-foreground transition-colors hover:border-primary"
                          >
                            <span className="text-muted-foreground">+</span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {subjectsQuery.isError || teachersQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load subjects or teachers.
        </p>
      ) : null}
      </div>
      <div className="hidden min-w-0 overflow-hidden lg:block" inert={!railOpen}>
      <div
        className={`flex w-[17rem] max-w-[17rem] flex-col gap-4 transition-all duration-300 ease-out motion-reduce:transition-none ${
          railOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
        }`}
      >
        {(() => {
          // A principal note means the timetable was sent back — the amber
          // Returned card replaces the red Draft card in that state.
          const variant = hasSubmitted
            ? "blue"
            : reviewNote
              ? "amber"
              : hasDraft
                ? "red"
                : section.timetableEntries.length > 0
                  ? "green"
                  : null;
          if (!variant) return null;
          const meta = {
            blue: {
              title: "Submitted",
              message: "Awaiting principal approval.",
              from: "#3b82f6",
              to: "#2563d1",
              chip: "bg-blue-500/15",
              icon: "text-blue-500",
              Icon: Clock,
            },
            amber: {
              title: "Returned",
              message: "Sent back for revision — rework the amber slots.",
              from: "#f59e0b",
              to: "#d9770f",
              chip: "bg-amber-500/15",
              icon: "text-amber-500",
              Icon: Undo2,
            },
            red: {
              title: "Draft",
              message: "Not official until approved.",
              from: "#ef4444",
              to: "#dc2626",
              chip: "bg-red-500/15",
              icon: "text-red-500",
              Icon: Pencil,
            },
            green: {
              title: "Approved",
              message: "Official schedule.",
              from: "#22c55e",
              to: "#16a34a",
              chip: "bg-green-500/15",
              icon: "text-green-500",
              Icon: Check,
            },
          }[variant];
          const { Icon } = meta;
          return (
            <div
              className={assign.card}
              role="status"
              aria-label={`Schedule status: ${meta.title} — ${meta.message}`}
              style={{
                borderColor: `color-mix(in oklch, ${meta.from} 45%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in oklch, ${meta.from} 26%, var(--card)), color-mix(in oklch, ${meta.to} 18%, var(--card)))`,
              }}
            >
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.chip}`}
                  aria-hidden="true"
                >
                  <Icon size={20} className={meta.icon} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{meta.title}</h3>
                  <p className="text-xs text-muted-foreground">{meta.message}</p>
                </div>
              </div>
              {variant === "amber" && reviewNote ? (
                <div className="relative">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setNoteOpen(true)}
                    aria-haspopup="dialog"
                    className="h-auto p-0 text-xs"
                  >
                    Read message
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })()}
        <CatalogCards layout="rail" />
        {copied ? (
          <CopiedSlotCard copied={copied} onClear={() => setCopied(null)} />
        ) : null}
        <div className={assign.card} aria-label="Slot status legend">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
              aria-hidden="true"
            >
              <Info size={20} className="text-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Legend</h3>
              <p className="text-xs text-muted-foreground">
                What each slot dot means.
              </p>
            </div>
          </div>
          <div className="relative flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
              Draft — only you see it
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
              Returned — sent back by principal
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
              Submitted — awaiting principal
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
              Approved — official
            </span>
          </div>
        </div>
      </div>
      </div>
      {noteOpen && reviewNote ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setNoteOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Principal requested changes</DialogTitle>
              <DialogDescription>
                Sent back for revision — full message for {section.name}.
              </DialogDescription>
            </DialogHeader>
            <p className="max-h-64 overflow-y-auto text-sm break-words whitespace-pre-wrap">
              {reviewNote}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {confirmUnlockOpen ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmUnlockOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Unlock schedule for editing?</DialogTitle>
              <DialogDescription>
                All {section.timetableEntries.length} approved slot
                {section.timetableEntries.length === 1 ? "" : "s"} for {section.name} return
                to draft. The timetable stays visible but stops being official until the
                principal approves it again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="destructive" onClick={() => setConfirmUnlockOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => unlock.mutate()}
                disabled={unlock.isPending}
                aria-busy={unlock.isPending || undefined}
              >
                {unlock.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Unlocking…</span>
                  </>
                ) : (
                  "Unlock schedule"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {confirmClearOpen ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmClearOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove all entries?</DialogTitle>
              <DialogDescription>
                This clears all {filledCount} scheduled slot{filledCount === 1 ? "" : "s"} for{" "}
                {section.name}. Subjects and teacher names stay in their lists.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="destructive" onClick={() => setConfirmClearOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeAll.mutate()}
                disabled={removeAll.isPending}
                aria-busy={removeAll.isPending || undefined}
              >
                {removeAll.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Removing…</span>
                  </>
                ) : (
                  "Remove all"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {slotModal ? (
        <SlotEntryDialog
          sectionName={section.name}
          gradeLevel={section.gradeLevel}
          slotLabel={modalLabel}
          subjects={gradeSubjects}
          teachers={teachersQuery.data?.teachers ?? []}
          listsPending={subjectsQuery.isPending || teachersQuery.isPending}
          listsError={subjectsQuery.isError || teachersQuery.isError}
          initial={modalInitial}
          saving={saveSlot.isPending}
          removing={removeSlot.isPending}
          error={slotError}
          subjectTeacherMap={dialogSubjectTeacherMap}
          onClose={() => setSlotModal(null)}
          onSave={handleSlotSave}
          onRemove={handleSlotRemove}
          onAddTeacher={() => {
            setSlotModal(null);
            setCreateTeacherOpen(true);
          }}
          onAddSubject={() => {
            setSlotModal(null);
            setCreateSubjectOpen(true);
          }}
        />
      ) : null}
      {createTeacherOpen ? (
        <AddTeacherDialog
          onClose={() => setCreateTeacherOpen(false)}
          teachers={teachersQuery.data?.teachers ?? []}
        />
      ) : null}
      {createSubjectOpen ? (
        <AddSubjectDialog
          onClose={() => setCreateSubjectOpen(false)}
          subjects={subjectsQuery.data?.subjects ?? []}
          teachers={teachersQuery.data?.teachers ?? []}
        />
      ) : null}
    </div>
  );
}

