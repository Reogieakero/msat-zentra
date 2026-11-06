"use client";

import { useEffect, type RefObject } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FolderCard } from "@/components/ui/FolderCard";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { BamaChatType, BamaConversation } from "./bama-conversations";
import { CATEGORY_COLORS } from "../../anecdotal/components/AnecdotalSideRail";
import { CATEGORIES, CATEGORY_TONES, TIERS } from "./bama-flow";
import type { AnecdotalFlow } from "./useAnecdotalFlow";
import type { Sf10AccessFlow } from "./useSf10AccessFlow";
import { TimePickers } from "./TimePickers";
import styles from "./bama-thread.module.css";
import dialogStyles from "./bama-flow-dialogs.module.css";

interface BamaThreadProps {
  active: BamaConversation | null;
  sending: boolean;
  flow: AnecdotalFlow;
  sf10Flow: Sf10AccessFlow;
  typeLabel: string;
  threadRef: RefObject<HTMLDivElement | null>;
  onStartChat: (type: BamaChatType) => void;
  onViewRecord: (recordId: string) => void;
}

const STARTERS: {
  key: BamaChatType;
  title: string;
  description: string;
  path: string;
  icon: typeof FileText;
  accent: string;
}[] = [
  {
    key: "anecdotal",
    title: "Anecdotal Record",
    description: "Write an incident report",
    path: "chat/anecdotal",
    icon: FileText,
    accent: "text-amber-500",
  },
  {
    key: "sf10-access",
    title: "SF10 Access",
    description: "Request SF10 read access",
    path: "chat/sf10-access",
    icon: FolderOpen,
    accent: "text-blue-500",
  },
];

