"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, CalendarIcon, Check, ChevronDown, Clock, Download, Eraser, FileText, Folder, History, Plus } from "lucide-react";
import {
  ANEC_CATEGORY_LABELS,
  ANEC_TIER_LABELS,
  createAnecdotalRecord,
  fetchAnecdotalOptions,
  type AnecdotalCategory,
  type AnecdotalTier,
  type ChatMessage,
  type FiledDetail,
  type PreviewDetail,
} from "./anecdotal-data";
import {
  createConversation,
  loadConversationStore,
  maxMessageId,
  NEW_CONVERSATION_TITLE,
  saveConversationStore,
  type StoredConversation,
} from "./anecdotal-conversations";
import { AnecdotalHistoryMenu } from "./AnecdotalHistoryMenu";
import { downloadOcForm01 } from "@/components/ocform01/ocform01";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import styles from "./AnecdotalChat.module.css";

const CATEGORIES = Object.entries(ANEC_CATEGORY_LABELS) as [
  AnecdotalCategory,
  string
][];

const TIERS = Object.entries(ANEC_TIER_LABELS) as [AnecdotalTier, string][];

const TEXT_QUESTION_LABELS = {
  incident: "Describe the incident",
  location: "Description of Location/Setting",
  notes: "Notes / Recommendations / Actions",
  classPerformance: "Class Performance",
  attendance: "Attendance in Classes for the last 2 weeks/Month",
} as const;

const TEXT_QUESTION_PLACEHOLDERS = {
  incident: "Describe the incident factually…",
  location: "e.g. Classroom, playground, gate…",
  notes: "Next steps, monitoring, referrals…",
  classPerformance: "e.g. Below expectations in Math…",
  attendance: "e.g. 5 absences in the last 2 weeks…",
} as const;

let messageId = Date.now();

