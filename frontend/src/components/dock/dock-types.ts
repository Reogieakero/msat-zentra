"use client";

export type DockTaskStatus =
  | "running"
  | "waiting"
  | "done"
  | "failed"
  | "cancelled";

export type DockTaskKind =
  | "referral-send"
  | "referral-cancel"
  | "lock-grades"
  | "sf10-upload"
  | "sf10-request"
  | "score-save"
  | "weights-save"
  | "assessment-add"
  | "assessment-delete"
  | "attendance-save"
  | "timetable-save"
  | "unlink-code"
  | "anecdotal-file"
  | "generic";

export interface DockTaskProgress {
  done: number;
  total: number;
}

export interface DockTask {
  id: string;
  kind: DockTaskKind;
  /** Short name, e.g. "Sending referral". Shown in the middle top line. */
  title: string;
  /** One-line detail, e.g. "Juan → Guidance". Shown below the title. */
  description: string;
  status: DockTaskStatus;
  progress?: DockTaskProgress | null;
  /** Plain-words problem for failed tasks. */
  error?: string | null;
  createdAt: number;
  updatedAt: number;
  /** Which browser tab owns a running task. Used to detect refresh. */
  ownerTabId?: string | null;
}

export function dockStatusLabel(t: DockTask): string {
  if (t.status === "done") return "Done";
  if (t.status === "failed") return "Failed";
  if (t.status === "cancelled") return "Cancelled";
  if (t.status === "waiting") return "Waiting";
  if (t.progress && t.progress.total > 0) {
    const pct = Math.round((t.progress.done / t.progress.total) * 100);
    return `${pct}%`;
  }
  return "Working…";
}
