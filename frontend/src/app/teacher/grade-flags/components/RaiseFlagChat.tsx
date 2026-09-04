"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ArrowUp, Bot, Check, ChevronDown } from "lucide-react";
import {
  REASON_LABELS,
  fetchFlagOptions,
  raiseFlag,
  type FlagReason,
} from "./grade-flags-data";
import styles from "./RaiseFlagChat.module.css";

interface ChatMessage {
  id: number;
  from: "assistant" | "user";
  text: string;
}

let messageId = 1;

const CATEGORIES = Object.entries(REASON_LABELS) as [FlagReason, string][];

export function RaiseFlagChat() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<FlagReason | null>(null);
  const [studentId, setStudentId] = useState("");
  const [classKey, setClassKey] = useState("");
  const [studentOpen, setStudentOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [studentQ, setStudentQ] = useState("");
  const [classQ, setClassQ] = useState("");
  const [sending, setSending] = useState(false);

  const optionsQuery = useQuery({
    queryKey: ["grade-flags", "options"],
    queryFn: fetchFlagOptions,
  });
  const students = useMemo(() => optionsQuery.data?.students ?? [], [optionsQuery.data]);
  const classes = useMemo(() => optionsQuery.data?.classes ?? [], [optionsQuery.data]);

  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.sectionId, c.sectionName);
    return map;
  }, [classes]);

  const selectedClass =
    classes.find((c) => `${c.subjectId}|${c.sectionId}|${c.termId}` === classKey) ?? null;
  const student = students.find((s) => s.id === studentId) ?? null;
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
      const filed = await raiseFlag({
        studentId: student.id,
        subjectId: selectedClass.subjectId,
        sectionId: selectedClass.sectionId,
        termId: selectedClass.termId,
        reason: category ?? "other",
        note: reason.trim(),
      });
      const detail = category ? `${REASON_LABELS[category]} — ${reason.trim()}` : reason.trim();
      setMessages((prev) => [
        ...prev,
        { id: messageId++, from: "user", text: detail },
        {
          id: messageId++,
          from: "assistant",
          text: `Flag filed — ${filed.student.name} (${filed.section.name}) · ${detail} · Owner: ${filed.owner?.fullName ?? "Unassigned"}. They'll be notified to review it.`,
        },
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
        <div className={styles.messages} aria-live="polite">
          {messages.map((m) =>
            m.from === "assistant" ? (
              <div key={m.id} className={styles.rowAssistant}>
                <span className={styles.botAvatar} aria-hidden>
                  <Bot className={styles.botIcon} />
                </span>
                <p className={styles.bubbleAssistant}>{m.text}</p>
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
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setStudentId(s.id);
                            setStudentOpen(false);
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
                    {visibleStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.dropDim}>
                          {optionsQuery.isPending ? "Loading…" : "No students match."}
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
                      : "Class"}
                  </span>
                  <ChevronDown className={styles.pickerChevron} aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className={styles.dropPanel} align="start">
                <Input
                  value={classQ}
                  onChange={(e) => setClassQ(e.target.value)}
                  placeholder="Search classes…"
                  aria-label="Search classes"
                  className={styles.dropSearch}
                />
                <table className={styles.dropTable}>
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col">Section</th>
                      <th scope="col">Term</th>
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
                          <td className={styles.dropDim}>{c.sectionName}</td>
                          <td className={styles.dropDim}>Term {c.termNumber}</td>
                          <td className={styles.dropCheck}>
                            {key === classKey ? <Check aria-hidden /> : null}
                          </td>
                        </tr>
                      );
                    })}
                    {visibleClasses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.dropDim}>
                          {optionsQuery.isPending ? "Loading…" : "No classes match."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <p className={styles.hint}>
          {optionsQuery.isError
            ? "Could not load students and classes. Check your connection."
            : canSend && student && selectedClass
              ? `Ready to file — ${student.name} · ${selectedClass.subjectName} ${selectedClass.sectionName}`
              : "Type a reason, then pick a student and a class to enable send."}
        </p>
      </div>
    </div>
  );
}
