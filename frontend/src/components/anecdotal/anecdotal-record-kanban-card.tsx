"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { FolderCard } from "@/components/ui/FolderCard";
import { Pill, type PillTone } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";

export const ANECDOTAL_CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};

export const ANECDOTAL_CATEGORY_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  behavioral: 1,
  bullying: 2,
  academic: 3,
  attendance: 4,
  health: 5,
};

export function humanizeCategory(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface AnecdotalRecordKanbanCardProps {
  /** Category key (e.g. "behavioral") — drives default label, color, tone. */
  category: string;
  /** Header title override — defaults to the humanized category. */
  headerTitle?: string;
  studentName: string;
  /** Second pill text — section on overview, LRN in folders. */
  metaText: string;
  /** Second pill tooltip. Defaults to metaText. */
  metaTitle?: string;
  /** Second pill field name shown on hover (e.g. "LRN", "Section"). */
  metaLabel?: string;
  /** Second pill tone. Defaults to neutral. */
  metaTone?: PillTone;
  /** Optional LRN pill rendered before the meta pill. */
  lrn?: string;
  /** Render the student name as 14px text instead of an amber pill. */
  plainName?: boolean;
  /** Seed for the student's mascot; renders the mascot when provided. */
  mascotSeed?: string;
  /** Mascot sprite assigned to the student in their profile (takes precedence). */
  mascotCharacter?: string;
  fileName: string;
  fileTag: string;
  /** Right side of the card title — e.g. the green Signed pill. */
  headerRight?: React.ReactNode;
  /** Category icon color override. Defaults to the category map. */
  categoryColor?: string;
  /** Folder color override. Defaults to the category map. */
  folderColor?: string;
  /** Folder alignment inside the card. Defaults to centered. */
  folderAlign?: "center" | "start";
  /** Identity + folder side by side instead of stacked. Defaults to vertical. */
  layout?: "vertical" | "horizontal" | "folder-left";
  /** Mascot sprite size in px. Defaults to 28 (44 in the folder-left layout). */
  mascotSize?: number;
  /** File tone override. Defaults to the category map. */
  tone?: 1 | 2 | 3 | 4 | 5;
  /** Accessible label for the open button. */
  openLabel: string;
  onOpen: () => void;
}

/**
 * Shareable anecdotal record kanban card — the per-record folder card used
 * by the teacher anecdotal board (`/teacher/anecdotal`) and the teacher
 * overview board. Same muted column shell, title row, pills, and folder;
 * callers only differ in pill content and the optional title-right node.
 */
export function AnecdotalRecordKanbanCard({
  category,
  headerTitle,
  studentName,
  metaText,
  metaTitle,
  metaLabel,
  metaTone,
  lrn,
  plainName = false,
  mascotSeed,
  mascotCharacter,
  fileName,
  fileTag,
  headerRight,
  categoryColor,
  folderColor,
  folderAlign = "center",
  layout = "vertical",
  mascotSize,
  tone,
  openLabel,
  onOpen,
}: AnecdotalRecordKanbanCardProps) {
  const horizontal = layout === "horizontal";
  const folderLeft = layout === "folder-left";
  const iconColor =
    categoryColor ?? ANECDOTAL_CATEGORY_COLORS[category] ?? "var(--muted-foreground)";
  const spriteSize = mascotSize ?? (folderLeft ? 44 : 28);
  const folderNode = (
    <span
      className={
        folderLeft
          ? "w-[112px] shrink-0"
          : horizontal
            ? "w-[120px]"
            : "w-full max-w-[220px]"
      }
    >
      <FolderCard
        label=""
        folderColor={folderColor ?? ANECDOTAL_CATEGORY_COLORS[category]}
        files={[
          {
            name: fileName,
            tag: fileTag,
            tone: tone ?? ANECDOTAL_CATEGORY_TONES[category] ?? 1,
            icon: "doc",
          },
        ]}
      />
    </span>
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={openLabel}
      className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-muted/20"
    >
      <span className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <FileText size={14} aria-hidden style={{ color: iconColor }} />
          <span className="truncate">{headerTitle ?? humanizeCategory(category)}</span>
        </span>
        {headerRight ?? null}
      </span>
      <span
        className={
          folderLeft
            ? "flex min-w-0 flex-row items-center gap-3 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
            : horizontal
              ? "flex min-w-0 flex-row items-center gap-3 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
              : "flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
        }
      >
        {folderLeft ? folderNode : null}
        <span
          className={
            horizontal || folderLeft
              ? "flex min-w-0 flex-1 items-center gap-1.5"
              : "flex min-w-0 items-center gap-1.5"
          }
        >
          {mascotSeed ? (
            <StudentMascot
              name={studentName}
              seed={mascotSeed}
              character={mascotCharacter}
              size={spriteSize}
            />
          ) : null}
          <span
            className={
              mascotSeed
                ? "flex min-w-0 flex-col items-start gap-1"
                : "flex min-w-0 flex-wrap items-center gap-1.5"
            }
          >
            {plainName ? (
              <span className="min-w-0 truncate text-[14px] font-semibold leading-tight">
                {studentName}
              </span>
            ) : (
              <Pill
                tone="amber"
                label="Student"
                className="min-w-0 max-w-full overflow-hidden"
              >
                <span className="truncate">{studentName}</span>
              </Pill>
            )}
            <span
              className={
                mascotSeed
                  ? "flex min-w-0 max-w-full flex-wrap items-center gap-1"
                  : "contents"
              }
            >
              {lrn ? (
                <Pill label="LRN" className="tabular-nums">
                  {lrn}
                </Pill>
              ) : null}
              <Pill
                tone={metaTone}
                label={metaLabel ?? metaTitle ?? metaText}
                aria-label={metaTitle ?? metaText}
                className="min-w-0 max-w-full overflow-hidden"
              >
                <span className="truncate">{metaText}</span>
              </Pill>
            </span>
          </span>
        </span>
        {folderLeft ? null : (
          <span
            className={
              horizontal
                ? "flex shrink-0 justify-center"
                : `flex w-full ${folderAlign === "start" ? "justify-start" : "justify-center"}`
            }
          >
            {folderNode}
          </span>
        )}
      </span>
    </button>
  );
}
