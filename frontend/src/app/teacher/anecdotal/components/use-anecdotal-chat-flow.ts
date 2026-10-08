"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ANEC_CATEGORY_LABELS,
  ANEC_TIER_LABELS,
  type AnecdotalCategory,
  type AnecdotalClassOption,
  type AnecdotalStudent,
  type AnecdotalTier,
  type ChatMessage,
  type FiledDetail,
  type PreviewDetail,
} from "@/services/anecdotal/anecdotal.types";
import {
  createAnecdotalRecord,
  fetchAnecdotalOptions,
} from "@/services/anecdotal/records.service";
import { NEW_CONVERSATION_TITLE, type StoredConversation } from "./anecdotal-conversations";
import { useTerm } from "@/lib/term/TermContext";
import { downloadOcForm01 } from "@/components/ocform01/ocform01";
import { nextAnecdotalMessageId } from "./use-anecdotal-conversations";
export const CHAT_CATEGORIES = Object.entries(ANEC_CATEGORY_LABELS) as [
  AnecdotalCategory,
  string
][];
export const CHAT_TIERS = Object.entries(ANEC_TIER_LABELS) as [AnecdotalTier, string][];
export const TEXT_QUESTION_LABELS = {
  incident: "Describe the incident",
  location: "Description of Location/Setting",
  notes: "Notes / Recommendations / Actions",
  classPerformance: "Class Performance",
  attendance: "Attendance in Classes for the last 2 weeks/Month",
} as const;
export const TEXT_QUESTION_PLACEHOLDERS = {
  incident: "Describe the incident factually…",
  location: "e.g. Classroom, playground, gate…",
  notes: "Next steps, monitoring, referrals…",
  classPerformance: "e.g. Below expectations in Math…",
  attendance: "e.g. 5 absences in the last 2 weeks…",
} as const;
export type TextQuestionKey = "incident" | "location" | "notes" | "classPerformance" | "attendance" | null;
interface FlowArgs {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversations: StoredConversation[];
  setConversations: React.Dispatch<React.SetStateAction<StoredConversation[]>>;
  activeId: string | null;
  hydrated: boolean;
}
export interface AnecdotalChatFlow {
  reason: string;
  setReason: (v: string) => void;
  category: AnecdotalCategory | null;
  tier: AnecdotalTier | null;
  location: string;
  classPerformance: string;
  attendanceSummary: string;
  notesRecommendations: string;
  studentId: string;
  setStudentId: (v: string) => void;
  classKey: string;
  setClassKey: (v: string) => void;
  studentOpen: boolean;
  setStudentOpen: (v: boolean) => void;
  classOpen: boolean;
  setClassOpen: (v: boolean) => void;
  gcformKnown: "yes" | "no" | null;
  textInput: string;
  setTextInput: (v: string) => void;
  textQuestion: TextQuestionKey;
  sending: boolean;
  observationDate: string | null;
  observationTime: string;
  datetimeDateInput: string;
  setDatetimeDateInput: (v: string) => void;
  datetimeTimeInput: string;
  setDatetimeTimeInput: (v: string) => void;
  datetimePopoverOpen: boolean;
  setDatetimePopoverOpen: (v: boolean) => void;
  previewRecordId: string | null;
  downloadingId: string | null;
  students: AnecdotalStudent[];
  sectionClasses: AnecdotalClassOption[];
  sectionNameById: Map<string, string>;
  student: AnecdotalStudent | null;
  classes: AnecdotalClassOption[];
  selectedClass: AnecdotalClassOption | null;
  optionsPending: boolean;
  optionsError: boolean;
  askedDatetime: boolean;
  canSend: boolean;
  hintText: string;
  closeFormPreview: () => void;
  handleFormDownload: (recordId: string) => Promise<void>;
  resetFlow: () => void;
  handleGcFormSelect: (value: "yes" | "no") => void;
  handleCategorySelect: (value: AnecdotalCategory) => void;
  handleTierSelect: (value: AnecdotalTier) => void;
  questionSelectedValue: (type: string) => string | null;
  handleQuestionOptionClick: (type: string, value: string) => void;
  handleDatetimeConfirm: () => void;
  handleSend: () => Promise<void>;
  setPreviewRecordId: (v: string | null) => void;
}
export function useAnecdotalChatFlow({
  messages,
  setMessages,
  conversations,
  setConversations,
  activeId,
  hydrated,
}: FlowArgs): AnecdotalChatFlow {
  const queryClient = useQueryClient();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<AnecdotalCategory | null>(null);
  const [tier, setTier] = useState<AnecdotalTier | null>(null);
  const [location, setLocation] = useState("");
  const [classPerformance, setClassPerformance] = useState("");
  const [attendanceSummary, setAttendanceSummary] = useState("");
  const [notesRecommendations, setNotesRecommendations] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classKey, setClassKey] = useState("");
  const [studentOpen, setStudentOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [gcformKnown, setGcformKnown] = useState<"yes" | "no" | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textQuestion, setTextQuestion] = useState<TextQuestionKey>(null);
  const [sending, setSending] = useState(false);
  const [askedGcForm, setAskedGcForm] = useState(false);
  const [askedCategory, setAskedCategory] = useState(false);
  const [askedTier, setAskedTier] = useState(false);
  const [askedDatetime, setAskedDatetime] = useState(false);
  const [observationDate, setObservationDate] = useState<string | null>(null);
  const [observationTime, setObservationTime] = useState("");
  const [datetimeDateInput, setDatetimeDateInput] = useState("");
  const [datetimeTimeInput, setDatetimeTimeInput] = useState("");
  const [datetimePopoverOpen, setDatetimePopoverOpen] = useState(false);
  const [previewShown, setPreviewShown] = useState(false);
  const [previewRecordId, setPreviewRecordId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  function closeFormPreview() {
    setPreviewRecordId(null);
  }
  async function handleFormDownload(recordId: string) {
    setDownloadingId(recordId);
    try {
      await downloadOcForm01(recordId);
    } finally {
      setDownloadingId(null);
    }
  }
  function resetFlow() {
    setStudentId("");
    setClassKey("");
    setCategory(null);
    setTier(null);
    setLocation("");
    setClassPerformance("");
    setAttendanceSummary("");
    setNotesRecommendations("");
    setReason("");
    setObservationDate(null);
    setObservationTime("");
    setDatetimeDateInput("");
    setDatetimeTimeInput("");
    setAskedDatetime(false);
    setPreviewShown(false);
    setGcformKnown(null);
    setAskedGcForm(false);
    setAskedCategory(false);
    setAskedTier(false);
    setTextQuestion(null);
    setTextInput("");
    closeFormPreview();
  }
  const optionsQuery = useQuery({
    queryKey: ["grade-flags", "options", termKey],
    queryFn: fetchAnecdotalOptions,
  });
  const students = useMemo(
    () => optionsQuery.data?.students ?? [],
    [optionsQuery.data]
  );
  const sectionClasses = useMemo(
    () => optionsQuery.data?.sectionClasses ?? [],
    [optionsQuery.data]
  );
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
    classes.find(
      (c) => `${c.subjectId}|${c.sectionId}|${c.termId}` === classKey
    ) ?? null;
  useEffect(() => {
    if (!hydrated || !activeId || !student) return;
    setConversations((prev) => {
      const current = prev.find((c) => c.id === activeId);
      if (!current || current.title !== NEW_CONVERSATION_TITLE) return prev;
      return prev.map((c) =>
        c.id === activeId ? { ...c, title: student.name } : c
      );
    });
  }, [hydrated, activeId, student, setConversations]);
  const hasGcFormAnswers = gcformKnown !== null;
  const canSend =
    textQuestion !== null
      ? textInput.trim().length > 0 && student !== null
      : reason.trim().length > 0 &&
        student !== null &&
        selectedClass !== null &&
        category !== null &&
        tier !== null &&
        observationDate !== null &&
        !sending;
  const handleGcFormSelect = (value: "yes" | "no") => {
    if (gcformKnown !== null) return;
    setGcformKnown(value);
    setMessages((prev) => [
      ...prev,
      {
        id: nextAnecdotalMessageId(),
        from: "user",
        text: value === "yes" ? "Yes — has a record" : "No — no record",
      },
    ]);
  };
  const handleCategorySelect = (value: AnecdotalCategory) => {
    if (category !== null) return;
    setCategory(value);
    setMessages((prev) => [
      ...prev,
      {
        id: nextAnecdotalMessageId(),
        from: "user",
        text: ANEC_CATEGORY_LABELS[value],
      },
    ]);
  };
  const handleTierSelect = (value: AnecdotalTier) => {
    if (tier !== null) return;
    setTier(value);
    setMessages((prev) => [
      ...prev,
      {
        id: nextAnecdotalMessageId(),
        from: "user",
        text: ANEC_TIER_LABELS[value],
      },
    ]);
  };
  const questionSelectedValue = (type: string): string | null => {
    if (type === "gcform") return gcformKnown;
    if (type === "category") return category;
    if (type === "tier") return tier;
    return null;
  };
  const handleQuestionOptionClick = (type: string, value: string) => {
    if (type === "gcform") handleGcFormSelect(value as "yes" | "no");
    else if (type === "category")
      handleCategorySelect(value as AnecdotalCategory);
    else if (type === "tier") handleTierSelect(value as AnecdotalTier);
  };
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (student && !askedGcForm && gcformKnown === null) {
      setAskedGcForm(true);
      setMessages((prev) => [
        ...prev,
        {
          id: nextAnecdotalMessageId(),
          from: "assistant",
          text: "Does this student have an existing GCForm-01 (anecdotal record)?",
          question: {
            type: "gcform",
            options: [
              { value: "yes", label: "Yes — has a record" },
              { value: "no", label: "No — no record" },
            ],
          },
        },
      ]);
    }
  }, [student, gcformKnown, askedGcForm, setMessages]);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      student &&
      hasGcFormAnswers &&
      !askedCategory &&
      category === null
    ) {
      setAskedCategory(true);
      setMessages((prev) => [
        ...prev.map((m) =>
          m.question?.type === "gcform"
            ? {
                ...m,
                question: { ...m.question, locked: true },
              }
            : m
        ),
        {
          id: nextAnecdotalMessageId(),
          from: "assistant",
          text: "What is the category for this GCForm-01?",
          question: {
            type: "category",
            options: CHAT_CATEGORIES.map(([v, l]) => ({
              value: v,
              label: l,
            })),
            locked: false,
          },
        },
      ]);
    }
  }, [student, hasGcFormAnswers, category, askedCategory, setMessages]);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (student && category && !askedTier && tier === null) {
      setAskedTier(true);
      setMessages((prev) => [
        ...prev.map((m) =>
          m.question?.type === "category"
            ? {
                ...m,
                question: { ...m.question, locked: true },
              }
            : m
        ),
        {
          id: nextAnecdotalMessageId(),
          from: "assistant",
          text: "What is the confidentiality tier?",
          question: {
            type: "tier",
            options: CHAT_TIERS.map(([v, l]) => ({
              value: v,
              label: l,
            })),
            locked: false,
          },
        },
      ]);
    }
  }, [student, category, tier, askedTier, setMessages]);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (student && tier && !askedDatetime && observationDate === null) {
      setAskedDatetime(true);
      setMessages((prev) => [
        ...prev.map((m) =>
          m.question?.type === "tier"
            ? {
                ...m,
                question: { ...m.question, locked: true },
              }
            : m
        ),
        {
          id: nextAnecdotalMessageId(),
          from: "assistant",
          text: "When did this incident occur? (This is the observation time, separate from the filing timestamp.)",
          question: {
            type: "datetime",
            options: [],
            locked: false,
          },
        },
      ]);
      const today = new Date().toISOString().split("T")[0];
      setDatetimeDateInput(today);
      setDatetimeTimeInput("");
    }
  }, [student, tier, askedDatetime, observationDate, setMessages]);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      student &&
      hasGcFormAnswers &&
      category &&
      tier &&
      observationDate !== null &&
      textQuestion === null &&
      !reason
    ) {
      setTextQuestion("incident");
      setMessages((prev) => [
        ...prev.map((m) =>
          m.question?.type === "datetime"
            ? {
                ...m,
                question: { ...m.question, locked: true },
              }
            : m
        ),
      ]);
    }
  }, [student, hasGcFormAnswers, category, tier, observationDate, textQuestion, reason, setMessages]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (textQuestion === null) return;
    setMessages((prev) => [
      ...prev,
      {
        id: nextAnecdotalMessageId(),
        from: "assistant",
        text: TEXT_QUESTION_LABELS[textQuestion],
      },
    ]);
  }, [textQuestion, setMessages]);
  const handleDatetimeConfirm = () => {
    if (!datetimeDateInput) return;
    setObservationDate(datetimeDateInput);
    setObservationTime(datetimeTimeInput);
    const when =
      datetimeTimeInput.length >= 5
        ? `${datetimeDateInput} at ${datetimeTimeInput}`
        : datetimeDateInput;
    setMessages((prev) => [
      ...prev,
      {
        id: nextAnecdotalMessageId(),
        from: "user",
        text: when,
      },
    ]);
  };
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      !previewShown &&
      textQuestion === null &&
      student &&
      gcformKnown &&
      category &&
      tier &&
      observationDate &&
      reason.trim().length > 0 &&
      location.trim().length > 0
    ) {
      setPreviewShown(true);
      const categoryLabel = ANEC_CATEGORY_LABELS[category];
      const tierLabel = tier ? ANEC_TIER_LABELS[tier] : "Restricted";
      const observationLabel =
        observationTime.length >= 5
          ? `${observationDate} ${observationTime}`
          : `${observationDate}`;
      const preview: PreviewDetail = {
        studentName: student.name,
        lrn: student.lrn,
        section: sectionNameById.get(student.sectionId ?? "") ?? "—",
        category: categoryLabel,
        tier: tierLabel,
        location: location || "Classroom",
        incident: reason,
        notes: notesRecommendations || "",
        classPerformance: classPerformance || "",
        attendanceSummary: attendanceSummary || "",
        observationDateTime: observationLabel,
        filedOn: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
      setMessages((prev) => [
        ...prev,
        {
          id: nextAnecdotalMessageId(),
          from: "assistant",
          text: "Review the complete record before filing:",
          preview,
        },
      ]);
    }
  }, [
    previewShown,
    textQuestion,
    student,
    gcformKnown,
    category,
    tier,
    observationDate,
    observationTime,
    reason,
    location,
    notesRecommendations,
    classPerformance,
    attendanceSummary,
    sectionNameById,
    setMessages,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */
  async function handleSend() {
    if (sending) return;
    if (textQuestion !== null) {
      if (!canSend) return;
      const value = textInput.trim();
      switch (textQuestion) {
        case "incident":
          setReason(value);
          break;
        case "location":
          setLocation(value);
          break;
        case "notes":
          setNotesRecommendations(value);
          break;
        case "classPerformance":
          setClassPerformance(value);
          break;
        case "attendance":
          setAttendanceSummary(value);
          break;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: nextAnecdotalMessageId(),
          from: "user",
          text: value,
        },
      ]);
      setTextInput("");
      if (textQuestion === "attendance") {
        setTextQuestion(null);
      } else {
        const nextQuestion = (
          {
            incident: "location",
            location: "notes",
            notes: "classPerformance",
            classPerformance: "attendance",
            attendance: null,
          } as const
        )[textQuestion];
        setTextQuestion(nextQuestion);
      }
      return;
    }
    if (!student || !category || !tier || !observationDate || !reason.trim() || !selectedClass) {
      const missing = !student
        ? "Pick a student first."
        : !category || !tier
          ? "Answer the category and confidentiality questions above."
          : !observationDate
            ? "Confirm the observation date and time."
            : !reason.trim()
              ? "Describe the incident first."
              : "Pick a class below — the record files into that class's section and term.";
      setMessages((prev) => [
        ...prev,
        {
          id: nextAnecdotalMessageId(),
          from: "assistant",
          text: `Nothing was filed yet. ${missing}`,
        },
      ]);
      return;
    }
    setSending(true);
    try {
      const note = reason.trim();
      const obsDateTime = observationTime.length >= 5
        ? new Date(`${observationDate}T${observationTime}`).toISOString()
        : new Date(`${observationDate}T00:00:00`).toISOString();
      const observationLabel = observationTime.length >= 5
        ? `${observationDate} ${observationTime}`
        : `${observationDate}`;
      const created = await createAnecdotalRecord({
        studentId: student.id,
        sectionId: selectedClass.sectionId,
        termId: selectedClass.termId,
        observationDatetime: obsDateTime,
        descriptionOfIncident: note,
        descriptionOfLocation: location || "Classroom",
        notesRecommendationsActions: notesRecommendations.trim() || (tier === "confidential" ? note : undefined),
        classPerformance: classPerformance.trim() || undefined,
        attendanceSummary: attendanceSummary.trim() || undefined,
        category,
        confidentialityLevel: tier ?? "restricted",
      });
      const categoryLabel = ANEC_CATEGORY_LABELS[category];
      const tierLabel = tier ? ANEC_TIER_LABELS[tier] : "Restricted";
      const detail: FiledDetail = {
        recordId: created.id,
        folderId: created.folderId ?? null,
        studentName: student.name,
        lrn: student.lrn,
        section: sectionNameById.get(student.sectionId ?? "") ?? "—",
        category: categoryLabel,
        tier: tierLabel,
        location: location || "Classroom",
        incident: note,
        notes: notesRecommendations || "",
        classPerformance: classPerformance || "",
        attendanceSummary: attendanceSummary || "",
        observationDateTime: observationLabel,
        filedOn: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
      const gcformText =
        gcformKnown === "yes"
          ? "Existing GCForm-01 found — record linked."
          : "No prior GCForm-01 — new record created.";
      setMessages((prev) => [
        ...prev,
        {
          id: nextAnecdotalMessageId(),
          from: "user",
          text: `${categoryLabel} — ${note}`,
          detail,
        },
        {
          id: nextAnecdotalMessageId(),
          from: "assistant",
          text: `Anecdotal record filed. ${gcformText}`,
          detail,
        },
      ]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, title: `${student.name} · ${categoryLabel} · Filed` }
            : c
        )
      );
      resetFlow();
      queryClient.invalidateQueries({ queryKey: ["anecdotal"] });
    } finally {
      setSending(false);
    }
  }
  const hintText = optionsQuery.isError
    ? "Could not load students and classes. Check your connection."
    : askedDatetime && observationDate === null
      ? "Select the observation date and time, then confirm"
      : textQuestion
        ? "Type your answer below"
        : canSend
          ? `Ready to file — review the card and click File. ${student?.name} · ${ANEC_CATEGORY_LABELS[category as AnecdotalCategory]}`
          : (category && tier && !reason) ||
            (category && tier && observationDate && !reason)
            ? "Waiting for your description of the incident…"
            : student && !selectedClass
              ? "Pick a class below — the record files into that class's section and term"
              : "Select a student to begin the GCForm-01 flow";
  void conversations;
  void messages;
  return {
    reason,
    setReason,
    category,
    tier,
    location,
    classPerformance,
    attendanceSummary,
    notesRecommendations,
    studentId,
    setStudentId,
    classKey,
    setClassKey,
    studentOpen,
    setStudentOpen,
    classOpen,
    setClassOpen,
    gcformKnown,
    textInput,
    setTextInput,
    textQuestion,
    sending,
    observationDate,
    observationTime,
    datetimeDateInput,
    setDatetimeDateInput,
    datetimeTimeInput,
    setDatetimeTimeInput,
    datetimePopoverOpen,
    setDatetimePopoverOpen,
    previewRecordId,
    downloadingId,
    students,
    sectionClasses,
    sectionNameById,
    student,
    classes,
    selectedClass,
    optionsPending: optionsQuery.isPending,
    optionsError: optionsQuery.isError,
    askedDatetime,
    canSend,
    hintText,
    closeFormPreview,
    handleFormDownload,
    resetFlow,
    handleGcFormSelect,
    handleCategorySelect,
    handleTierSelect,
    questionSelectedValue,
    handleQuestionOptionClick,
    handleDatetimeConfirm,
    handleSend,
    setPreviewRecordId,
  };
}
