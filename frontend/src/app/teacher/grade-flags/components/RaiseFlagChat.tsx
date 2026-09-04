"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ArrowUp, Bot, Check, ChevronDown, History } from "lucide-react";
import {
  REASON_LABELS,
  fetchFlagOptions,
  raiseFlag,
  type FlagReason,
} from "./grade-flags-data";
import styles from "./RaiseFlagChat.module.css";

interface FiledDetail {
  studentName: string;
  lrn: string;
  section: string;
  subject: string;
  termNumber: number;
  reasonLabel: string;
  note: string;
  owner: string;
  filedOn: string;
}

interface ChatMessage {
  id: number;
  from: "assistant" | "user";
  text: string;
  detail?: FiledDetail;
}

const STORAGE_KEY = "zentra.grade-flags.chat";

let messageId = Date.now();

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop stored confirmations saved in the old one-line shape.
    return (parsed as ChatMessage[]).filter(
      (m) =>
        m &&
        typeof m.text === "string" &&
        (m.detail === undefined ||
          (typeof m.detail.studentName === "string" && typeof m.detail.note === "string"))
    );
  } catch {
    return [];
  }
}

const CATEGORIES = Object.entries(REASON_LABELS) as [FlagReason, string][];

export function RaiseFlagChat({ onHistory }: { onHistory: () => void }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<FlagReason | null>(null);
  const [studentId, setStudentId] = useState("");
  const [classKey, setClassKey] = useState("");
  const [studentOpen, setStudentOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [studentQ, setStudentQ] = useState("");
  const [classQ, setClassQ] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Post-mount read on purpose: reading localStorage during render would
    // hydrate different HTML than the server sent (server has no storage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadMessages());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage full or unavailable — chat simply won't persist.
    }
  }, [messages, hydrated]);

  useEffect(() => {
    // Keep the latest message visible without moving the composer.
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const optionsQuery = useQuery({
    queryKey: ["grade-flags", "options"],
    queryFn: fetchFlagOptions,
  });
  const students = useMemo(() => optionsQuery.data?.students ?? [], [optionsQuery.data]);
  // The class picker lists the SELECTED student's subjects (every gradebook in
  // their section, whoever owns it) — not the teacher's own assignments.
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
    classes.find((c) => `${c.subjectId}|${c.sectionId}|${c.termId}` === classKey) ?? null;
  const canSend =
    reason.trim().length > 0 && student !== null && selectedClass !== null && !sending;

  const studentNeedle = studentQ.trim().toLowerCase();
  const visibleStudents = students.filter((s) => {
    if (!studentNeedle) return true;
    return (
      s.name.toLowerCase().includes(studentNeedle) ||
      s.lrn.includes(studentNeedle) ||
      (sectionNameById.get(s.sectionId ?? "") ?? "").toLowerCase().includes(studentNeedle)
    );
  });

  const classNeedle = classQ.trim().toLowerCase();
  const visibleClasses = classes.filter((c) => {
    if (!classNeedle) return true;
    return (
      c.subjectName.toLowerCase().includes(classNeedle) ||
      c.sectionName.toLowerCase().includes(classNeedle)
    );
  });

  async function handleSend() {
    if (!canSend || !student || !selectedClass) return;
    setSending(true);
    try {
      const note = reason.trim();
      const filed = await raiseFlag({
        studentId: student.id,
        subjectId: selectedClass.subjectId,
        sectionId: selectedClass.sectionId,
        termId: selectedClass.termId,
        reason: category ?? "other",
        note,
      });
      const reasonLabel = category ? REASON_LABELS[category] : "Other";
      const detail: FiledDetail = {
        studentName: filed.student.name,
        lrn: filed.student.lrn,
        section: filed.section.name,
        subject: filed.subject.name,
        termNumber: filed.term.termNumber,
        reasonLabel,
        note,
        owner: filed.owner?.fullName ?? "Unassigned",
        filedOn: new Date(filed.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [
        ...prev,
        { id: messageId++, from: "user", text: category ? `${reasonLabel} — ${note}` : note },
        { id: messageId++, from: "assistant", text: "Flag filed.", detail },
      ]);
      setReason("");
      setCategory(null);
      setStudentId("");
      setClassKey("");
      queryClient.invalidateQueries({ queryKey: ["grade-flags"] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.chat}>
      <div className={styles.chatBody}>
        <div className={styles.messages} aria-live="polite" ref={messagesRef}>
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
                        <p className={styles.detailTitle}>{m.detail.studentName}</p>
                        <Badge variant="warning">Open</Badge>
                      </div>
                      <p className={styles.detailSub}>
                        {m.detail.lrn} · {m.detail.subject} · {m.detail.section} · Term{" "}
                        {m.detail.termNumber}
                      </p>
                      <div className={styles.detailReasonRow}>
                        <Badge variant="outline">{m.detail.reasonLabel}</Badge>
                        <span className={styles.detailFiledOn}>{m.detail.filedOn}</span>
                      </div>
                      <p className={styles.detailNote}>&ldquo;{m.detail.note}&rdquo;</p>
                      <dl className={styles.detailMeta}>
                        <div className={styles.detailMetaRow}>
                          <dt>Gradebook owner</dt>
                          <dd>{m.detail.owner}</dd>
                        </div>
                        <div className={styles.detailMetaRow}>
                          <dt>Status</dt>
                          <dd>Open · waiting on owner</dd>
                        </div>
                      </dl>
                    </div>
                    <hr className={styles.endMark} aria-hidden />
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

        <div className={styles.suggestions} aria-label="Reason categories">
          {CATEGORIES.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={category === value ? "default" : "outline"}
              size="sm"
              className={styles.suggestion}
              onClick={() => setCategory(category === value ? null : value)}
              aria-pressed={category === value}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className={styles.composer}>
          <div className={styles.inputRow}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                category
                  ? `Describe the ${REASON_LABELS[category].toLowerCase()} issue…`
                  : "Describe the reason…"
              }
              aria-label="Flag reason"
              rows={3}
              maxLength={2000}
              className={styles.input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className={styles.sendBtn}
              disabled={!canSend}
              onClick={handleSend}
              aria-label="File flag"
            >
              <ArrowUp aria-hidden />
            </Button>
          </div>
          <div className={styles.composerBar}>
            <Popover open={studentOpen} onOpenChange={setStudentOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`${styles.pickerBtn} ${student ? styles.pickerSet : ""}`}
                  aria-haspopup="dialog"
                  aria-expanded={studentOpen}
                >
                  <span className={styles.pickerLabel}>
                    {student
                      ? `${student.name} · ${sectionNameById.get(student.sectionId ?? "") ?? ""}`
                      : "Student"}
                  </span>
                  <ChevronDown className={styles.pickerChevron} aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className={styles.dropPanel} align="start">
                <Input
                  value={studentQ}
                  onChange={(e) => setStudentQ(e.target.value)}
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
                    {visibleStudents.map((s) => (
                      <tr
                        key={s.id}
                        className={`${styles.dropRow} ${s.id === studentId ? styles.dropRowActive : ""}`}
                        tabIndex={0}
                        onClick={() => {
                          setStudentId(s.id);
                          setStudentOpen(false);
                          if (selectedClass && selectedClass.sectionId !== s.sectionId) {
                            setClassKey("");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setStudentId(s.id);
                            setStudentOpen(false);
                            if (selectedClass && selectedClass.sectionId !== s.sectionId) {
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
                          {s.id === studentId ? <Check aria-hidden /> : null}
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
                    ) : visibleStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.dropDim}>
                          No students match.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PopoverContent>
            </Popover>

            <Popover open={classOpen} onOpenChange={setClassOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`${styles.pickerBtn} ${selectedClass ? styles.pickerSet : ""}`}
                  aria-haspopup="dialog"
                  aria-expanded={classOpen}
                >
                  <span className={styles.pickerLabel}>
                    {selectedClass
                      ? `${selectedClass.subjectName} · ${selectedClass.sectionName}`
                      : "Subject"}
                  </span>
                  <ChevronDown className={styles.pickerChevron} aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className={styles.dropPanel} align="start">
                <Input
                  value={classQ}
                  onChange={(e) => setClassQ(e.target.value)}
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
                    {visibleClasses.map((c) => {
                      const key = `${c.subjectId}|${c.sectionId}|${c.termId}`;
                      return (
                        <tr
                          key={key}
                          className={`${styles.dropRow} ${key === classKey ? styles.dropRowActive : ""}`}
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
                          <td className={styles.dropName}>{c.subjectName}</td>
                          <td className={styles.dropDim}>{c.ownerName ?? "—"}</td>
                          <td className={styles.dropCheck}>
                            {key === classKey ? <Check aria-hidden /> : null}
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
                    ) : visibleClasses.length === 0 ? (
                      <tr>
                        <td colSpan={3} className={styles.dropDim}>
                          {student
                            ? "No subjects for this student."
                            : "Pick a student to see their subjects."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className={styles.historyBtn}
              onClick={onHistory}
              aria-label="Flag history"
              title="Flag history"
            >
              <History aria-hidden />
            </Button>
          </div>
        </div>
        <p className={styles.hint}>
          {optionsQuery.isError
            ? "Could not load students and classes. Check your connection."
            : canSend && student && selectedClass
              ? `Ready to file — ${student.name} · ${selectedClass.subjectName} (${selectedClass.ownerName ?? "unassigned"})`
              : "Type a reason, pick a student, then pick one of their subjects."}
        </p>
      </div>
    </div>
  );
}
