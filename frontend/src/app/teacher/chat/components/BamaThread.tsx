"use client";

import { useEffect, useRef, type RefObject } from "react";
import { format } from "date-fns";
import { CalendarDays, Cat, Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FolderCard } from "@/components/ui/FolderCard";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { BamaChatType, BamaConversation } from "./bama-conversations";
import { CATEGORY_COLORS } from "../../anecdotal/components/AnecdotalSideRail";
import { CATEGORIES, CATEGORY_TONES, TIERS } from "./bama-flow";
import type { AnecdotalFlow } from "./useAnecdotalFlow";
import { TimePickers } from "./TimePickers";
import styles from "./bama-thread.module.css";
import dialogStyles from "./bama-flow-dialogs.module.css";

interface BamaThreadProps {
  active: BamaConversation | null;
  sending: boolean;
  flow: AnecdotalFlow;
  typeLabel: string;
  threadRef: RefObject<HTMLDivElement | null>;
  onStartChat: (type: BamaChatType) => void;
  onViewRecord: (recordId: string) => void;
}

export function BamaThread({
  active,
  sending,
  flow,
  typeLabel,
  threadRef,
  onStartChat,
  onViewRecord,
}: BamaThreadProps) {
  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, active?.id, sending, threadRef]);

  // Inline picker cards (no overlay modals) — each step shows until answered.
  const pickListRef = useRef<HTMLDivElement | null>(null);
  const classListRef = useRef<HTMLDivElement | null>(null);
  const anecOpen = !!active && active.type === "anecdotal" && !active.filed;
  const showStudentPicker = anecOpen && flow.studentId === "";
  const showClassPicker =
    anecOpen && flow.studentId !== "" && flow.selectedClass === null && flow.classes.length > 0;
  const showCategoryPicker =
    anecOpen && flow.selectedClass !== null && flow.category === null;
  const showTierPicker =
    anecOpen && flow.category !== null && flow.tier === null;
  const showDatetimePicker =
    anecOpen && flow.tier !== null && flow.observationDate === null;

  if (!active) {
    return (
      <div className={styles.welcome}>
        <span className={styles.welcomeAvatar} aria-hidden>
          <Cat />
        </span>
        <h1 className={styles.welcomeTitle}>Chat with Bama</h1>
        <p className={styles.welcomeBody}>
          Pick what you need help with — your chats are grouped by type on the left.
        </p>
        <div className={styles.typeGrid}>
          <button type="button" className={styles.typeCard} onClick={() => onStartChat("grade-flag")}>
            <span className={styles.typeName}>Grade Flag</span>
            <span className={styles.typeSub}>Raise a grade concern</span>
          </button>
          <button type="button" className={styles.typeCard} onClick={() => onStartChat("anecdotal")}>
            <span className={styles.typeName}>Anecdotal Record</span>
            <span className={styles.typeSub}>Write an incident report</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.threadHead}>
        <p className={styles.threadTitle}>{active.title}</p>
        <Badge variant="secondary">{typeLabel}</Badge>
      </div>
      <div ref={threadRef} className={styles.thread} aria-live="polite" aria-label="Messages">
        {active.messages.map((m) =>
          m.from === "assistant" ? (
            <div key={m.id} className={styles.rowAssistant}>
              <span className={styles.avatar} aria-hidden>
                <Cat />
              </span>
              <div className={styles.assistantCol}>
                <p className={styles.bubbleAssistant}>{m.text}</p>
                {m.preview ? (
                  <div className={styles.reviewCard}>
                    <p className={styles.reviewHead}>Review before filing</p>
                    <dl className={styles.reviewRows}>
                      <div><dt>Student</dt><dd>{m.preview.studentName} · {m.preview.lrn}</dd></div>
                      <div><dt>Section</dt><dd>{m.preview.section}</dd></div>
                      <div><dt>Category</dt><dd>{m.preview.category}</dd></div>
                      <div><dt>Confidentiality</dt><dd>{m.preview.tier}</dd></div>
                      <div><dt>Observed</dt><dd>{m.preview.observationDateTime}</dd></div>
                      <div><dt>Location</dt><dd>{m.preview.location}</dd></div>
                      <div><dt>Incident</dt><dd>{m.preview.incident}</dd></div>
                      {m.preview.notes ? <div><dt>Notes</dt><dd>{m.preview.notes}</dd></div> : null}
                    </dl>
                    <Button
                      type="button"
                      className={styles.fileBtn}
                      disabled={flow.filing || !flow.canFile}
                      onClick={() => flow.setConfirmFiling(true)}
                    >
                      File record
                    </Button>
                  </div>
                ) : null}
                        {m.detail ? (
                          <div className={styles.filedCard}>
                            <button
                              type="button"
                              className={`${styles.folderDrop} ${styles.folderButton}`}
                              onClick={() => onViewRecord(m.detail!.recordId)}
                              aria-label={`Open ${m.detail.studentName}'s anecdotal record`}
                            >
                              <FolderCard
                                label={m.detail.studentName}
                                sublabel={`${m.detail.category} · ${m.detail.observationDateTime}`}
                                folderColor={CATEGORY_COLORS[m.detail.category.toLowerCase()]}
                                files={[
                                  {
                                    name: "GCForm-01",
                                    tag: m.detail.category,
                                    tone: CATEGORY_TONES[m.detail.category.toLowerCase()] ?? 1,
                                    icon: "doc",
                                  },
                                ]}
                              />
                            </button>
                            <p className={styles.filedHead}>
                              <Check aria-hidden /> Filed · {m.detail.category} · {m.detail.observationDateTime}
                            </p>
                            <p className={styles.filedText}>{m.detail.incident}</p>
                          </div>
                        ) : null}
              </div>
            </div>
          ) : (
            <div key={m.id} className={styles.rowUser}>
              <p className={styles.bubbleUser}>{m.text}</p>
            </div>
          )
        )}
        {sending ? (
          <div className={styles.rowAssistant} aria-label="Bama is typing">
            <span className={styles.avatar} aria-hidden>
              <Cat />
            </span>
            <p className={styles.bubbleAssistant}>
              <span className={styles.typing} aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </p>
          </div>
        ) : null}
        {showStudentPicker ? (
          <div className={`${assign.card} ${styles.pickCard}`} aria-label="Pick a student">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className={styles.pickHead}>
              <p className={styles.pickTitle}>Pick a student</p>
              <p className={styles.pickDesc}>Who is this anecdotal report for?</p>
            </div>
            <input
              type="search"
              value={flow.studentQ}
              onChange={(e) => flow.setStudentQ(e.target.value)}
              placeholder="Search name, LRN, or section…"
              aria-label="Search students"
              className={dialogStyles.pickerSearch}
            />
            <div className={styles.pickListWrap}>
              <div
                ref={pickListRef}
                className={`${dialogStyles.pickerList} ${dialogStyles.noScrollbar} pb-8`}
                role="listbox"
                aria-label="Students"
              >
                {flow.optionsPending ? (
                  <div aria-busy="true" aria-label="Loading students">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={dialogStyles.pickerItem} aria-hidden="true">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : flow.studentRows.length === 0 ? (
                  <p className={dialogStyles.pickerEmpty}>No students match.</p>
                ) : (
                  flow.studentRows.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className={dialogStyles.pickerItem}
                      onClick={() => flow.handleStudentPick(s.id)}
                    >
                      <span className={dialogStyles.pickerName}>{s.name}</span>
                      <span className={dialogStyles.pickerMeta}>{s.lrn}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-popover via-popover/85 to-transparent pt-8 pb-1">
                <ScrollDownHint
                  scrollRef={pickListRef}
                  watchKey={`${flow.studentRows.length}:${flow.studentQ}`}
                  always
                  className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
                />
              </div>
            </div>
            {flow.studentMatches.length > flow.studentRows.length ? (
              <p className={dialogStyles.pickerMore}>
                {flow.studentMatches.length - flow.studentRows.length} more — refine your search.
              </p>
            ) : null}
          </div>
        ) : null}
        {showClassPicker ? (
          <div className={`${assign.card} ${styles.pickCard}`} aria-label="Pick a class">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className={styles.pickHead}>
              <p className={styles.pickTitle}>Pick a class</p>
              <p className={styles.pickDesc}>Which class is this report for?</p>
            </div>
            <div className={styles.pickListWrap}>
              <div
                ref={classListRef}
                className={`${dialogStyles.dialogOptions} ${dialogStyles.noScrollbar} pb-8`}
                role="listbox"
                aria-label="Classes"
              >
                {flow.classes.map((c) => {
                  const value = `${c.subjectId}|${c.sectionId}|${c.termId}`;
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      className={dialogStyles.dialogOption}
                      onClick={() => flow.handleClassPick(value)}
                    >
                      {c.subjectName} · {c.sectionName}
                    </Button>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-popover via-popover/85 to-transparent pt-8 pb-1">
                <ScrollDownHint
                  scrollRef={classListRef}
                  watchKey={flow.classes.length}
                  always
                  className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
                />
              </div>
            </div>
          </div>
        ) : null}
        {showCategoryPicker ? (
          <div className={`${assign.card} ${styles.pickCard}`} aria-label="Pick a category">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className={styles.pickHead}>
              <p className={styles.pickTitle}>Pick a category</p>
              <p className={styles.pickDesc}>What is the category for this report?</p>
            </div>
            <div className={dialogStyles.dialogOptions} role="listbox" aria-label="Categories">
              {CATEGORIES.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  className={dialogStyles.dialogOption}
                  onClick={() => flow.handleCategoryPick(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {showTierPicker ? (
          <div className={`${assign.card} ${styles.pickCard}`} aria-label="Pick a confidentiality tier">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className={styles.pickHead}>
              <p className={styles.pickTitle}>Pick a confidentiality tier</p>
              <p className={styles.pickDesc}>What is the confidentiality tier?</p>
            </div>
            <div className={dialogStyles.dialogOptions} role="listbox" aria-label="Confidentiality tiers">
              {TIERS.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  className={dialogStyles.dialogOption}
                  onClick={() => flow.handleTierPick(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {showDatetimePicker ? (
          <div className={`${assign.card} ${styles.pickCard}`} aria-label="Pick the incident date">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className={styles.pickHead}>
              <p className={styles.pickTitle}>Pick the incident date</p>
              <p className={styles.pickDesc}>When did this happen?</p>
            </div>
            <div className={dialogStyles.datetimeRow}>
              <div className={dialogStyles.datetimeField}>
                <span className={dialogStyles.datetimeLabel}>
                  <CalendarDays aria-hidden /> Date
                </span>
                <Popover open={flow.datePopoverOpen} onOpenChange={flow.setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={dialogStyles.dateBtn}
                      aria-haspopup="dialog"
                      aria-expanded={flow.datePopoverOpen}
                    >
                      <span className={dialogStyles.dateBtnValue}>{flow.dateInput || "Pick a date"}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Calendar
                      mode="single"
                      selected={flow.dateInput ? new Date(`${flow.dateInput}T00:00:00`) : undefined}
                      defaultMonth={flow.dateInput ? new Date(`${flow.dateInput}T00:00:00`) : new Date()}
                      disabled={{ after: new Date() }}
                      onSelect={(day) => {
                        if (day) {
                          flow.setDateInput(format(day, "yyyy-MM-dd"));
                          flow.setDatePopoverOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className={dialogStyles.datetimeField}>
                <span className={dialogStyles.datetimeLabel}>
                  <Clock aria-hidden /> Time
                </span>
                <TimePickers
                  value={flow.timeInput}
                  onPick={(h, m, ap) => flow.setTimeParts(h, m, ap)}
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={!flow.dateInput}
              onClick={flow.handleDatetimeConfirm}
            >
              Confirm date
            </Button>
          </div>
        ) : null}
        {flow.flowError ? <p className={styles.flowError}>{flow.flowError}</p> : null}
      </div>
    </>
  );
}
