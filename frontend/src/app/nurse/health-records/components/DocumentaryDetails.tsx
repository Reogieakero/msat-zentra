"use client";

import * as React from "react";
import {
  FileText,
  Hash,
  Images,
  MessageSquareText,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import {
  entryStatusLabel,
  entryStatusVariant,
  fileHref,
  formatBytes,
  type DocEntry,
} from "./documentaries-utils";
import { formatDate } from "../../referrals/components/nurse-referrals-format";
import {
  ACCENT_CASE,
  ACCENT_FILES,
  ACCENT_NOTES,
  ACCENT_OUTCOME,
  categoryPillTone,
  statusPillTone,
  TYPE_COLORS,
} from "./record-tones";
import styles from "./NurseDocumentariesList.module.css";

export interface DocumentaryDetailsProps {
  entry: DocEntry;
  onOpenViewer: (entry: DocEntry, index: number) => void;
  onClose: () => void;
}

/**
 * Health-record details overlay — the same kanban board language as the other
 * nurse confirmations (dark backdrop + board shell + 24px footer button). The
 * record's contents sit inside the board as inner kanban cards on a 2×2 grid.
 */
export function DocumentaryDetails({
  entry,
  onOpenViewer,
  onClose,
}: DocumentaryDetailsProps) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const type: "ADM" | "Clinic" = entry.row.type === "ADM" ? "ADM" : "Clinic";
  const color = TYPE_COLORS[type];
  const eyebrow = entry.isEndorse
    ? "ADM consultation · ready to endorse"
    : type === "ADM"
      ? "ADM consultation"
      : entry.session
        ? "Clinic session"
        : "Resolved case";
  const meta = [
    { label: "LRN", value: entry.row.lrn },
    { label: "Grade level", value: entry.row.grade },
    { label: "Section", value: entry.row.section },
  ].filter((m) => m.value && m.value !== "—");
  const hasNotes = entry.details.trim() !== "" && entry.details !== "—";
  const hasOutcome = entry.outcome.trim() !== "";

  const fields: { label: string; value: React.ReactNode }[] = [
    {
      label: "Time referred",
      value: (
        <Pill tone="amber" label="Time referred">
          {formatDate(entry.row.date)}
        </Pill>
      ),
    },
    {
      label: "Referred",
      value: (
        <Pill tone={type === "ADM" ? "blue" : "green"} label="Referred by">
          {entry.isEndorse
            ? "Endorse ADM"
            : type === "ADM"
              ? "Teacher / ADM referral"
              : "Clinic referral"}
        </Pill>
      ),
    },
    {
      label: "Category",
      value: (
        <Pill tone={categoryPillTone(entry.row.category)} label="Category">
          {entry.row.category}
        </Pill>
      ),
    },
    {
      label: "Status",
      value: (
        <Pill
          tone={statusPillTone(entryStatusVariant(entry))}
          label="Record status"
        >
          {entryStatusLabel(entry)}
        </Pill>
      ),
    },
  ];
  if (entry.row.followUpDate) {
    fields.push({
      label: "Follow-up due",
      value: (
        <Pill tone="violet" label="Follow-up due">
          {formatDate(entry.row.followUpDate)}
        </Pill>
      ),
    });
  }

  return (
    <div
      className="whitespace-normal fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.row.student}'s health record`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-3xl">
        <KanbanBoard
          className={`bg-card max-h-[90vh] overflow-y-auto shadow-2xl ${styles.overlayScroll}`}
          title={
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate">{entry.row.student}</span>
              {meta.map((m) => (
                <Pill key={m.label} label={m.label}>
                  {m.value}
                </Pill>
              ))}
            </span>
          }
          icon={
            <span style={{ color }} aria-hidden>
              <FileText size={14} />
            </span>
          }
          actions={
            /* 24px close X — same as the other overlay kanbans. */
            <button
              type="button"
              onClick={onClose}
              autoFocus
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
            </button>
          }
          description={eyebrow}
          footer={
            /* 24px action button — same metric as the kanban boards. */
            <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          }
        >
          {/* Record contents — inner kanban cards on a 2×2 grid (equal
              heights so the four boards line up). */}
          <div className="grid auto-rows-fr grid-cols-1 gap-3 px-1 pb-1 sm:grid-cols-2">
            <KanbanBoard
              className="flex-1"
              title="Case information"
              icon={
                <span className={ACCENT_CASE} aria-hidden>
                  <Hash size={14} />
                </span>
              }
            >
              {/* One mini card per field — 2 per row, even with the optional
                  follow-up card. */}
              <dl className="m-0 grid grid-cols-1 gap-2 px-1 pb-1 text-[12px] leading-relaxed sm:grid-cols-2">
                {fields.map((f) => (
                  <div
                    key={f.label}
                    className="flex min-w-0 flex-col gap-1 rounded-md border border-border bg-muted/30 p-2"
                  >
                    <dt className="text-[11px] font-medium text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="m-0 min-w-0">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </KanbanBoard>

            <KanbanBoard
              className="flex-1"
              title="Session notes"
              icon={
                <span className={ACCENT_NOTES} aria-hidden>
                  <MessageSquareText size={14} />
                </span>
              }
            >
              {hasNotes ? (
                <p className="m-0 px-1 text-[12px] leading-relaxed text-foreground">
                  {entry.details}
                </p>
              ) : (
                <KanbanBoardEmpty>No session notes recorded.</KanbanBoardEmpty>
              )}
            </KanbanBoard>

            <KanbanBoard
              className="flex-1"
              title="Outcome"
              icon={
                <span className={ACCENT_OUTCOME} aria-hidden>
                  <Target size={14} />
                </span>
              }
            >
              {hasOutcome ? (
                <p className="m-0 px-1 text-[12px] leading-relaxed text-foreground">
                  {entry.outcome}
                </p>
              ) : (
                <KanbanBoardEmpty>No outcome recorded.</KanbanBoardEmpty>
              )}
            </KanbanBoard>

            <KanbanBoard
              className="flex-1"
              title="Files"
              icon={
                <span className={ACCENT_FILES} aria-hidden>
                  <Images size={14} />
                </span>
              }
              count={entry.files.length}
            >
              {entry.files.length === 0 ? (
                <KanbanBoardEmpty>No files filed.</KanbanBoardEmpty>
              ) : (
                <ul
                  className="m-0 grid grid-cols-3 gap-2 p-0"
                  aria-label="Attached files"
                >
                  {entry.files.map((f, i) => {
                    const size = formatBytes(f.fileSize);
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          className={styles.thumbBtn}
                          onClick={() => onOpenViewer(entry, i)}
                          title={
                            size
                              ? `${f.fileName} · ${size} — click to view`
                              : `${f.fileName} — click to view`
                          }
                          aria-label={`View image ${i + 1} of ${entry.files.length}: ${f.fileName}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={fileHref(f.fileUrl)}
                            alt={f.fileName}
                            className={styles.thumbImg}
                            loading="lazy"
                          />
                          <span className={styles.thumbOverlay} aria-hidden>
                            <Images size={16} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </KanbanBoard>
          </div>
        </KanbanBoard>
      </div>
    </div>
  );
}
