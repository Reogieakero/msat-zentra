"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "@/lib/api/live";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import {
  advisoryRosterKey,
  fetchAdvisoryRoster,
} from "@/services/teacher/advisory.service";
import {
  ANEC_CATEGORY_LABELS,
  ANEC_TIER_LABELS,
  type AnecdotalCategory,
  type AnecdotalClassOption,
  type AnecdotalStudent,
  type AnecdotalTier,
} from "@/services/anecdotal/anecdotal.types";
import {
  createAnecdotalRecord,
  fetchAnecdotalOptions,
} from "@/services/anecdotal/records.service";
import { updateAnecdotalRecord } from "@/components/ocform01/folders";
import { invalidateOcForm01Detail } from "@/components/ocform01/ocform01";
import {
  nextMessageId,
  type BamaConversation,
  type BamaMessage,
} from "./bama-conversations";
import {
  EMPTY_FLOW,
  NEXT_QUESTION,
  TEXT_QUESTION_LABELS,
  loadFlowStore,
  saveFlowStore,
  type TextQuestion,
} from "./bama-flow";
import { sileo } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";

interface UseAnecdotalFlowArgs {
  active: BamaConversation | null;
  activeId: string | null;
  hydrated: boolean;
  setConversations: Dispatch<SetStateAction<BamaConversation[]>>;
  draft: string;
  setDraft: (next: string) => void;
}

export interface AnecdotalFlow {
  students: AnecdotalStudent[];
  sectionClasses: AnecdotalClassOption[];
  sectionNameById: Map<string, string>;
  student: AnecdotalStudent | null;
  classes: AnecdotalClassOption[];
  selectedClass: AnecdotalClassOption | null;
  studentMatches: AnecdotalStudent[];
  studentRows: AnecdotalStudent[];
  optionsPending: boolean;
  canFile: boolean;
  studentId: string;
  category: AnecdotalCategory | null;
  tier: AnecdotalTier | null;
  textQuestion: TextQuestion | null;
  observationDate: string | null;
  dateInput: string;
  setDateInput: (next: string) => void;
  timeInput: string;
  setTimeInput: (next: string) => void;
  studentQ: string;
  setStudentQ: (next: string) => void;
  filing: boolean;
  fileProgress: number;
  fileStage: string;
  flowError: string | null;
  datePopoverOpen: boolean;
  setDatePopoverOpen: (next: boolean) => void;
  handleStudentPick: (id: string) => void;
  handleClassPick: (value: string) => void;
  handleCategoryPick: (value: AnecdotalCategory) => void;
  handleTierPick: (value: AnecdotalTier) => void;
  handleDatetimeConfirm: () => void;
  handleAnecSend: () => void;
  fileRecord: () => Promise<void>;
  resetFlowStates: () => void;
  removeFlowSnapshot: (id: string) => void;
  /** Record being edited via chat (its observation context only). */
  editingRecordId: string | null;
  /** Current values of the text questions, used to prefill the composer in edit mode. */
  editPrefill: Record<TextQuestion, string> | null;
  startEdit: (input: AnecdotalEditInput) => void;
}

export interface AnecdotalEditInput {
  recordId: string;
  studentId: string;
  studentName: string;
  lrn: string;
  section: string;
  category: AnecdotalCategory;
  tier: AnecdotalTier;
  observationDatetime: string;
  incident: string;
  location: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
}

function filingStageFor(progress: number): string {
  if (progress < 30) return "Validating answers…";
  if (progress < 65) return "Filing anecdotal record…";
  if (progress < 97) return "Autofilling GCForm-01…";
  return "Finishing…";
}

