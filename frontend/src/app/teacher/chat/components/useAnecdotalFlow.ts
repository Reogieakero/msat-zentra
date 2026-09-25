"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ANEC_CATEGORY_LABELS,
  ANEC_TIER_LABELS,
  createAnecdotalRecord,
  fetchAnecdotalOptions,
  type AnecdotalCategory,
  type AnecdotalClassOption,
  type AnecdotalStudent,
  type AnecdotalTier,
} from "../../anecdotal/components/anecdotal-data";
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
  studentQ: string;
  setStudentQ: (next: string) => void;
  filing: boolean;
  confirmFiling: boolean;
  setConfirmFiling: (next: boolean) => void;
  fileProgress: number;
  fileStage: string;
  flowError: string | null;
  studentOpen: boolean;
  setStudentOpen: (next: boolean) => void;
  classOpen: boolean;
  setClassOpen: (next: boolean) => void;
  categoryOpen: boolean;
  setCategoryOpen: (next: boolean) => void;
  tierOpen: boolean;
  setTierOpen: (next: boolean) => void;
  datetimeOpen: boolean;
  setDatetimeOpen: (next: boolean) => void;
  datePopoverOpen: boolean;
  setDatePopoverOpen: (next: boolean) => void;
  handleStudentPick: (id: string) => void;
  handleClassPick: (value: string) => void;
  handleCategoryPick: (value: AnecdotalCategory) => void;
  handleTierPick: (value: AnecdotalTier) => void;
  handleDatetimeConfirm: () => void;
  setTimeParts: (hour: string | null, minute: string | null, ampm: string | null) => void;
  handleAnecSend: () => void;
  fileRecord: () => Promise<void>;
  resetFlowStates: () => void;
  removeFlowSnapshot: (id: string) => void;
}

function filingStageFor(progress: number): string {
  if (progress < 30) return "Validating answers…";
  if (progress < 65) return "Filing anecdotal record…";
  if (progress < 97) return "Autofilling GCForm-01…";
  return "Finishing…";
}

function splitTimeParts(timeInput: string): { hour: string; minute: string; ampm: string } {
  const match = /^(\d{2}):(\d{2})$/.exec(timeInput);
  if (!match) return { hour: "08", minute: "00", ampm: "AM" };
  const h24 = parseInt(match[1], 10);
  return {
    hour: String(h24 % 12 || 12).padStart(2, "0"),
    minute: match[2],
    ampm: h24 < 12 ? "AM" : "PM",
  };
}

