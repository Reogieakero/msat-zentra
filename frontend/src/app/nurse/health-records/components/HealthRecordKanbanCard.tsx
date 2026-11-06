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
import {
  ArrowRight,
  FileText,
  Hash,
  Images,
  MessageSquareText,
  Target,
} from "lucide-react";
import {
  anecdotalCategoryPillClass,
  formatDate,
} from "../../referrals/components/nurse-referrals-format";
import {
  entryStatusLabel,
  entryStatusVariant,
  fileHref,
  formatBytes,
  type DocEntry,
} from "./documentaries-utils";
import {
  ACCENT_CASE,
  ACCENT_FILES,
  ACCENT_NOTES,
  ACCENT_OUTCOME,
  BOARD_PILL,
  statusToneClass,
  TONE_AMBER,
  TONE_BLUE,
  TONE_GREEN,
  TONE_VIOLET,
  TYPE_COLORS,
  TYPE_TONES,
} from "./record-tones";

/* Same pill recipe as the anecdotal shared folder card (student = amber,
   meta = secondary). */
const PILL_NAME =
  "inline-flex max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-400";
const PILL_META =
  "inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-tight text-secondary-foreground";

/* Right-side detail trigger — clicking floats the content as a kanban board
   beside the card (same icon language as the nurse case cards). */
const ICON_BTN =
  "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted hover:text-foreground";