export function useAnecdotalFlow({
  active,
  activeId,
  hydrated,
  setConversations,
  draft,
  setDraft,
}: UseAnecdotalFlowArgs): AnecdotalFlow {
  const queryClient = useQueryClient();
  const [flows, setFlows] = useState<Record<string, ReturnType<typeof loadFlowStore>[string]>>({});
  const [studentId, setStudentId] = useState("");
  const [classKey, setClassKey] = useState("");
  const [category, setCategory] = useState<AnecdotalCategory | null>(null);
  const [tier, setTier] = useState<AnecdotalTier | null>(null);
  const [textQuestion, setTextQuestion] = useState<TextQuestion | null>(null);

  const [, setTextInput] = useState("");
  const [incident, setIncident] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [classPerf, setClassPerf] = useState("");
  const [attendance, setAttendance] = useState("");
  const [observationDate, setObservationDate] = useState<string | null>(null);
  const [observationTime, setObservationTime] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [askedCategory, setAskedCategory] = useState(false);
  const [askedTier, setAskedTier] = useState(false);
  const [askedDatetime, setAskedDatetime] = useState(false);
  const [previewShown, setPreviewShown] = useState(false);
  const [filing, setFiling] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [fileStage, setFileStage] = useState("");
  const [flowError, setFlowError] = useState<string | null>(null);
  const [studentQ, setStudentQ] = useState("");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editPrefill, setEditPrefill] = useState<Record<TextQuestion, string> | null>(null);
  const editIdentityRef = useRef({ studentName: "", lrn: "", section: "" });

  const progressTimer = useRef<number | null>(null);
  const progressValue = useRef(0);
  // Filing progress now lives in the single shared Dock — no fullscreen
  // overlay. The task survives page jumps through the root provider.
  const dock = useDock();
  const dockRef = useRef(dock);
  useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const fileTaskRef = useRef<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- client-only store hydration */
  useEffect(() => {
    setFlows(loadFlowStore());
    return () => {
      if (progressTimer.current !== null) window.clearInterval(progressTimer.current);
    };
  }, []);

  function resetFlowStates() {
    setStudentId(EMPTY_FLOW.studentId);
    setClassKey(EMPTY_FLOW.classKey);
    setCategory(EMPTY_FLOW.category);
    setTier(EMPTY_FLOW.tier);
    setObservationDate(EMPTY_FLOW.observationDate);
    setObservationTime(EMPTY_FLOW.observationTime);
    setIncident(EMPTY_FLOW.incident);
    setLocation(EMPTY_FLOW.location);
    setNotes(EMPTY_FLOW.notes);
    setClassPerf(EMPTY_FLOW.classPerf);
    setAttendance(EMPTY_FLOW.attendance);
    setTextQuestion(EMPTY_FLOW.textQuestion);
    setTextInput("");
    setAskedCategory(false);
    setAskedTier(false);
    setAskedDatetime(false);
    setPreviewShown(false);
    setDateInput("");
    setTimeInput("");
    setStudentQ("");
    setDatePopoverOpen(false);
    setFlowError(null);
    setEditingRecordId(null);
    setEditPrefill(null);
  }

  function removeFlowSnapshot(id: string) {
    setFlows((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      saveFlowStore(next);
      return next;
    });
  }

  /* eslint-disable react-hooks/set-state-in-effect -- chat-switch snapshot restore + progress persistence */
  useEffect(() => {
    if (!hydrated) return;
    const snap = activeId ? flows[activeId] : undefined;
    if (!snap) {
      resetFlowStates();
      return;
    }
    setStudentId(snap.studentId);
    setClassKey(snap.classKey);
    setCategory(snap.category);
    setTier(snap.tier);
    setObservationDate(snap.observationDate);
    setObservationTime(snap.observationTime);
    setIncident(snap.incident);
    setLocation(snap.location);
    setNotes(snap.notes);
    setClassPerf(snap.classPerf);
    setAttendance(snap.attendance);
    setTextQuestion(snap.textQuestion);
    setAskedCategory(snap.askedCategory);
    setAskedTier(snap.askedTier);
    setAskedDatetime(snap.askedDatetime);
    setPreviewShown(snap.previewShown);
    setEditingRecordId(snap.editingRecordId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, hydrated]);

  useEffect(() => {
    if (!hydrated || !activeId || active?.type !== "anecdotal") return;
    const snap = {
      studentId, classKey, category, tier, observationDate, observationTime,
      incident, location, notes, classPerf, attendance, textQuestion,
      askedCategory, askedTier, askedDatetime, previewShown, editingRecordId,
    };
    setFlows((prev) => {
      const next = { ...prev, [activeId]: snap };
      saveFlowStore(next);
      return next;
    });
  }, [hydrated, activeId, active?.type, studentId, classKey, category, tier, observationDate, observationTime, incident, location, notes, classPerf, attendance, textQuestion, askedCategory, askedTier, askedDatetime, previewShown, editingRecordId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const optionsQuery = useLiveQuery({
    queryKey: ["grade-flags", "options", termKey],
    queryFn: fetchAnecdotalOptions,
  });

  const session = useSession();
  const advisoryQuery = useLiveQuery({
    queryKey: advisoryRosterKey(session?.sub ?? null, termKey),
    queryFn: fetchAdvisoryRoster,
    enabled: !!session?.sub,
    retry: false,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const advisedSectionIds = useMemo(
    () => new Set((advisoryQuery.data?.advisorySections ?? []).map((s) => s.id)),
    [advisoryQuery.data],
  );
  const students = useMemo(() => {
    const all = optionsQuery.data?.students ?? [];
    if (advisedSectionIds.size === 0) return all;
    return all.filter((s) => s.sectionId != null && advisedSectionIds.has(s.sectionId));
  }, [optionsQuery.data, advisedSectionIds]);
  const sectionClasses = useMemo(() => optionsQuery.data?.sectionClasses ?? [], [optionsQuery.data]);
  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of sectionClasses) map.set(c.sectionId, c.sectionName);
    return map;
  }, [sectionClasses]);

  const student = students.find((s) => s.id === studentId) ?? null;
  const classes = useMemo(
    () =>
      student && student.sectionId
        ? sectionClasses.filter((c) => c.sectionId === student.sectionId)
        : sectionClasses,
    [sectionClasses, student]
  );
  const selectedClass =
    classes.find((c) => `${c.subjectId}|${c.sectionId}|${c.termId}` === classKey) ?? null;

  function pushToActive(msgs: BamaMessage[]) {
    if (!activeId) return;
    const id = activeId;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages: [...c.messages, ...msgs], updatedAt: Date.now() } : c))
    );
  }

  function lockQuestion(type: string) {
    if (!activeId) return;
    const id = activeId;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.question?.type === type ? { ...m, question: { ...m.question, locked: true } } : m
              ),
            }
          : c
      )
    );
  }

  function handleStudentPick(id: string) {
    const picked = students.find((s) => s.id === id) ?? null;
    if (!picked || studentId !== "") return;
    const sectionClassesForStudent = picked.sectionId
      ? sectionClasses.filter((c) => c.sectionId === picked.sectionId)
      : sectionClasses;
    if (sectionClassesForStudent.length === 0) {
      setFlowError("No classes found for that student — pick another student.");
      return;
    }
    setFlowError(null);
    setStudentId(id);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && c.title === "New chat" ? { ...c, title: picked.name } : c
      )
    );
    pushToActive([
      { id: nextMessageId(), from: "user", text: picked.name, at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "Which class is this report for?",
        at: Date.now(),
        question: {
          type: "class",
          options: sectionClassesForStudent.map((c) => ({
            value: `${c.subjectId}|${c.sectionId}|${c.termId}`,
            label: `${c.subjectName} · ${c.sectionName}`,
          })),
        },
      },
    ]);
  }

  function handleClassPick(value: string) {
    if (classKey !== "" || student === null) return;
    const picked = classes.find((c) => `${c.subjectId}|${c.sectionId}|${c.termId}` === value);
    if (!picked) return;
    setClassKey(value);
    lockQuestion("class");
    pushToActive([
      { id: nextMessageId(), from: "user", text: picked.subjectName, at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "What is the category for this report?",
        at: Date.now(),
        question: {
          type: "category",
          options: (Object.entries(ANEC_CATEGORY_LABELS) as [AnecdotalCategory, string][]).map(([v, l]) => ({
            value: v,
            label: l,
          })),
        },
      },
    ]);
    setAskedCategory(true);
  }

  function handleCategoryPick(value: AnecdotalCategory) {
    if (category !== null) return;
    setCategory(value);
    lockQuestion("category");
    pushToActive([
      { id: nextMessageId(), from: "user", text: ANEC_CATEGORY_LABELS[value], at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "What is the confidentiality tier?",
        at: Date.now(),
        question: {
          type: "tier",
          options: (Object.entries(ANEC_TIER_LABELS) as [AnecdotalTier, string][]).map(([v, l]) => ({
            value: v,
            label: l,
          })),
        },
      },
    ]);
    setAskedTier(true);
  }

  function handleTierPick(value: AnecdotalTier) {
    if (tier !== null) return;
    setTier(value);
    lockQuestion("tier");
    const today = new Date().toISOString().split("T")[0];
    setDateInput(today);
    setTimeInput("");
    pushToActive([
      { id: nextMessageId(), from: "user", text: ANEC_TIER_LABELS[value], at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "When did this happen? Pick the date of the incident below.",
        at: Date.now(),
        question: { type: "datetime", options: [] },
      },
    ]);
    setAskedDatetime(true);
  }

  function handleDatetimeConfirm() {
    if (!dateInput || observationDate !== null) return;
    setObservationDate(dateInput);
    setObservationTime(timeInput);
    lockQuestion("datetime");
    const when = timeInput.length >= 5 ? `${dateInput} at ${timeInput}` : dateInput;
    pushToActive([{ id: nextMessageId(), from: "user", text: when, at: Date.now() }]);
  }

  useEffect(() => {
    if (!hydrated || !active || active.type !== "anecdotal" || active.filed) return;
    if (textQuestion !== null || observationDate === null || incident !== "") return;
    if (active.messages.some((m) => m.from === "assistant" && m.text === TEXT_QUESTION_LABELS.incident)) return;

    if (!observationDate || !active.messages.some((m) => m.from === "user" && m.text.includes(observationDate))) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setTextQuestion("incident");
    pushToActive([
      { id: nextMessageId(), from: "assistant", text: TEXT_QUESTION_LABELS.incident, at: Date.now() },
    ]);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [hydrated, activeId, active?.type, observationDate, incident, textQuestion]);

  useEffect(() => {
    if (!hydrated || !textQuestion || !active || active.type !== "anecdotal" || active.filed) return;
    if (active.messages.some((m) => m.from === "assistant" && m.text === TEXT_QUESTION_LABELS[textQuestion])) return;

    if (incident === "" || !active.messages.some((m) => m.from === "user" && m.text === incident)) return;
    pushToActive([
      { id: nextMessageId(), from: "assistant", text: TEXT_QUESTION_LABELS[textQuestion], at: Date.now() },
    ]);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [textQuestion]);

  const canFile =
    incident.trim().length > 0 &&
    (student !== null || editingRecordId !== null) &&
    (selectedClass !== null || editingRecordId !== null) &&
    category !== null &&
    tier !== null &&
    observationDate !== null &&
    !filing;

  useEffect(() => {
    if (!hydrated || !active || active.type !== "anecdotal" || active.filed) return;
    if (previewShown || textQuestion !== null || (!student && !editingRecordId) || !category || !tier || !observationDate) return;
    if (incident.trim() === "" || location.trim() === "") return;
    if (!active.messages.some((m) => m.from === "user" && m.text === incident)) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setPreviewShown(true);
    pushToActive([
      {
        id: nextMessageId(),
        from: "assistant",
        text: editingRecordId ? "Review the updated record before saving:" : "Review the complete record before filing:",
        at: Date.now(),
        preview: {
          studentName: student?.name ?? editIdentityRef.current.studentName,
          lrn: student?.lrn ?? editIdentityRef.current.lrn,
          section:
            (student ? sectionNameById.get(student.sectionId ?? "") : editIdentityRef.current.section) ?? "—",
          category: ANEC_CATEGORY_LABELS[category],
          tier: ANEC_TIER_LABELS[tier],
          location: location || "Classroom",
          incident,
          notes: notes || "",
          classPerformance: classPerf || "",
          attendanceSummary: attendance || "",
          observationDateTime:
            observationTime.length >= 5 ? `${observationDate} ${observationTime}` : `${observationDate}`,
          filedOn: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          editing: editingRecordId !== null,
        },
      },
    ]);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [hydrated, activeId, active?.type, previewShown, textQuestion, student, category, tier, observationDate, incident, location, editingRecordId]);

  async function fileRecord() {
    if (filing || active?.filed) return;

    if (!student && !editingRecordId) {
      setFlowError("Pick a student first.");
      return;
    }
    if (!category || !tier) {
      setFlowError("Answer the category and confidentiality questions above.");
      return;
    }
    if (!selectedClass && !editingRecordId) {
      setFlowError("Pick a class for this report.");
      return;
    }
    if (!observationDate) {
      setFlowError("Confirm the observation date and time.");
      return;
    }
    if (!incident.trim()) {
      setFlowError("Describe the incident first.");
      return;
    }
    const displayName = student?.name ?? editIdentityRef.current.studentName;
    const editing = editingRecordId !== null;
    setFiling(true);
    setFlowError(null);
    try {
      fileTaskRef.current = dockRef.current.startTask({
        kind: "anecdotal-file",
        title: editing ? "Updating record" : "Filing record",
        description: `${displayName} · ${category}`,
      });
    } catch {
      fileTaskRef.current = null;
    }
    setFileProgress(4);
    setFileStage(filingStageFor(4));
    if (progressTimer.current !== null) window.clearInterval(progressTimer.current);
    progressValue.current = 4;
    setFileProgress(4);
    setFileStage(filingStageFor(4));
    progressTimer.current = window.setInterval(() => {
      progressValue.current = Math.min(97, progressValue.current + 4 + Math.floor(Math.random() * 9));
      setFileProgress(progressValue.current);
      setFileStage(filingStageFor(progressValue.current));
    }, 220);
    try {
      const note = incident.trim();
      const obsDateTime =
        observationTime.length >= 5
          ? new Date(`${observationDate}T${observationTime}`).toISOString()
          : new Date(`${observationDate}T00:00:00`).toISOString();
      const observationLabel =
        observationTime.length >= 5 ? `${observationDate} ${observationTime}` : `${observationDate}`;
      let recordId: string;
      if (editing && editingRecordId) {
        await updateAnecdotalRecord(editingRecordId, {
          observationDatetime: obsDateTime,
          descriptionOfIncident: note,
          descriptionOfLocation: location || "Classroom",
          notesRecommendationsActions: notes.trim() || null,
          classPerformance: classPerf.trim() || null,
          attendanceSummary: attendance.trim() || null,
          category,
          confidentialityLevel: tier ?? "restricted",
        });
        recordId = editingRecordId;
      } else {
        const created = await createAnecdotalRecord({
          studentId: student!.id,
          sectionId: selectedClass!.sectionId,
          observationDatetime: obsDateTime,
          descriptionOfIncident: note,
          descriptionOfLocation: location || "Classroom",
          notesRecommendationsActions: notes.trim() || (tier === "confidential" ? note : undefined),
          classPerformance: classPerf.trim() || undefined,
          attendanceSummary: attendance.trim() || undefined,
          category,
          confidentialityLevel: tier ?? "restricted",
        });
        recordId = created.id;
      }
      const categoryLabel = ANEC_CATEGORY_LABELS[category];
      const detail = {
        recordId,
        studentName: displayName,
        lrn: student?.lrn ?? editIdentityRef.current.lrn,
        section:
          (student ? sectionNameById.get(student.sectionId ?? "") : editIdentityRef.current.section) ?? "—",
        category: categoryLabel,
        tier: ANEC_TIER_LABELS[tier],
        location: location || "Classroom",
        incident: note,
        notes: notes || "",
        classPerformance: classPerf || "",
        attendanceSummary: attendance || "",
        observationDateTime: observationLabel,
        filedOn: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };
      const name = displayName;
      if (progressTimer.current !== null) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setFileProgress(100);
      setFileStage(editing ? "Done — GCForm-01 updated." : "Done — GCForm-01 ready.");
      pushToActive([
        { id: nextMessageId(), from: "user", text: `${categoryLabel} — ${note}`, at: Date.now(), detail },
        {
          id: nextMessageId(),
          from: "assistant",
          text: editing ? "Anecdotal record updated." : "Anecdotal record filed.",
          at: Date.now(),
          detail,
        },
      ]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, title: `${name} · ${categoryLabel} · ${editing ? "Updated" : "Filed"}`, filed: true }
            : c
        )
      );
      resetFlowStates();
      if (activeId) {
        setFlows((prev) => {
          const next = { ...prev };
          delete next[activeId];
          saveFlowStore(next);
          return next;
        });
      }

      queryClient.invalidateQueries({ queryKey: ["anecdotal"] });
      queryClient.invalidateQueries({ queryKey: ["anecdotal-mine"] });
      queryClient.invalidateQueries({ queryKey: ["referableAnecdotal"] });
      invalidateOcForm01Detail(recordId);
      try {
        const taskId = fileTaskRef.current;
        fileTaskRef.current = null;
        if (taskId) dockRef.current.completeTask(taskId, `${name} · ${categoryLabel}`);
      } catch {
        /* ignore */
      }
      sileo.success({
        title: editing ? "Anecdotal record updated" : "Anecdotal record filed",
        description: `${name} · ${categoryLabel}.`,
      });
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
            "Could not file this record.")
          : "Could not file this record.";
      setFlowError(message);
      try {
        const taskId = fileTaskRef.current;
        fileTaskRef.current = null;
        if (taskId) dockRef.current.failTask(taskId, message);
      } catch {
        /* ignore */
      }
      sileo.error({ title: "Could not file record", description: message });
      setFileProgress(0);
      setFileStage("");
    } finally {
      if (progressTimer.current !== null) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setFiling(false);
    }
  }

  function startEdit(input: AnecdotalEditInput) {
    const parsed = new Date(input.observationDatetime);
    const valid = !Number.isNaN(parsed.getTime());
    const date = valid ? parsed.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const time = valid ? parsed.toISOString().slice(11, 16) : "";
    editIdentityRef.current = {
      studentName: input.studentName,
      lrn: input.lrn,
      section: input.section,
    };
    setEditingRecordId(input.recordId);
    setStudentId(input.studentId);
    setClassKey("");
    setCategory(input.category);
    setTier(input.tier);
    setObservationDate(date);
    setObservationTime(time);
    setDateInput(date);
    setTimeInput(time);
    setIncident("");
    setLocation("");
    setNotes("");
    setClassPerf("");
    setAttendance("");
    setTextQuestion("incident");
    setAskedCategory(true);
    setAskedTier(true);
    setAskedDatetime(true);
    setPreviewShown(false);
    setFlowError(null);
    setEditPrefill({
      incident: input.incident,
      location: input.location,
      notes: input.notes,
      classPerformance: input.classPerformance,
      attendance: input.attendanceSummary,
    });
    pushToActive([
      {
        id: nextMessageId(),
        from: "assistant",
        text: `Editing ${input.studentName}'s anecdotal record. Only the observation details change — student info stays as filed. ${TEXT_QUESTION_LABELS.incident}:`,
        at: Date.now(),
      },
    ]);
  }

  function handleAnecSend() {
    if (filing || !active || active.filed) return;

    if (textQuestion !== null) {
      const value = draft.trim();
      if (!value || (!student && !editingRecordId)) return;
      if (textQuestion === "incident") setIncident(value);
      else if (textQuestion === "location") setLocation(value);
      else if (textQuestion === "notes") setNotes(value);
      else if (textQuestion === "classPerformance") setClassPerf(value);
      else setAttendance(value);
      pushToActive([{ id: nextMessageId(), from: "user", text: value, at: Date.now() }]);
      setDraft("");
      setTextQuestion(NEXT_QUESTION[textQuestion]);
      return;
    }

    if (canFile) void fileRecord();
  }

  const studentNeedle = studentQ.trim().toLowerCase();
  const studentMatches = useMemo(
    () =>
      students.filter(
        (s) =>
          !studentNeedle ||
          s.name.toLowerCase().includes(studentNeedle) ||
          s.lrn.includes(studentNeedle) ||
          (sectionNameById.get(s.sectionId ?? "") ?? "").toLowerCase().includes(studentNeedle)
      ),
    [students, studentNeedle, sectionNameById]
  );
  const studentRows = studentMatches.slice(0, 60);

  return {
    students,
    sectionClasses,
    sectionNameById,
    student,
    classes,
    selectedClass,
    studentMatches,
    studentRows,
    optionsPending: optionsQuery.isPending,
    canFile,
    studentId,
    category,
    tier,
    textQuestion,
    observationDate,
    dateInput,
    setDateInput,
    timeInput,
    setTimeInput,
    studentQ,
    setStudentQ,
    filing,
    fileProgress,
    fileStage,
    flowError,
    datePopoverOpen,
    setDatePopoverOpen,
    handleStudentPick,
    handleClassPick,
    handleCategoryPick,
    handleTierPick,
    handleDatetimeConfirm,
    handleAnecSend,
    fileRecord,
    resetFlowStates,
    removeFlowSnapshot,
    editingRecordId,
    editPrefill,
    startEdit,
  };
}