function StarterColumnHead({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
      aria-label={title}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {icon} <span className="truncate">{title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">{action}</span>
    </div>
  );
}

/* Kanban column shell shared by every inline chat picker (student, class,
   category, tier, date, SF10 section/students) — matches the history rail
   and starter board: muted column, bordered head, white cards. */
const PICK_COLUMN =
  "flex min-w-0 w-full max-w-[30rem] self-center flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left [font-family:var(--font-inter)] dark:bg-muted/20";

const PICK_CARD =
  "flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card";

function PickColumnHead({
  icon,
  title,
  count,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
      aria-label={count !== undefined ? `${title}, ${count}` : title}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {icon} <span className="truncate">{title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {action ??
          (count !== undefined ? (
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{count}</span>
          ) : null)}
      </span>
    </div>
  );
}

export function BamaThread({
  active,
  sending,
  flow,
  sf10Flow,
  typeLabel,
  threadRef,
  onStartChat,
  onViewRecord,
}: BamaThreadProps) {
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, active?.id, sending, threadRef]);

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
  const sf10Open = !!active && active.type === "sf10-access" && !active.filed;
  const showSf10SectionPicker = sf10Open && sf10Flow.phase === "section";
  const showSf10StudentPicker = sf10Open && sf10Flow.phase === "students";

  if (!active) {
    return (
      <div className={styles.welcome}>
        <span className={styles.welcomeAvatar} aria-hidden>
          <StudentMascot name="Bama" character="crt" size={96} />
        </span>
        <h1 className={styles.welcomeTitle}>Chat with Bama</h1>
        <p className={styles.welcomeBody}>
          Pick what you need help with — your chats are grouped by type on the left.
        </p>
        <div className={styles.typeGrid} role="group" aria-label="Chat starter actions">
          {STARTERS.map((s) => {
            const StarterIcon = s.icon;
            return (
              <div
                key={s.key}
                className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left [font-family:var(--font-inter)] dark:bg-muted/20"
                aria-label={s.title}
              >
                <StarterColumnHead
                  icon={<StarterIcon size={14} aria-hidden className={s.accent} />}
                  title={s.title}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => onStartChat(s.key)}
                    >
                      Start
                    </Button>
                  }
                />
                <button
                  type="button"
                  onClick={() => onStartChat(s.key)}
                  aria-label={`Start ${s.title}`}
                  className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className="truncate font-mono text-[11px] font-medium text-muted-foreground"
                      title={s.path}
                    >
                      {s.path}
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      aria-hidden
                    >
                      <StarterIcon size={13} />
                    </span>
                  </span>
                  <span className="truncate text-sm font-semibold leading-snug" title={s.title}>
                    {s.title}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">{s.description}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.threadHead}>
        <p className={styles.threadTitle}>{active.title}</p>
        <span className="inline-flex shrink-0 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-amber-700 dark:text-amber-300">
          {typeLabel}
        </span>
      </div>
      <div ref={threadRef} className={styles.thread} aria-live="polite" aria-label="Messages">
        {active.messages.map((m) =>
          m.from === "assistant" ? (
            <div key={m.id} className={styles.rowAssistant}>
              <span className={styles.avatar} aria-hidden>
                <StudentMascot name="Bama" character="crt" size={40} />
              </span>
              <div className={styles.assistantCol}>
                <p className={styles.bubbleAssistant}>{m.text}</p>
                {m.preview ? (
                  <div
                    className={PICK_COLUMN.replace(" self-center", " self-start")}
                    aria-label="Review before filing"
                  >
                    <PickColumnHead
                      icon={<ClipboardCheck size={14} aria-hidden className="text-amber-500" />}
                      title="Review before filing"
                      action={
                        <span className="inline-flex shrink-0 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-amber-700 dark:text-amber-300">
                          {m.preview.section}
                        </span>
                      }
                    />
                    <div className={`${PICK_CARD} cursor-default`}>
                      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Student
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">
                          {m.preview.studentName}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {m.preview.lrn}
                        </span>
                      </span>
                    </div>
                    <div className={`${PICK_CARD} cursor-default`}>
                      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Details
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {m.preview.category}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {m.preview.tier}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {m.preview.observationDateTime}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {m.preview.location}
                        </span>
                      </span>
                    </div>
                    <div className={`${PICK_CARD} cursor-default`}>
                      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Incident
                      </span>
                      <span className="text-sm text-foreground">{m.preview.incident}</span>
                    </div>
                    {m.preview.notes ? (
                      <div className={`${PICK_CARD} cursor-default`}>
                        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Notes
                        </span>
                        <span className="text-sm text-foreground">{m.preview.notes}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        className="h-6 px-3 text-[11px]"
                        disabled={flow.filing || !flow.canFile}
                        onClick={() => void flow.fileRecord()}
                      >
                        {flow.filing ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                        ) : null}
                        {flow.filing ? "Filing…" : "File record"}
                      </Button>
                    </div>
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
                        {m.sf10Preview ? (
                          <div
                            className={PICK_COLUMN.replace(" self-center", " self-start")}
                            aria-label="Review before submitting"
                          >
                            <PickColumnHead
                              icon={<ClipboardCheck size={14} aria-hidden className="text-amber-500" />}
                              title="Review before submitting"
                              action={
                                <span className="inline-flex shrink-0 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-amber-700 dark:text-amber-300">
                                  {m.sf10Preview.section} · {m.sf10Preview.gradeLevel}
                                </span>
                              }
                            />
                            <div className={`${PICK_CARD} cursor-default`}>
                              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                Students
                              </span>
                              <span className="text-sm font-medium text-foreground">
                                {m.sf10Preview.studentCount} selected
                              </span>
                            </div>
                            <div className={`${PICK_CARD} cursor-default`}>
                              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                Names
                              </span>
                              <span className="flex flex-wrap gap-1.5">
                                {m.sf10Preview.studentNames.slice(0, 8).map((n, i) => (
                                  <span
                                    key={`${n}-${i}`}
                                    className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                                  >
                                    {n}
                                  </span>
                                ))}
                                {m.sf10Preview.studentNames.length > 8 ? (
                                  <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    +{m.sf10Preview.studentNames.length - 8} more
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <div className={`${PICK_CARD} cursor-default`}>
                              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                Reason
                              </span>
                              <span className="text-sm text-foreground">{m.sf10Preview.reason}</span>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-6 px-3 text-[11px]"
                                disabled={sf10Flow.submitting || !!active.filed}
                                onClick={() => sf10Flow.editReason()}
                              >
                                Edit reason
                              </Button>
                              <Button
                                type="button"
                                className="h-6 px-3 text-[11px]"
                                disabled={sf10Flow.submitting || !sf10Flow.canSubmit || !!active.filed}
                                onClick={() => sf10Flow.submitRequest()}
                              >
                                {sf10Flow.submitting ? (
                                  <Loader2 size={16} className="animate-spin" aria-hidden />
                                ) : null}
                                {sf10Flow.submitting ? "Submitting…" : "Submit request"}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {m.sf10Detail ? (
                          <div className={styles.filedCard}>
                            <p className={styles.filedHead}>
                              <Check aria-hidden /> Request submitted · {m.sf10Detail.section}
                            </p>
                            <p className={styles.filedText}>
                              {m.sf10Detail.studentCount} student{m.sf10Detail.studentCount === 1 ? "" : "s"} · pending verification by the records desk.
                            </p>
                            <Button type="button" variant="outline" size="sm" asChild>
                              <Link href="/teacher/advisory/sf10-access">
                                Track in SF10 Access
                              </Link>
                            </Button>
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
              <StudentMascot name="Bama" character="crt" size={40} />
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
          <div className={PICK_COLUMN} aria-label="Pick a student">
            <PickColumnHead
              icon={<Users size={14} aria-hidden className="text-amber-500" />}
              title="Pick a student"
              count={flow.optionsPending ? undefined : flow.studentMatches.length}
            />
            <p className="m-0 px-1 text-xs leading-snug text-muted-foreground">
              Who is this anecdotal report for?
            </p>
            <input
              type="search"
              value={flow.studentQ}
              onChange={(e) => flow.setStudentQ(e.target.value)}
              placeholder="Search name, LRN, or section…"
              aria-label="Search students"
              className={dialogStyles.pickerSearch}
            />
            <div
              className={dialogStyles.kanbanList}
              role="listbox"
              aria-label="Students"
            >
              {flow.optionsPending ? (
                <div aria-busy="true" aria-label="Loading students" className="flex flex-col gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
                      aria-hidden="true"
                    >
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
                    className={PICK_CARD}
                    onClick={() => flow.handleStudentPick(s.id)}
                  >
                    <span className={dialogStyles.pickerName}>{s.name}</span>
                    <span className={dialogStyles.pickerMeta}>{s.lrn}</span>
                  </button>
                ))
              )}
            </div>
            {flow.studentMatches.length > flow.studentRows.length ? (
              <p className={dialogStyles.pickerMore}>
                {flow.studentMatches.length - flow.studentRows.length} more — refine your search.
              </p>
            ) : null}
          </div>
        ) : null}
        {showClassPicker ? (
          <div className={PICK_COLUMN} aria-label="Pick a class">
            <PickColumnHead
              icon={<BookOpen size={14} aria-hidden className="text-amber-500" />}
              title="Pick a class"
              count={flow.classes.length}
            />
            <p className="m-0 px-1 text-xs leading-snug text-muted-foreground">
              Which class is this report for?
            </p>
            <div
              className={dialogStyles.kanbanOptions}
              role="listbox"
              aria-label="Classes"
            >
              {flow.classes.map((c) => {
                const value = `${c.subjectId}|${c.sectionId}|${c.termId}`;
                return (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={PICK_CARD}
                    onClick={() => flow.handleClassPick(value)}
                  >
                    <span className={dialogStyles.pickerName}>{c.subjectName}</span>
                    <span className={dialogStyles.pickerMeta}>{c.sectionName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {showCategoryPicker ? (
          <div className={PICK_COLUMN} aria-label="Pick a category">
            <PickColumnHead
              icon={<Tags size={14} aria-hidden className="text-amber-500" />}
              title="Pick a category"
              count={CATEGORIES.length}
            />
            <p className="m-0 px-1 text-xs leading-snug text-muted-foreground">
              What is the category for this report?
            </p>
            <div className={dialogStyles.kanbanOptions} role="listbox" aria-label="Categories">
              {CATEGORIES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={PICK_CARD}
                  onClick={() => flow.handleCategoryPick(value)}
                >
                  <span className={dialogStyles.pickerName}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {showTierPicker ? (
          <div className={PICK_COLUMN} aria-label="Pick a confidentiality tier">
            <PickColumnHead
              icon={<ShieldCheck size={14} aria-hidden className="text-amber-500" />}
              title="Pick a confidentiality tier"
              count={TIERS.length}
            />
            <p className="m-0 px-1 text-xs leading-snug text-muted-foreground">
              What is the confidentiality tier?
            </p>
            <div className={dialogStyles.kanbanOptions} role="listbox" aria-label="Confidentiality tiers">
              {TIERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={PICK_CARD}
                  onClick={() => flow.handleTierPick(value)}
                >
                  <span className={dialogStyles.pickerName}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {showDatetimePicker ? (
          <div className={PICK_COLUMN} aria-label="Pick the incident date">
            <PickColumnHead
              icon={<CalendarDays size={14} aria-hidden className="text-amber-500" />}
              title="Pick the incident date"
            />
            <p className="m-0 px-1 text-xs leading-snug text-muted-foreground">
              When did this happen?
            </p>
            <div className={dialogStyles.datetimeRow}>
              <div className={dialogStyles.datetimeField}>
                <span className={dialogStyles.datetimeLabel}>
                  <CalendarDays aria-hidden /> Date
                </span>
                <Popover open={flow.datePopoverOpen} onOpenChange={flow.setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 font-normal"
                      aria-haspopup="dialog"
                      aria-expanded={flow.datePopoverOpen}
                    >
                      <CalendarDays
                        size={14}
                        aria-hidden
                        className="shrink-0 text-muted-foreground"
                      />
                      <span
                        className={`truncate ${flow.dateInput ? "" : "text-muted-foreground"}`}
                      >
                        {flow.dateInput
                          ? format(new Date(`${flow.dateInput}T00:00:00`), "PPP")
                          : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto">
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
                  onChange={flow.setTimeInput}
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
        {showSf10SectionPicker ? (
          <div className={PICK_COLUMN} aria-label="Pick an advisory section">
            <PickColumnHead
              icon={<FolderOpen size={14} aria-hidden className="text-amber-500" />}
              title="Pick a section"
              count={sf10Flow.rosterPending ? undefined : sf10Flow.sections.length}
            />
            <p className="m-0 px-1 text-xs leading-snug text-muted-foreground">
              Which advisory section is this SF10 request for?
            </p>
            {sf10Flow.rosterPending ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading sections">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : sf10Flow.sections.length === 0 ? (
              <p className={dialogStyles.pickerEmpty}>
                No advisory section assigned, or it could not be loaded. Contact the school office.
              </p>
            ) : (
              <div className={dialogStyles.kanbanOptions} role="listbox" aria-label="Advisory sections">
                {sf10Flow.sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={PICK_CARD}
                    onClick={() => sf10Flow.handleSectionPick(s.id)}
                  >
                    <span className={dialogStyles.pickerName}>{s.name}</span>
                    <span className={dialogStyles.pickerMeta}>{s.gradeLevel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {showSf10StudentPicker ? (
          <div className={PICK_COLUMN} aria-label="Pick students for SF10 access">
            <PickColumnHead
              icon={<Users size={14} aria-hidden className="text-amber-500" />}
              title={`Pick students (${sf10Flow.pickedCount} of ${sf10Flow.candidateCount} selected)`}
              count={sf10Flow.rosterPending ? undefined : sf10Flow.candidateCount}
            />
            <p className="m-0 px-1 text-xs leading-snug text-muted-foreground">
              Toggle advisees, then press Done to continue.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={sf10Flow.selectAll}
              >
                Select all
              </Button>
            </div>
            <input
              type="search"
              value={sf10Flow.studentQ}
              onChange={(e) => sf10Flow.setStudentQ(e.target.value)}
              placeholder="Search name or LRN…"
              aria-label="Search students"
              className={dialogStyles.pickerSearch}
            />
            <div
              className={dialogStyles.kanbanList}
              role="listbox"
              aria-label="Advisees"
              aria-multiselectable="true"
            >
              {sf10Flow.rosterPending ? (
                <div aria-busy="true" aria-label="Loading students" className="flex flex-col gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
                      aria-hidden="true"
                    >
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : sf10Flow.studentRows.length === 0 ? (
                <p className={dialogStyles.pickerEmpty}>No students match.</p>
              ) : (
                sf10Flow.studentRows.map((s) => {
                  const picked = sf10Flow.pickedLrns.includes(s.lrn);
                  return (
                    <button
                      key={s.lrn}
                      type="button"
                      role="option"
                      aria-selected={picked}
                      onClick={() => sf10Flow.toggleLrn(s.lrn)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors hover:border-primary/60 hover:shadow dark:bg-card"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${picked ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
                      >
                        {picked ? <Check size={12} aria-hidden /> : null}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={dialogStyles.pickerName}>{s.name}</span>
                        <span className={dialogStyles.pickerMeta}>{s.lrn}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {sf10Flow.studentMatches.length > sf10Flow.studentRows.length ? (
              <p className={dialogStyles.pickerMore}>
                {sf10Flow.studentMatches.length - sf10Flow.studentRows.length} more — refine your search.
              </p>
            ) : null}
            <Button
              type="button"
              disabled={sf10Flow.pickedCount === 0}
              onClick={sf10Flow.handleStudentsDone}
            >
              Done — {sf10Flow.pickedCount} selected
            </Button>
          </div>
        ) : null}
        {flow.flowError ? <p className={styles.flowError}>{flow.flowError}</p> : null}
        {sf10Open && sf10Flow.flowError ? <p className={styles.flowError}>{sf10Flow.flowError}</p> : null}
      </div>
    </>
  );
}
