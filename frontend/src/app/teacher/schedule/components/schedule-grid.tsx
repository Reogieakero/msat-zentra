"use client";
import { Coffee, Utensils } from "lucide-react";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import { formatRange, type TimetableRow } from "./schedule-time";
import { ScheduleGridCell } from "./ScheduleGridCell";
import type { SlotValue } from "./SlotEntryDialog";
import type { CopiedSlot } from "./CopiedSlotCard";
import styles from "../schedule-empty.module.css";
const DAYS = [1, 2, 3, 4, 5];
interface Props {
  rows: TimetableRow[];
  cells: Record<string, SlotValue | null>;
  subjectById: Map<string, { id: string; name: string }>;
  teacherById: Map<string, { id: string; name: string; code: string | null }>;
  copied: CopiedSlot | null;
  isLocked: boolean;
  splitSubjects: { subjectId: string; subjectName: string; teacherNames: string[] }[];
  sectionName: string;
  listsError: boolean;
  statusOf: (key: string) => "DRAFT" | "SUBMITTED" | "APPROVED" | null;
  serverHasReviewNote: (key: string) => boolean;
  onEdit: (day: number, period: number) => void;
  onPaste: (day: number, period: number) => void;
  onCopy: (subjectId: string, teacherNameId: string) => void;
}
export function cellKey(day: number, period: number): string {
  return `${day}:${period}`;
}
export function ScheduleGrid({
  rows,
  cells,
  subjectById,
  teacherById,
  copied,
  isLocked,
  splitSubjects,
  sectionName,
  listsError,
  statusOf,
  serverHasReviewNote,
  onEdit,
  onPaste,
  onCopy,
}: Props) {
  return (
    <>
      {splitSubjects.length > 0 && !isLocked ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
        >
          <p className="font-medium">
            {splitSubjects.length === 1 ? "Subject" : "Subjects"} split across teachers in{" "}
            {sectionName}:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {splitSubjects.map((s) => (
              <li key={s.subjectId}>
                {s.subjectName} — {s.teacherNames.join(", ")}. Clear its slots to unify
                it to one teacher.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={`overflow-x-auto rounded-lg border ${styles.noScrollbar}`}>
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-28 p-2 text-left">
                <span className="sr-only">Time</span>
              </th>
              {DAYS.map((day) => (
                <th key={day} scope="col" className="p-2 text-center text-xs font-semibold">
                  {WEEK_LABELS_SHORT[day - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.kind !== "period") {
                const isLunch = row.kind === "lunch";
                return (
                  <tr key={`break-${ri}`}>
                    <td
                      colSpan={DAYS.length + 1}
                      className="border-t bg-muted/40 px-2 py-1 text-center text-xs text-muted-foreground"
                    >
                      {isLunch ? (
                        <>
                          <Utensils size={12} className="mr-1 inline" aria-hidden />
                          Lunch Break · {formatRange(row.startMin, row.endMin)}
                        </>
                      ) : (
                        <>
                          <Coffee size={12} className="mr-1 inline" aria-hidden /> {row.label} ·{" "}
                          {formatRange(row.startMin, row.endMin)}
                        </>
                      )}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={`period-${row.periodIndex}`}>
                  <th
                    scope="row"
                    className="border-t p-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
                  >
                    {formatRange(row.startMin, row.endMin)}
                  </th>
                  {DAYS.map((day) => {
                    const key = cellKey(day, row.periodIndex);
                    const cell = cells[key] ?? null;
                    const sub = cell ? subjectById.get(cell.subjectId) : undefined;
                    const teacher = cell?.teacherNameId
                      ? teacherById.get(cell.teacherNameId)
                      : undefined;
                    const timeLabel = `${WEEK_LABELS_SHORT[day - 1]} ${formatRange(row.startMin, row.endMin)}`;
                    const status = statusOf(key);
                    const returned = status === "DRAFT" && serverHasReviewNote(key);
                    const filled = cell !== null && sub !== undefined && !!cell.teacherNameId;
                    return (
                      <ScheduleGridCell
                        key={day}
                        filled={filled}
                        timeLabel={timeLabel}
                        subjectName={sub?.name ?? null}
                        teacherName={teacher?.name ?? null}
                        teacherCode={teacher?.code ?? null}
                        status={status}
                        returned={returned}
                        copiedSubjectName={
                          filled || !copied
                            ? null
                            : (subjectById.get(copied.subjectId)?.name ?? "copied slot")
                        }
                        locked={isLocked}
                        onEdit={() => onEdit(day, row.periodIndex)}
                        onPaste={() => onPaste(day, row.periodIndex)}
                        onCopy={() => {
                          if (cell?.subjectId && cell.teacherNameId) {
                            onCopy(cell.subjectId, cell.teacherNameId);
                          }
                        }}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {listsError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load subjects or teachers.
        </p>
      ) : null}
    </>
  );
}