/** Guided anecdotal filing engine for the active Bama chat. */
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
  const [textInput, setTextInput] = useState("");
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
  const [confirmFiling, setConfirmFiling] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [fileStage, setFileStage] = useState("");
  const [flowError, setFlowError] = useState<string | null>(null);
  const [studentQ, setStudentQ] = useState("");
  const [studentOpen, setStudentOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const [datetimeOpen, setDatetimeOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const progressTimer = useRef<number | null>(null);
  const progressValue = useRef(0);

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
    setStudentOpen(false);
    setClassOpen(false);
    setCategoryOpen(false);
    setTierOpen(false);
    setDatetimeOpen(false);
    setDatePopoverOpen(false);
    setFlowError(null);
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

  // Restore filing progress when the active chat changes.
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
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, hydrated]);

  // Persist filing progress.
  useEffect(() => {
    if (!hydrated || !activeId || active?.type !== "anecdotal") return;
    const snap = {
      studentId, classKey, category, tier, observationDate, observationTime,
      incident, location, notes, classPerf, attendance, textQuestion,
      askedCategory, askedTier, askedDatetime, previewShown,
    };
    setFlows((prev) => {
      const next = { ...prev, [activeId]: snap };
      saveFlowStore(next);
      return next;
    });
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
  }, [hydrated, activeId, active?.type, studentId, classKey, category, tier, observationDate, observationTime, incident, location, notes, classPerf, attendance, textQuestion, askedCategory, askedTier, askedDatetime, previewShown]);

  const optionsQuery = useQuery({
    queryKey: ["grade-flags", "options"],
    queryFn: fetchAnecdotalOptions,
  });
  const students = useMemo(() => optionsQuery.data?.students ?? [], [optionsQuery.data]);
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

  // ---- Guided flow: student → class → category → tier → date → answers ----
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
    setStudentOpen(false);
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
    setClassOpen(false);
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
    setCategoryOpen(false);
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
    setTierOpen(false);
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

  function setTimeParts(hour: string | null, minute: string | null, ampm: string | null) {
    const fallback = splitTimeParts(timeInput);
    const h12 = hour !== null ? parseInt(hour, 10) : parseInt(fallback.hour, 10);
    const min = minute ?? fallback.minute;
    const ap = ampm ?? fallback.ampm;
    const h24 = ap === "AM" ? h12 % 12 : (h12 % 12) + 12;
    setTimeInput(`${String(h24).padStart(2, "0")}:${min}`);
  }

  function handleDatetimeConfirm() {
    if (!dateInput || observationDate !== null) return;
    setObservationDate(dateInput);
    setObservationTime(timeInput);
    setDatetimeOpen(false);
    lockQuestion("datetime");
    const when = timeInput.length >= 5 ? `${dateInput} at ${timeInput}` : dateInput;
    pushToActive([{ id: nextMessageId(), from: "user", text: when, at: Date.now() }]);
  }

  useEffect(() => {
    if (!hydrated || !active || active.type !== "anecdotal" || active.filed) return;
    if (textQuestion !== null || observationDate === null || incident !== "") return;
    if (active.messages.some((m) => m.from === "assistant" && m.text === TEXT_QUESTION_LABELS.incident)) return;
    // Only fire for the conversation that actually answered the date —
    // never leak the step into a freshly switched thread.
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
    // The incident answer must live in this conversation's messages —
    // never leak the next step into a freshly switched thread.
    if (incident === "" || !active.messages.some((m) => m.from === "user" && m.text === incident)) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    pushToActive([
      { id: nextMessageId(), from: "assistant", text: TEXT_QUESTION_LABELS[textQuestion], at: Date.now() },
    ]);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [textQuestion]);

  const canFile =
    incident.trim().length > 0 &&
    student !== null &&
    selectedClass !== null &&
    category !== null &&
    tier !== null &&
    observationDate !== null &&
    !filing;

  useEffect(() => {
    if (!hydrated || !active || active.type !== "anecdotal" || active.filed) return;
    if (previewShown || textQuestion !== null || !student || !category || !tier || !observationDate) return;
    if (incident.trim() === "" || location.trim() === "") return;
    if (!active.messages.some((m) => m.from === "user" && m.text === incident)) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setPreviewShown(true);
    pushToActive([
      {
        id: nextMessageId(),
        from: "assistant",
        text: "Review the complete record before filing:",
        at: Date.now(),
        preview: {
          studentName: student.name,
          lrn: student.lrn,
          section: sectionNameById.get(student.sectionId ?? "") ?? "—",
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
        },
      },
    ]);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [hydrated, activeId, active?.type, previewShown, textQuestion, student, category, tier, observationDate, incident, location]);

  async function fileRecord() {
    if (filing || active?.filed) return;
    // Name exactly what's missing instead of failing silently — same as
    // the anecdotal page.
    if (!student) {
      setFlowError("Pick a student first.");
      return;
    }
    if (!category || !tier) {
      setFlowError("Answer the category and confidentiality questions above.");
      return;
    }
    if (!selectedClass) {
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
    setFiling(true);
    setFlowError(null);
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
      const created = await createAnecdotalRecord({
        studentId: student.id,
        sectionId: selectedClass.sectionId,
        termId: selectedClass.termId,
        observationDatetime: obsDateTime,
        descriptionOfIncident: note,
        descriptionOfLocation: location || "Classroom",
        notesRecommendationsActions: notes.trim() || (tier === "confidential" ? note : undefined),
        classPerformance: classPerf.trim() || undefined,
        attendanceSummary: attendance.trim() || undefined,
        category,
        confidentialityLevel: tier ?? "restricted",
      });
      const categoryLabel = ANEC_CATEGORY_LABELS[category];
      const detail = {
        recordId: created.id,
        studentName: student.name,
        lrn: student.lrn,
        section: sectionNameById.get(student.sectionId ?? "") ?? "—",
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
      const name = student.name;
      if (progressTimer.current !== null) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setFileProgress(100);
      setFileStage("Done — GCForm-01 ready.");
      pushToActive([
        { id: nextMessageId(), from: "user", text: `${categoryLabel} — ${note}`, at: Date.now(), detail },
        { id: nextMessageId(), from: "assistant", text: "Anecdotal record filed.", at: Date.now(), detail },
      ]);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, title: `${name} · ${categoryLabel} · Filed`, filed: true } : c))
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
      // Teacher lists subscribe under these keys — refresh all so the new
      // record appears in the repo, folders, and referral composer.
      queryClient.invalidateQueries({ queryKey: ["anecdotal"] });
      queryClient.invalidateQueries({ queryKey: ["anecdotal-mine"] });
      queryClient.invalidateQueries({ queryKey: ["referableAnecdotal"] });
      sileo.success({ title: "Anecdotal record filed", description: `${name} · ${categoryLabel}.` });
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
            "Could not file this record.")
          : "Could not file this record.";
      setFlowError(message);
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

  function handleAnecSend() {
    if (filing || !active || active.filed) return;
    // Answering a text question.
    if (textQuestion !== null) {
      const value = draft.trim();
      if (!value || !student) return;
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
    // Nothing to answer — file when everything is ready.
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

  // The student picker stays overlaid until a student is picked —
  // closing it without picking reopens it.
  useEffect(() => {
    if (!active || active.type !== "anecdotal" || active.filed || studentId !== "") return;
    if (studentOpen) return;
    const t = window.setTimeout(() => setStudentOpen(true), 350);
    return () => window.clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [active, activeId, studentId, studentOpen]);

  // The class picker stays overlaid until a class is picked —
  // closing it without picking reopens it.
  useEffect(() => {
    if (!active || active.type !== "anecdotal" || active.filed || studentId === "" || classKey !== "") return;
    if (classes.length === 0 || classOpen) return;
    const t = window.setTimeout(() => setClassOpen(true), 350);
    return () => window.clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [active, activeId, studentId, classKey, classOpen, classes.length]);

  // The category picker stays overlaid until a category is picked —
  // closing it without picking reopens it.
  useEffect(() => {
    if (!active || active.type !== "anecdotal" || active.filed || classKey === "" || category !== null) return;
    if (categoryOpen) return;
    const t = window.setTimeout(() => setCategoryOpen(true), 350);
    return () => window.clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [active, activeId, classKey, category, categoryOpen]);

  // The tier picker stays overlaid until a tier is picked —
  // closing it without picking reopens it.
  useEffect(() => {
    if (!active || active.type !== "anecdotal" || active.filed || category === null || tier !== null) return;
    if (tierOpen) return;
    const t = window.setTimeout(() => setTierOpen(true), 350);
    return () => window.clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [active, activeId, category, tier, tierOpen]);

  // The date picker stays overlaid until the date is confirmed —
  // closing it without confirming reopens it.
  useEffect(() => {
    if (!active || active.type !== "anecdotal" || active.filed || tier === null || observationDate !== null) return;
    if (datetimeOpen) return;
    const t = window.setTimeout(() => setDatetimeOpen(true), 350);
    return () => window.clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [active, activeId, tier, observationDate, datetimeOpen]);

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
    studentQ,
    setStudentQ,
    filing,
    confirmFiling,
    setConfirmFiling,
    fileProgress,
    fileStage,
    flowError,
    studentOpen,
    setStudentOpen,
    classOpen,
    setClassOpen,
    categoryOpen,
    setCategoryOpen,
    tierOpen,
    setTierOpen,
    datetimeOpen,
    setDatetimeOpen,
    datePopoverOpen,
    setDatePopoverOpen,
    handleStudentPick,
    handleClassPick,
    handleCategoryPick,
    handleTierPick,
    handleDatetimeConfirm,
    setTimeParts,
    handleAnecSend,
    fileRecord,
    resetFlowStates,
    removeFlowSnapshot,
  };
}
