"use client";

import { Copy } from "lucide-react";

export type SlotStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | null;

/** One timetable grid cell: filled slot (locked readout or edit button +
 *  status dot + copy affordance) or empty slot (locked dash or
 *  edit/paste button). Pure render — all data arrives as props. */
export function ScheduleGridCell({
  filled,
  timeLabel,
  subjectName,
  teacherName,
  teacherCode,
  status,
  returned,
  copiedSubjectName,
  locked,
  onEdit,
  onPaste,
  onCopy,
}: {
  filled: boolean;
  timeLabel: string;
  subjectName: string | null;
  teacherName: string | null;
  teacherCode: string | null;
  status: SlotStatus;
  returned: boolean;
  copiedSubjectName: string | null;
  locked: boolean;
  onEdit: () => void;
  onPaste: () => void;
  onCopy: () => void;
}) {
  const statusName =
    status === "APPROVED"
      ? "approved"
      : status === "SUBMITTED"
        ? "submitted"
        : returned
          ? "returned"
          : "draft";
  const label =
    filled && subjectName !== null
      ? `${timeLabel}, ${subjectName}${teacherName ? ` with ${teacherName}` : ""} (${statusName})`
      : copiedSubjectName !== null
        ? `${timeLabel}, empty — tap to paste ${copiedSubjectName}`
        : `${timeLabel}, empty`;
  return (
    <td className="border-t p-1">
      {filled && subjectName !== null ? (
        <div className="relative">
          {locked ? (
            <div
              aria-label={label}
              title={
                `${subjectName}${teacherName ? ` — ${teacherName}${teacherCode ? ` (${teacherCode})` : ""}` : ""} (${statusName}) — unlock to edit`
              }
              className="flex min-h-14 w-full items-center justify-center rounded-md border border-solid bg-primary/5 px-1 py-1 text-center text-xs"
            >
              <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                <span className="w-full truncate font-medium">{subjectName}</span>
                {teacherName ? (
                  <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
                    {teacherName}
                  </span>
                ) : null}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              aria-label={label}
              title={
                `${subjectName}${teacherName ? ` — ${teacherName}${teacherCode ? ` (${teacherCode})` : ""}` : ""} (${statusName})`
              }
              className="flex min-h-14 w-full items-center justify-center rounded-md border border-solid bg-primary/5 px-1 py-1 pr-6 text-center text-xs transition-colors"
            >
              <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                <span className="w-full truncate font-medium">{subjectName}</span>
                {teacherName ? (
                  <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
                    {teacherName}
                  </span>
                ) : null}
              </span>
            </button>
          )}
          <span
            aria-hidden="true"
            title={statusName}
            className={`absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${
              status === "APPROVED"
                ? "bg-green-500"
                : status === "SUBMITTED"
                  ? "bg-blue-500"
                  : returned
                    ? "bg-amber-500"
                    : "bg-red-500"
            }`}
          />
          {locked ? null : (
            <button
              type="button"
              onClick={onCopy}
              aria-label={`Copy ${subjectName}${teacherName ? ` with ${teacherName}` : ""}`}
              title="Copy slot"
              className="absolute top-1 right-1 rounded-md border border-input bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground"
            >
              <Copy size={12} aria-hidden />
            </button>
          )}
        </div>
      ) : locked ? (
        <div
          aria-label={`${timeLabel}, locked`}
          title="Approved — unlock to edit"
          className="flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-input px-1 text-center text-xs text-muted-foreground"
        >
          <span aria-hidden="true">—</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPaste}
          aria-label={label}
          title={copiedSubjectName !== null ? "Tap to paste copied slot" : "Empty slot — tap to schedule"}
          className="flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-input px-1 text-center text-xs text-muted-foreground transition-colors hover:border-primary"
        >
          <span className="text-muted-foreground">+</span>
        </button>
      )}
    </td>
  );
}
