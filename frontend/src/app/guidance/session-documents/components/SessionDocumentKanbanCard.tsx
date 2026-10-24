"use client";

import * as React from "react";
import Link from "next/link";
import { FolderCard, type FolderFile } from "@/components/ui/FolderCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Pill, type PillTone } from "@/components/ui/pill";
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Hash,
  Images,
} from "lucide-react";
import type { GuidanceAnecdotalRecord } from "@/services/guidance/anecdotal.types";
import { ANECDOTAL_CATEGORY_COLORS } from "@/app/guidance/referrals/components/guidance-referrals-format";
import {
  docSlipsFor,
  isImageMime,
  SESSION_KIND_LABEL,
  sessionKindOf,
} from "./session-doc-slips";

/* Category colour coding shared with the referrals / anecdotal pages. */
const CATEGORY_TONE: Record<string, PillTone> = {
  behavioral: "amber",
  bullying: "red",
  academic: "blue",
  attendance: "green",
  health: "violet",
};

const PILL_FIT = "min-w-0 max-w-full overflow-hidden";

const ACCENT_FILES = "text-violet-500";
const ACCENT_SESSIONS = "text-blue-500";
const ACCENT_CASE = "text-amber-500";

/* Right-side detail trigger — each icon floats its content as a kanban board. */
const ICON_BTN =
  "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted hover:text-foreground";

function DetailPop({
  icon,
  accent,
  ariaLabel,
  boardTitle,
  description,
  children,
}: {
  icon: React.ReactNode;
  accent: string;
  ariaLabel: string;
  boardTitle: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={ICON_BTN} aria-label={ariaLabel}>
          <span className={accent} aria-hidden>
            {icon}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <KanbanBoard
          className="bg-card"
          title={boardTitle}
          icon={
            <span className={accent} aria-hidden>
              {icon}
            </span>
          }
          description={description}
        >
          {children}
        </KanbanBoard>
      </PopoverContent>
    </Popover>
  );
}

function isEndorsedCase(type: string | undefined, status: string): boolean {
  return type === "ADM" && status === "in_progress";
}

function statusLabel(record: GuidanceAnecdotalRecord): string {
  if (isEndorsedCase(record.referralType, record.referralStatus)) return "Endorsed";
  switch (record.referralStatus) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Closed";
    case "escalated":
      return "Sent higher up";
    case "follow_up":
      return "Follow-up";
    case "info_requested":
      return "Needs more info";
    default:
      return record.referralStatus;
  }
}

function statusTone(record: GuidanceAnecdotalRecord): PillTone {
  if (isEndorsedCase(record.referralType, record.referralStatus)) return "green";
  switch (record.referralStatus) {
    case "pending":
      return "amber";
    case "in_progress":
      return "blue";
    case "resolved":
      return "green";
    case "dismissed":
      return "neutral";
    case "escalated":
      return "red";
    case "follow_up":
      return "violet";
    case "info_requested":
      return "blue";
    default:
      return "neutral";
  }
}

function categoryTone(category: string): PillTone {
  return CATEGORY_TONE[category.trim().toLowerCase()] ?? "neutral";
}