/** Icon button whose content opens as a kanban board on click. */
function DetailPop({
  icon,
  accent,
  ariaLabel,
  boardTitle,
  description,
  children,
}: {
  icon: React.ReactNode;
  /** Colour for the board title's left icon (and matching pill tone). */
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

/**
 * Nurse health-records kanban card — one finished clinic session or resolved
 * case, drawn with the anecdotal folder-card anatomy. The record's contents
 * (session notes, outcome, documentation files, case info) sit behind the
 * right-side icon buttons; clicking one opens a kanban board with that content.
 */
export function HealthRecordKanbanCard({
  entry,
  onOpenViewer,
  onOpenDetails,
}: {
  entry: DocEntry;
  onOpenViewer: (entry: DocEntry, index: number) => void;
  onOpenDetails: (entry: DocEntry) => void;
}) {
  const type: "ADM" | "Clinic" = entry.row.type === "ADM" ? "ADM" : "Clinic";
  const color = TYPE_COLORS[type];
  const tone = TYPE_TONES[type];
  const isFollowUp = entry.row.status === "follow_up";
  const followUpHref =
    type === "ADM"
      ? `/nurse/referrals/adm?highlight=${encodeURIComponent(entry.row.id)}`
      : `/nurse/referrals/clinic?highlight=${encodeURIComponent(entry.row.id)}`;

  const title =
    type === "ADM"
      ? "ADM consultation"
      : entry.session
        ? "Clinic session"
        : "Resolved case";

  const meta =
    entry.row.grade && entry.row.grade !== "—" ? entry.row.grade : "—";
  const dateLabel = formatDate(entry.dateDay);
  const statusLabel = entryStatusLabel(entry);
  const statusVariant = entryStatusVariant(entry);
  const hasFiles = entry.files.length > 0;
  const hasNotes = entry.details.trim() !== "" && entry.details !== "—";
  const hasOutcome = entry.outcome.trim() !== "";

  const files: FolderFile[] = hasFiles
    ? entry.files.slice(0, 5).map((f) => ({
        name: f.fileName || `Session_${entry.dateDay}`,
        tag: statusLabel,
        tone,
        icon: "image" as const,
        thumbUrl: fileHref(f.fileUrl),
      }))
    : [
        {
          name: `${entry.session ? "Session" : "Case"}_${entry.dateDay}`,
          tag: statusLabel,
          tone,
          icon: "doc" as const,
        },
      ];

  return (
    <article
      role="listitem"
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-muted/20"
    >
      <header className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <FileText size={14} aria-hidden style={{ color }} />
          <span className="truncate">{title}</span>
        </span>
        <span className={`${BOARD_PILL} shrink-0 ${statusToneClass(statusVariant)}`}>
          {statusLabel}
        </span>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={PILL_NAME} title={entry.row.student}>
            {entry.row.student}
          </span>
          <span className={PILL_META} title={meta}>
            {meta}
          </span>
        </span>

        <span className="flex w-full items-center justify-between gap-3">
          <FolderCard
            folderColor={color}
            files={files}
            onFileClick={
              hasFiles ? (index) => onOpenViewer(entry, index) : undefined
            }
            onCardClick={() => onOpenDetails(entry)}
            cardAriaLabel={`Open ${entry.row.student}'s health record details`}
          />
          <StudentMascot
            name={entry.row.student}
            seed={entry.row.lrn}
            character={entry.row.mascot ?? undefined}
            size={96}
          />
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={PILL_META}>{entry.row.type}</span>
          {dateLabel && dateLabel !== "—" ? (
            <span className={PILL_META}>{dateLabel}</span>
          ) : null}
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
          {hasNotes ? (
            <DetailPop
              icon={<MessageSquareText size={13} aria-hidden />}
              accent={ACCENT_NOTES}
              ariaLabel={`Show the session notes for ${entry.row.student}`}
              boardTitle="Session notes"
              description="Recorded during the session."
            >
              <p className="m-0 px-1 text-[12px] leading-relaxed text-foreground">
                {entry.details}
              </p>
            </DetailPop>
          ) : null}

          {hasOutcome ? (
            <DetailPop
              icon={<Target size={13} aria-hidden />}
              accent={ACCENT_OUTCOME}
              ariaLabel={`Show the outcome for ${entry.row.student}`}
              boardTitle="Outcome"
              description="How the session resolved."
            >
              <p className="m-0 px-1 text-[12px] leading-relaxed text-foreground">
                {entry.outcome}
              </p>
            </DetailPop>
          ) : null}

          {hasFiles ? (
            <DetailPop
              icon={<Images size={13} aria-hidden />}
              accent={ACCENT_FILES}
              ariaLabel={`Show the documentation for ${entry.row.student}`}
              boardTitle="Documentation"
              description={`${entry.files.length} photo${entry.files.length === 1 ? "" : "s"} filed with this session.`}
            >
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {entry.files.map((f, i) => {
                  const size = formatBytes(f.fileSize);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => onOpenViewer(entry, i)}
                        className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11px] transition-colors hover:border-primary/60 hover:bg-muted"
                        title={size ? `${f.fileName} · ${size}` : f.fileName}
                      >
                        <Images
                          size={12}
                          className="shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {f.fileName}
                        </span>
                        {size ? (
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {size}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DetailPop>
          ) : null}

          <DetailPop
            icon={<Hash size={13} aria-hidden />}
            accent={ACCENT_CASE}
            ariaLabel={`Show the case information for ${entry.row.student}`}
            boardTitle="Case information"
            description="The referral this record closes out."
          >
            <dl className="m-0 flex flex-col gap-1.5 px-1 text-[12px] leading-relaxed">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Referred</dt>
                <dd
                  className={`${BOARD_PILL} ${
                    type === "ADM" ? TONE_BLUE : TONE_GREEN
                  }`}
                >
                  {entry.isEndorse
                    ? "Endorse ADM"
                    : type === "ADM"
                      ? "Teacher / ADM referral"
                      : "Clinic referral"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Category</dt>
                <dd
                  className={`${BOARD_PILL} ${
                    anecdotalCategoryPillClass(entry.row.category) ?? TONE_AMBER
                  }`}
                >
                  {entry.row.category}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className={`${BOARD_PILL} ${statusToneClass(statusVariant)}`}>
                  {statusLabel}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Date</dt>
                <dd className={`${BOARD_PILL} ${TONE_AMBER}`}>{dateLabel}</dd>
              </div>
              {entry.row.followUpDate ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Follow-up due</dt>
                  <dd className={`${BOARD_PILL} ${TONE_VIOLET}`}>
                    {formatDate(entry.row.followUpDate)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </DetailPop>
        </span>
      </div>
    </article>
  );
}
