"use client";
import { AlertTriangle } from "lucide-react";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import { formatRange, type TimetableRow } from "./schedule-time";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
import dropdownStyles from "@/app/principal/academics/assign/components/dropdown-select.module.css";
import type { SlotValue } from "./SlotEntryDialog";
import { conflictKey } from "./use-schedule-conflicts";
import styles from "../schedule-empty.module.css";

const DAYS = [1, 2, 3, 4, 5];

interface SubjectOpt {
  id: string;
  name: string;
  code: string;
  category: string;
}
interface TeacherOpt {
  id: string;
  name: string;
  code: string | null;
}

interface Props {
  rows: TimetableRow[];
  cells: Record<string, SlotValue | null>;
  subjects: SubjectOpt[];
  teachers: TeacherOpt[];
  subjectTeacherMap: Record<string, string[]>;
  conflictedCells: Set<string>;
  stagedKeys?: Set<string>;
  isLocked: boolean;
  saving: boolean;
  onChange: (day: number, period: number, subjectId: string, teacherNameId: string) => void;
  onClear: (day: number, period: number) => void;
}

function cellId(day: number, period: number): string {
  return `${day}:${period}`;
}

export function ScheduleTemplateGrid({
  rows,
  cells,
  subjects,
  teachers,
  subjectTeacherMap,
  conflictedCells,
  stagedKeys,
  isLocked,
  saving,
  onChange,
  onClear,
}: Props) {
  return (
    <div className={`overflow-x-auto rounded-lg border ${styles.noScrollbar}`}>
      <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-40 p-2 text-left">
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
              return (
                <tr key={`break-${ri}`}>
                  <td colSpan={DAYS.length + 1} className="border-t bg-muted/40 px-2 py-1 text-center text-xs text-muted-foreground">
                    {row.kind === "lunch" ? "Lunch Break" : row.label} · {formatRange(row.startMin, row.endMin)}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={`period-${row.periodIndex}`}>
                <th scope="row" className="border-t p-2 text-left text-[11px] font-medium whitespace-normal break-words text-muted-foreground">
                  {formatRange(row.startMin, row.endMin)}
                </th>
                {DAYS.map((day) => {
                  const key = cellId(day, row.periodIndex);
                  const cell = cells[key] ?? null;
                  const subjectId = cell?.subjectId ?? "";
                  // One-subject-one-teacher-per-section: lock teacher to the owner.
                  const owners = Array.from(new Set(subjectTeacherMap[subjectId] ?? []));
                  const lockedOwner = subjectId !== "" && owners.length === 1 ? owners[0] : null;
                  const effectiveTeacher = lockedOwner ?? cell?.teacherNameId ?? "";
                  const conflicted =
                    effectiveTeacher !== "" && conflictedCells.has(conflictKey(day, row.periodIndex, effectiveTeacher));
                  const staged = stagedKeys?.has(key) ?? false;
                  return (
                    <td key={day} className="border-t p-1 align-top">
                      <div
                        className={`relative flex flex-col gap-1 rounded-md border p-1.5 ${
                          conflicted
                            ? "border-amber-500/60 bg-amber-500/5"
                            : staged
                              ? "border-amber-500/50 bg-amber-500/[0.03]"
                              : "border-input bg-card"
                        }`}
                      >
                        {staged ? (
                          <span
                            title="Unsaved changes — press Save"
                            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                            aria-hidden
                          />
                        ) : null}
                        <DropdownSelect
                          value={subjectId}
                          onValueChange={(v) => {
                            if (isLocked || saving) return;
                            if (v === "") {
                              onClear(day, row.periodIndex);
                              return;
                            }
                            // One-subject-one-teacher: a newly picked subject
                            // immediately takes its single owner, if any.
                            const pickedOwners = Array.from(new Set(subjectTeacherMap[v] ?? []));
                            const pickedOwner = pickedOwners.length === 1 ? pickedOwners[0] : null;
                            const keepOwner = lockedOwner && v === subjectId ? lockedOwner : null;
                            onChange(day, row.periodIndex, v, pickedOwner ?? keepOwner ?? effectiveTeacher);
                          }}
                          options={subjects.map((s) => ({
                            value: s.id,
                            label: (
                              <span className={dropdownStyles.optionLabel}>
                                <span className={dropdownStyles.optionName}>{s.code}</span>
                                <span className={dropdownStyles.gradePill}>
                                  {s.category === "ELECTIVE" ? "Elective" : "Core"}
                                </span>
                              </span>
                            ),
                          }))}
                          placeholder="Subject…"
                          ariaLabel={`Subject ${WEEK_LABELS_SHORT[day - 1]} ${formatRange(row.startMin, row.endMin)}`}
                          triggerClassName={dropdownStyles.dropdown32}
                        />
                        {lockedOwner ? (
                          <p className="px-1 text-[11px] text-muted-foreground" aria-live="polite">
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {teachers.find((t) => t.id === lockedOwner)?.name ?? "Teacher"}
                            </span>{" "}
                            owns this subject here
                          </p>
                        ) : (
                          <DropdownSelect
                            value={effectiveTeacher}
                            onValueChange={(v) => {
                              if (isLocked || saving || subjectId === "") return;
                              onChange(day, row.periodIndex, subjectId, v);
                            }}
                            options={teachers.map((t) => ({
                              value: t.id,
                              label: (
                                <span className={dropdownStyles.optionLabel}>
                                  <span className={dropdownStyles.optionName}>{t.name}</span>
                                  {t.code ? <span className={dropdownStyles.gradePill}>{t.code}</span> : null}
                                </span>
                              ),
                            }))}
                            placeholder="Teacher…"
                            ariaLabel={`Teacher ${WEEK_LABELS_SHORT[day - 1]} ${formatRange(row.startMin, row.endMin)}`}
                            triggerClassName={dropdownStyles.dropdown32}
                          />
                        )}
                        {conflicted ? (
                          <p role="alert" className="flex items-center gap-1 px-1 text-[11px] text-amber-600 dark:text-amber-500">
                            <AlertTriangle size={12} aria-hidden />
                            Double-booked — saved with warning
                          </p>
                        ) : null}
                        {cell ? (
                          <button
                            type="button"
                            onClick={() => onClear(day, row.periodIndex)}
                            disabled={isLocked || saving}
                            className="self-end text-[11px] text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