function folderColorFor(record: GuidanceAnecdotalRecord): string | undefined {
  if (record.referralType === "ADM") return ANECDOTAL_CATEGORY_COLORS[record.category];
  if (record.hasInterventionDocs) return "var(--primary)";
  return "#f59e0b";
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value || "—";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface SessionWithDocs {
  id: string;
  kind: ReturnType<typeof sessionKindOf>;
  date: string;
  imageCount: number;
  startIndex: number;
}

/**
 * Guidance session-documents kanban card — one folder per referred student,
 * drawn with the nurse health-record anatomy. The record's contents (filed
 * images, session list, case info) sit behind the right-side icon buttons;
 * clicking one opens a kanban board with that content.
 */
export function SessionDocumentKanbanCard({
  record,
  onOpenImage,
}: {
  record: GuidanceAnecdotalRecord;
  onOpenImage: (record: GuidanceAnecdotalRecord, index: number) => void;
}) {
  const docs = React.useMemo(() => docSlipsFor(record, 50), [record]);

  const sessions = React.useMemo<SessionWithDocs[]>(() => {
    const counts = (record.sessionDocs ?? []).map((session) => ({
      id: session.sessionId,
      kind: sessionKindOf(session.sessionType),
      date: session.date,
      imageCount: session.files.filter((f) => isImageMime(f.mimeType)).length,
    }));
    return counts.map((session, index) => ({
      ...session,
      startIndex: counts
        .slice(0, index)
        .reduce((sum, item) => sum + item.imageCount, 0),
    }));
  }, [record.sessionDocs]);

  const tiedSessions = sessions.filter((session) => session.imageCount > 0);
  const isAdm = record.referralType === "ADM";
  const isFollowUp = record.referralStatus === "follow_up";
  const followUpHref = isAdm
    ? `/guidance/referrals/adm?highlight=${encodeURIComponent(record.referralId)}`
    : `/guidance/referrals/counseling?highlight=${encodeURIComponent(record.referralId)}`;
  const title = isAdm
    ? "ADM consultation"
    : record.hasInterventionDocs
      ? "Intervention session documents"
      : "Counseling session documents";

  const typeColor = isAdm
    ? "#3b82f6"
    : record.hasInterventionDocs
      ? "var(--primary)"
      : "#f59e0b";

  const section = record.section || "—";
  const gradeLevel = record.grade && record.grade !== "—" ? record.grade : "Grade level";

  const files: FolderFile[] = docs.slice(0, 5).map((doc) => doc.file);

  const openFirst = () => {
    if (docs.length > 0) onOpenImage(record, 0);
  };

  return (
    <article
      role="listitem"
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-muted/20"
    >
      <header className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <FileText size={14} aria-hidden style={{ color: typeColor }} />
          <span className="truncate">{title}</span>
        </span>
        <Pill tone={statusTone(record)} label="Status" className="shrink-0">
          {statusLabel(record)}
        </Pill>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="min-w-0 max-w-full truncate text-[14px] font-semibold leading-tight">
            {record.student}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Pill label="LRN" className="tabular-nums">
              {record.lrn || "—"}
            </Pill>
            <Pill tone="amber" label={gradeLevel} className={PILL_FIT}>
              <span className="truncate">{section}</span>
            </Pill>
          </span>
        </span>

        <span className="flex w-full items-center justify-between gap-3">
          <FolderCard
            folderColor={folderColorFor(record)}
            files={files}
            onFileClick={(index) => onOpenImage(record, index)}
            onCardClick={openFirst}
            cardAriaLabel={`Browse ${record.student}'s session documents`}
          />
          <StudentMascot name={record.student} seed={record.lrn} size={96} />
        </span>

        {/* Folder → meta pills: 32px total (8px column gap + 24px push). */}
        <span className="mt-6 flex min-w-0 flex-wrap items-center gap-1.5">
          <Pill tone="blue" label="Referral type">
            {record.referralType ?? "Counseling"}
          </Pill>
          <Pill tone={categoryTone(record.category)} label="Category">
            {humanize(record.category)}
          </Pill>
          <Pill label="Date filed">{formatDate(record.date)}</Pill>
        </span>

        {/* Right-side contents — each icon opens its content as a board. */}
        <span className="mt-auto flex min-w-0 items-center justify-end gap-1.5 pt-0.5">
          {isFollowUp ? (
            <Link
              href={followUpHref}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
            >
              Follow up
              <ArrowRight size={12} aria-hidden />
            </Link>
          ) : null}
          {docs.length > 0 ? (
            <DetailPop
              icon={<Images size={13} aria-hidden />}
              accent={ACCENT_FILES}
              ariaLabel={`Show the filed images for ${record.student}`}
              boardTitle="Session files"
              description={`${docs.length} image${docs.length === 1 ? "" : "s"} filed across ${tiedSessions.length} session${tiedSessions.length === 1 ? "" : "s"}.`}
            >
              <ul className="m-0 flex max-h-64 list-none flex-col gap-1.5 overflow-y-auto p-0">
                {docs.map((doc, index) => (
                  <li key={doc.image.id}>
                    <button
                      type="button"
                      onClick={() => onOpenImage(record, index)}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11px] transition-colors hover:border-primary/60 hover:bg-muted"
                      title={`${doc.file.tag} · ${doc.image.fileName}`}
                    >
                      <Images
                        size={12}
                        className="shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {doc.image.fileName}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {doc.file.tag}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </DetailPop>
          ) : null}

          {tiedSessions.length > 0 ? (
            <DetailPop
              icon={<CalendarClock size={13} aria-hidden />}
              accent={ACCENT_SESSIONS}
              ariaLabel={`Show the sessions for ${record.student}`}
              boardTitle="Sessions"
              description="Sessions that have filed images."
            >
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {tiedSessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => onOpenImage(record, session.startIndex)}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11px] transition-colors hover:border-primary/60 hover:bg-muted"
                    >
                      <CalendarClock
                        size={12}
                        className="shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {SESSION_KIND_LABEL[session.kind]} · {formatDate(session.date)}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {session.imageCount} image{session.imageCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </DetailPop>
          ) : null}

          <DetailPop
            icon={<Hash size={13} aria-hidden />}
            accent={ACCENT_CASE}
            ariaLabel={`Show the case information for ${record.student}`}
            boardTitle="Case information"
            description="The referral behind these session files."
          >
            <dl className="m-0 flex flex-col gap-1.5 px-1 text-[12px] leading-relaxed">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Referred as</dt>
                <dd>
                  <Pill tone={isAdm ? "blue" : "green"} label="Referral type">
                    {record.referralType ?? "Counseling"}
                  </Pill>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Category</dt>
                <dd>
                  <Pill tone={categoryTone(record.category)} label="Category">
                    {humanize(record.category)}
                  </Pill>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Pill tone={statusTone(record)} label="Status">
                    {statusLabel(record)}
                  </Pill>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Case date</dt>
                <dd>
                  <Pill label="Case date">{formatDate(record.date)}</Pill>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Referred by</dt>
                <dd className="text-right">{record.referredBy || "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Observer</dt>
                <dd className="text-right">{record.observer || "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Confidentiality</dt>
                <Pill tone="violet" label="Confidentiality">
                  {humanize(record.confidentiality)}
                </Pill>
              </div>
            </dl>
          </DetailPop>
        </span>
      </div>
    </article>
  );
}