export function AnecdotalChat() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const [studentQ, setStudentQ] = useState("");
  const [classQ, setClassQ] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [classPage, setClassPage] = useState(1);
  const [gcformKnown, setGcformKnown] = useState<
    "yes" | "no" | null
  >(null);
  const [textInput, setTextInput] = useState("");
  const [textQuestion, setTextQuestion] = useState<
    "incident" | "location" | "notes" | "classPerformance" | "attendance" | null
  >(null);
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
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

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

  /** Fresh filing flow: student, answers, and engine questions. Shared by
   * new-chat, conversation switching, and clearing the current chat. */
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
    setStudentQ("");
    setClassQ("");
    setStudentPage(1);
    setClassPage(1);
    closeFormPreview();
  }

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  function startNewChat() {
    const conv = createConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
    resetFlow();
    setHistoryOpen(false);
    // Land the teacher straight on the ask input.
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function switchConversation(id: string) {
    if (id === activeId) {
      setHistoryOpen(false);
      return;
    }
    const target = conversations.find((c) => c.id === id);
    if (!target) return;
    setActiveId(id);
    setMessages(target.messages);
    resetFlow();
    setHistoryOpen(false);
  }

  function renameConversation(id: string, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
    );
  }

  function deleteConversation(id: string) {
    const remaining = conversations.filter((c) => c.id !== id);
    if (id !== activeId) {
      setConversations(remaining);
      return;
    }
    if (remaining.length === 0) {
      const fresh = createConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
      setMessages([]);
    } else {
      const next =
        [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setConversations(remaining);
      setActiveId(next.id);
      setMessages(next.messages);
    }
    resetFlow();
  }

  useEffect(() => {
    // Post-mount read on purpose: reading localStorage during render would
    // hydrate different HTML than the server sent (server has no storage).
    /* eslint-disable react-hooks/set-state-in-effect */
    const store = loadConversationStore();
    messageId = Math.max(Date.now(), maxMessageId(store.conversations) + 1);
    if (store.conversations.length === 0) {
      const first = createConversation();
      setConversations([first]);
      setActiveId(first.id);
      setMessages([]);
    } else {
      const active =
        store.conversations.find((c) => c.id === store.activeId) ??
        store.conversations[0];
      setConversations(store.conversations);
      setActiveId(active.id);
      setMessages(active.messages);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Write the active conversation's messages back into the store; a second
  // effect persists the whole store. Every messages change flushes before
  // any switch/new-chat click can run, so no exchange is ever lost.
  useEffect(() => {
    if (!hydrated || !activeId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, messages, updatedAt: Date.now() } : c
      )
    );
  }, [messages, hydrated, activeId]);

  useEffect(() => {
    if (!hydrated) return;
    saveConversationStore({ conversations, activeId });
  }, [conversations, activeId, hydrated]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, studentId, gcformKnown, category, tier, textQuestion]);

  const optionsQuery = useQuery({
    queryKey: ["grade-flags", "options"],
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
    // Name untitled conversations after the picked student so the history
    // reads as one entry per anecdotal filing flow.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!hydrated || !activeId || !student) return;
    setConversations((prev) => {
      const current = prev.find((c) => c.id === activeId);
      if (!current || current.title !== NEW_CONVERSATION_TITLE) return prev;
      return prev.map((c) =>
        c.id === activeId ? { ...c, title: student.name } : c
      );
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [hydrated, activeId, student]);

  const hasGcFormAnswers = gcformKnown !== null;
  // Filing writes sectionId + termId from the picked class, so the File
  // action must stay disabled until one is chosen — otherwise handleSend
  // would silently discard the filing (no class = no target section/term).
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
        id: messageId++,
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
        id: messageId++,
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
        id: messageId++,
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

  const handleQuestionOptionClick = (
    type: string,
    value: string
  ) => {
    if (type === "gcform") handleGcFormSelect(value as "yes" | "no");
    else if (type === "category")
      handleCategorySelect(value as AnecdotalCategory);
    else if (type === "tier") handleTierSelect(value as AnecdotalTier);
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (student && !askedGcForm && gcformKnown === null) {
      setAskedGcForm(true);
      setMessages((prev) => [
        ...prev,
        {
          id: messageId++,
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [student, gcformKnown, askedGcForm]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
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
          id: messageId++,
          from: "assistant",
          text: "What is the category for this GCForm-01?",
          question: {
            type: "category",
            options: CATEGORIES.map(([v, l]) => ({
              value: v,
              label: l,
            })),
            locked: false,
          },
        },
      ]);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [student, hasGcFormAnswers, category, askedCategory]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
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
          id: messageId++,
          from: "assistant",
          text: "What is the confidentiality tier?",
          question: {
            type: "tier",
            options: TIERS.map(([v, l]) => ({
              value: v,
              label: l,
            })),
            locked: false,
          },
        },
      ]);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [student, category, tier, askedTier]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
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
          id: messageId++,
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [student, tier, askedDatetime, observationDate]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [student, hasGcFormAnswers, category, tier, observationDate, textQuestion, reason]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (textQuestion === null) return;
    setMessages((prev) => [
      ...prev,
      {
        id: messageId++,
        from: "assistant",
        text: TEXT_QUESTION_LABELS[textQuestion],
      },
    ]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [textQuestion]);

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
        id: messageId++,
        from: "user",
        text: when,
      },
    ]);
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
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
          id: messageId++,
          from: "assistant",
          text: "Review the complete record before filing:",
          preview,
        },
      ]);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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
  ]);

  const studentNeedle = studentQ.trim().toLowerCase();
  const visibleStudents = students.filter((s) => {
    if (!studentNeedle) return true;
    return (
      s.name.toLowerCase().includes(studentNeedle) ||
      s.lrn.includes(studentNeedle) ||
      (sectionNameById.get(s.sectionId ?? "") ?? "")
        .toLowerCase()
        .includes(studentNeedle)
    );
  });

  const PAGE_SIZE = 10;
  const studentTotalPages = Math.max(1, Math.ceil(visibleStudents.length / PAGE_SIZE));
  const studentPageRows = visibleStudents.slice(
    (studentPage - 1) * PAGE_SIZE,
    studentPage * PAGE_SIZE
  );

  const classNeedle = classQ.trim().toLowerCase();
  const visibleClasses = classes.filter((c) => {
    if (!classNeedle) return true;
    return (
      c.subjectName.toLowerCase().includes(classNeedle) ||
      c.sectionName.toLowerCase().includes(classNeedle)
    );
  });

  const classTotalPages = Math.max(1, Math.ceil(visibleClasses.length / PAGE_SIZE));
  const classPageRows = visibleClasses.slice(
    (classPage - 1) * PAGE_SIZE,
    classPage * PAGE_SIZE
  );

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
          id: messageId++,
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

    // Defensive: the File button is disabled until everything is ready and
    // the hint names what's missing — but Enter-key submits and state can
    // race, so never swallow a filing silently. Name exactly what's missing
    // instead of discarding the teacher's answers.
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
          id: messageId++,
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
          id: messageId++,
          from: "user",
          text: `${categoryLabel} — ${note}`,
          detail,
        },
        {
          id: messageId++,
          from: "assistant",
          text: `Anecdotal record filed. ${gcformText}`,
          detail,
        },
      ]);
      // Stamp the conversation so the history reads as one entry per filing.
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

  return (
    <div className={styles.chat}>
      <div className={styles.chatBody}>
        <div className={styles.topBar}>
          <p
            className={styles.convTitle}
            title={activeConversation?.title ?? NEW_CONVERSATION_TITLE}
          >
            {activeConversation?.title ?? NEW_CONVERSATION_TITLE}
          </p>
          <div className={styles.topActions}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startNewChat}
            >
              <Plus aria-hidden />
              New chat
            </Button>
            <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-haspopup="dialog"
                  aria-expanded={historyOpen}
                >
                  <History aria-hidden />
                  History
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className={styles.historyPanel}>
                <AnecdotalHistoryMenu
                  conversations={conversations}
                  activeId={activeId}
                  onNew={startNewChat}
                  onSelect={switchConversation}
                  onRename={renameConversation}
                  onDelete={deleteConversation}
                />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/teacher/anecdotal/folders")}
            >
              <Folder aria-hidden />
              Folders
            </Button>
          </div>
        </div>
        <div
          className={styles.messages}
          aria-live="polite"
          ref={messagesRef}
        >
          {messages.map((m) =>
            m.from === "assistant" ? (
              <div key={m.id} className={styles.rowAssistant}>
                <span className={styles.botAvatar} aria-hidden>
                  <Bot className={styles.botIcon} />
                </span>
                 {m.detail ? (
                   <div className={styles.detailWrap}>
                     <div className={styles.detailCard}>
                       <div className={styles.detailHead}>
                         <p className={styles.detailTitle}>
                           {m.detail.studentName}
                         </p>
                         <Badge variant="warning">GCForm-01</Badge>
                       </div>
                       <p className={styles.detailSub}>
                         {m.detail.lrn} · {m.detail.category} · {m.detail.tier} ·{" "}
                         {m.detail.location}
                       </p>
                       <div className={styles.detailReasonRow}>
                         <Badge variant="outline">{m.detail.category}</Badge>
                         <span className={styles.detailFiledOn}>
                           Filed: {m.detail.filedOn}
                         </span>
                       </div>
                       <p className={styles.detailNote}>
                         &ldquo;{m.detail.incident}&rdquo;
                       </p>
                       <dl className={styles.detailMeta}>
                         <div className={styles.detailMetaRow}>
                           <dt>Section</dt>
                           <dd>{m.detail.section}</dd>
                         </div>
                         <div className={styles.detailMetaRow}>
                           <dt>Observation time</dt>
                           <dd>{m.detail.observationDateTime}</dd>
                         </div>
                         <div className={styles.detailMetaRow}>
                           <dt>Status</dt>
                           <dd>
                             {m.detail.tier === "Confidential"
                               ? "Confidential"
                               : "Restricted"}
                           </dd>
                         </div>
                         {m.detail.notes ? (
                           <div className={styles.detailMetaRow}>
                             <dt>Notes</dt>
                             <dd>{m.detail.notes}</dd>
                           </div>
                         ) : null}
                         {m.detail.classPerformance ? (
                           <div className={styles.detailMetaRow}>
                             <dt>Class performance</dt>
                             <dd>{m.detail.classPerformance}</dd>
                           </div>
                         ) : null}
                          {m.detail.attendanceSummary ? (
                            <div className={styles.detailMetaRow}>
                              <dt>Attendance</dt>
                              <dd>{m.detail.attendanceSummary}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {m.detail.recordId ? (
                          <div className={styles.cardActions}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewRecordId(m.detail!.recordId)}
                            >
                              <FileText aria-hidden />
                              Preview OCForm-01
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={downloadingId === m.detail.recordId}
                              onClick={() => handleFormDownload(m.detail!.recordId)}
                            >
                              <Download aria-hidden />
                              {downloadingId === m.detail.recordId ? "Preparing…" : ".xlsx"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <hr className={styles.endMark} aria-hidden />
                    </div>
                 ) : m.preview ? (
                   <div className={styles.detailWrap}>
                     <div className={styles.previewCard}>
                       <div className={styles.detailHead}>
                         <p className={styles.detailTitle}>
                           {m.preview.studentName}
                         </p>
                         <Badge variant="warning">GCForm-01 preview</Badge>
                       </div>
                       <p className={styles.detailSub}>
                         {m.preview.lrn} · {m.preview.category} · {m.preview.tier} ·{" "}
                         {m.preview.location}
                       </p>
                       <div className={styles.detailReasonRow}>
                         <Badge variant="outline">{m.preview.category}</Badge>
                         <span className={styles.detailFiledOn}>
                           Obs: {m.preview.observationDateTime}
                         </span>
                       </div>
                       <p className={styles.detailNote}>
                         &ldquo;{m.preview.incident}&rdquo;
                       </p>
                       <dl className={styles.detailMeta}>
                         <div className={styles.detailMetaRow}>
                           <dt>Section</dt>
                           <dd>{m.preview.section}</dd>
                         </div>
                         <div className={styles.detailMetaRow}>
                           <dt>Status</dt>
                           <dd>
                             {m.preview.tier === "Confidential"
                               ? "Confidential"
                               : "Restricted"}
                           </dd>
                         </div>
                         {m.preview.notes ? (
                           <div className={styles.detailMetaRow}>
                             <dt>Notes / Recommendations</dt>
                             <dd>{m.preview.notes}</dd>
                           </div>
                         ) : null}
                         {m.preview.classPerformance ? (
                           <div className={styles.detailMetaRow}>
                             <dt>Class performance</dt>
                             <dd>{m.preview.classPerformance}</dd>
                           </div>
                         ) : null}
                         {m.preview.attendanceSummary ? (
                           <div className={styles.detailMetaRow}>
                             <dt>Attendance</dt>
                             <dd>{m.preview.attendanceSummary}</dd>
                           </div>
                         ) : null}
                       </dl>
                     </div>
                     <hr className={styles.endMark} aria-hidden />
                   </div>
                 ) : m.question ? (
                   <div className={styles.questionBubble}>
                     <p className={styles.questionText}>{m.text}</p>
                     {m.question.type === "datetime" ? (
                       <div className={styles.datetimePicker}>
                         <div className={styles.datetimeRow}>
                           <CalendarIcon
                             className={styles.datetimeIcon}
                             aria-hidden
                           />
                           <Popover
                             open={datetimePopoverOpen}
                             onOpenChange={setDatetimePopoverOpen}
                           >
                             <PopoverTrigger asChild>
                               <button
                                 type="button"
                                 className={styles.datetimeDateBtn}
                                disabled={m.question!.locked ?? false}
                                aria-haspopup="dialog"
                                aria-expanded={datetimePopoverOpen}
                               >
                                 <span className={styles.datetimeDateValue}>
                                   {datetimeDateInput || "Pick a date"}
                                 </span>
                                 <ChevronDown
                                   className={styles.datetimeChevron}
                                   aria-hidden
                                 />
                               </button>
                             </PopoverTrigger>
                             <PopoverContent
                               className={styles.datetimeCalendar}
                               align="start"
                             >
                               <Calendar
                                 mode="single"
                                 selected={
                                   datetimeDateInput
                                     ? new Date(`${datetimeDateInput}T00:00:00`)
                                     : undefined
                                 }
                                 defaultMonth={
                                   datetimeDateInput
                                     ? new Date(`${datetimeDateInput}T00:00:00`)
                                     : new Date()
                                 }
                                disabled={
                                  m.question!.locked ? true : { after: new Date() }
                                }
                                onSelect={(day) => {
                                  if (day && !(m.question!.locked ?? false)) {
                                    setDatetimeDateInput(
                                      format(day, "yyyy-MM-dd")
                                    );
                                  }
                                }}
                               />
                             </PopoverContent>
                           </Popover>
                         </div>
                         <div className={styles.datetimeRow}>
                           <Clock
                             className={styles.datetimeIcon}
                             aria-hidden
                           />
                            <Input
                              type="time"
                              value={datetimeTimeInput}
                              onChange={(e) => setDatetimeTimeInput(e.target.value)}
                              disabled={m.question!.locked ?? false}
                              className={styles.datetimeTimeInput}
                              aria-label="Observation time"
                            />
                          </div>
                          {!(m.question!.locked ?? false) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className={styles.datetimeConfirmBtn}
                              disabled={!datetimeDateInput}
                              onClick={handleDatetimeConfirm}
                            >
                              Confirm time
                            </Button>
                          )}
                       </div>
                     ) : (
                       <div className={styles.suggestions}>
                         {m.question!.options.map((opt) => {
                           const isSelected =
                             questionSelectedValue(m.question!.type) ===
                             opt.value;
                           const isLocked = m.question!.locked ?? false;
                           return (
                             <Button
                               key={opt.value}
                               type="button"
                               variant={
                                 isSelected ? "default" : "outline"
                               }
                               size="sm"
                               className={styles.suggestion}
                               disabled={isLocked}
                               onClick={() =>
                                 handleQuestionOptionClick(
                                   m.question!.type,
                                   opt.value
                                 )
                               }
                               aria-pressed={isSelected}
                               aria-disabled={isLocked}
                             >
                               {opt.label}
                             </Button>
                           );
                         })}
                       </div>
                     )}
                   </div>
                 ) : (
                   <p className={styles.bubbleAssistant}>{m.text}</p>
                 )}
              </div>
            ) : (
              <div key={m.id} className={styles.rowUser}>
                <p className={styles.bubbleUser}>{m.text}</p>
              </div>
            )
            )}
        </div>

        <div className={styles.composer}>
          <div className={styles.inputRow}>
            <Textarea
              ref={composerRef}
              value={textQuestion !== null ? textInput : reason}
              onChange={(e) => {
                if (textQuestion !== null) setTextInput(e.target.value);
                else setReason(e.target.value);
              }}
              placeholder={
                textQuestion
                  ? TEXT_QUESTION_PLACEHOLDERS[textQuestion]
                  : "Pick a student to start"
              }
              aria-label={
                textQuestion
                  ? TEXT_QUESTION_LABELS[textQuestion]
                  : "Incident description"
              }
              rows={3}
              maxLength={2000}
              className={styles.input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={textQuestion === null}
            />
            <Button
              type="button"
              size="icon"
              className={styles.sendBtn}
              disabled={!canSend}
              onClick={handleSend}
              aria-label={textQuestion ? "Send answer" : "File GCForm-01"}
            >
              <ArrowUp aria-hidden />
            </Button>
          </div>
          <div className={styles.composerBar}>
            <Popover open={studentOpen} onOpenChange={setStudentOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`${styles.pickerBtn} ${
                    student ? styles.pickerSet : ""
                  }`}
                  aria-haspopup="dialog"
                  aria-expanded={studentOpen}
                >
                  <span className={styles.pickerLabel}>
                    {student
                      ? `${student.name} · ${
                          sectionNameById.get(student.sectionId ?? "") ?? ""
                        }`
                      : "Student"}
                  </span>
                  <ChevronDown className={styles.pickerChevron} aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className={styles.dropPanel}
                align="start"
              >
                <Input
                  value={studentQ}
                  onChange={(e) => {
                    setStudentQ(e.target.value);
                    setStudentPage(1);
                  }}
                  placeholder="Search students…"
                  aria-label="Search students"
                  className={styles.dropSearch}
                />
                <table className={styles.dropTable}>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">LRN</th>
                      <th scope="col">Section</th>
                      <th scope="col">
                        <span className={styles.srOnly}>Selected</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPageRows.map((s) => (
                      <tr
                        key={s.id}
                        className={`${styles.dropRow} ${
                          s.id === studentId ? styles.dropRowActive : ""
                        }`}
                        tabIndex={0}
                        onClick={() => {
                          setStudentId(s.id);
                          setStudentOpen(false);
                          if (
                            selectedClass &&
                            selectedClass.sectionId !== s.sectionId
                          ) {
                            setClassKey("");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setStudentId(s.id);
                            setStudentOpen(false);
                            if (
                              selectedClass &&
                              selectedClass.sectionId !== s.sectionId
                            ) {
                              setClassKey("");
                            }
                          }
                        }}
                      >
                        <td className={styles.dropName}>{s.name}</td>
                        <td className={styles.dropDim}>{s.lrn}</td>
                        <td className={styles.dropDim}>
                          {sectionNameById.get(s.sectionId ?? "") ?? "—"}
                        </td>
                        <td className={styles.dropCheck}>
                          {s.id === studentId ? (
                            <Check aria-hidden />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {optionsQuery.isPending ? (
                      <tr aria-hidden>
                        <td colSpan={4}>
                          <div className={styles.dropSkelRows}>
                            <Skeleton className={styles.dropSkel} />
                            <Skeleton className={styles.dropSkel} />
                            <Skeleton className={styles.dropSkel} />
                          </div>
                        </td>
                      </tr>
                    ) : studentPageRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className={styles.dropDim}
                        >
                          No students match.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {studentTotalPages > 1 && (
                  <div className={styles.dropPagination}>
                    <button
                      type="button"
                      className={styles.dropPageBtn}
                      disabled={studentPage <= 1}
                      onClick={() =>
                        setStudentPage((p) => Math.max(1, p - 1))
                      }
                      aria-label="Previous page"
                    >
                      Prev
                    </button>
                    <span className={styles.dropPageInfo}>
                      {studentPage} / {studentTotalPages}
                    </span>
                    <button
                      type="button"
                      className={styles.dropPageBtn}
                      disabled={studentPage >= studentTotalPages}
                      onClick={() =>
                        setStudentPage((p) =>
                          Math.min(studentTotalPages, p + 1)
                        )
                      }
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Popover open={classOpen} onOpenChange={setClassOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`${styles.pickerBtn} ${
                    selectedClass ? styles.pickerSet : ""
                  }`}
                  aria-haspopup="dialog"
                  aria-expanded={classOpen}
                >
                  <span className={styles.pickerLabel}>
                    {selectedClass
                      ? `${selectedClass.subjectName} · ${selectedClass.sectionName}`
                      : "Class"}
                  </span>
                  <ChevronDown className={styles.pickerChevron} aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className={styles.dropPanel}
                align="start"
              >
                <Input
                  value={classQ}
                  onChange={(e) => {
                    setClassQ(e.target.value);
                    setClassPage(1);
                  }}
                  placeholder="Search subjects…"
                  aria-label="Search student's subjects"
                  className={styles.dropSearch}
                />
                <table className={styles.dropTable}>
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col">Teacher</th>
                      <th scope="col">
                        <span className={styles.srOnly}>Selected</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classPageRows.map((c) => {
                      const key = `${c.subjectId}|${c.sectionId}|${c.termId}`;
                      return (
                        <tr
                          key={key}
                          className={`${styles.dropRow} ${
                            key === classKey ? styles.dropRowActive : ""
                          }`}
                          tabIndex={0}
                          onClick={() => {
                            setClassKey(key);
                            setClassOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setClassKey(key);
                              setClassOpen(false);
                            }
                          }}
                        >
                          <td className={styles.dropName}>
                            {c.subjectName}
                          </td>
                          <td className={styles.dropDim}>
                            {c.ownerName ?? "—"}
                          </td>
                          <td className={styles.dropCheck}>
                            {key === classKey ? (
                              <Check aria-hidden />
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {optionsQuery.isPending ? (
                      <tr aria-hidden>
                        <td colSpan={3}>
                          <div className={styles.dropSkelRows}>
                            <Skeleton className={styles.dropSkel} />
                            <Skeleton className={styles.dropSkel} />
                            <Skeleton className={styles.dropSkel} />
                          </div>
                        </td>
                      </tr>
                    ) : classPageRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className={styles.dropDim}
                        >
                          {student
                            ? "No subjects for this student."
                            : "Pick a student to see their subjects."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {classTotalPages > 1 && (
                  <div className={styles.dropPagination}>
                    <button
                      type="button"
                      className={styles.dropPageBtn}
                      disabled={classPage <= 1}
                      onClick={() =>
                        setClassPage((p) => Math.max(1, p - 1))
                      }
                      aria-label="Previous page"
                    >
                      Prev
                    </button>
                    <span className={styles.dropPageInfo}>
                      {classPage} / {classTotalPages}
                    </span>
                    <button
                      type="button"
                      className={styles.dropPageBtn}
                      disabled={classPage >= classTotalPages}
                      onClick={() =>
                        setClassPage((p) =>
                          Math.min(classTotalPages, p + 1)
                        )
                      }
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className={styles.historyBtn}
              onClick={() => {
                setMessages([]);
                resetFlow();
              }}
              aria-label="Clear current chat"
              title="Clear current chat"
            >
              <Eraser aria-hidden />
            </Button>
          </div>
        </div>

        {/* Hint text at the very bottom */}
        <p className={styles.hint}>
          {optionsQuery.isError
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
                      : "Select a student to begin the GCForm-01 flow"}
        </p>
      </div>

      <OcForm01PreviewDialog
        recordId={previewRecordId}
        onClose={closeFormPreview}
      />
    </div>
  );
}
