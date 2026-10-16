"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { FolderCard } from "@/components/ui/FolderCard";

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
  studentName: string;
  /** Second pill text — section on overview, LRN in folders. */
  metaText: string;
  /** Second pill tooltip. Defaults to metaText. */
  metaTitle?: string;
  fileName: string;
  fileTag: string;
  /** Right side of the card title — e.g. the green Signed pill. */
  headerRight?: React.ReactNode;
  /** Category icon color override. Defaults to the category map. */
  categoryColor?: string;
  /** Folder color override. Defaults to the category map. */
  folderColor?: string;
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
  studentName,
  metaText,
  metaTitle,
  fileName,
  fileTag,
  headerRight,
  categoryColor,
  folderColor,
  tone,
  openLabel,
  onOpen,
}: AnecdotalRecordKanbanCardProps) {
  const iconColor =
    categoryColor ?? ANECDOTAL_CATEGORY_COLORS[category] ?? "var(--muted-foreground)";
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
          <span className="truncate">{humanizeCategory(category)}</span>
        </span>
        {headerRight ?? null}
      </span>
      <span className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-400"
            title={studentName}
          >
            {studentName}
          </span>
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-tight text-secondary-foreground"
            title={metaTitle ?? metaText}
          >
            {metaText}
          </span>
        </span>
        <span className="flex w-full justify-center">
          <span className="w-full max-w-[220px]">
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
        </span>
      </span>
    </button>
  );
}
