"use client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardModal } from "@/components/ui/CardModal";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
import styles from "../schedule-empty.module.css";
import { useAddSubjects } from "./use-add-subjects";
import type { ScheduleSubject } from "../page";
const MAX_ROWS = 10;
function categoryLabel(category: string): string {
  return category === "ELECTIVE" ? "Elective" : "Core";
}
export function AddSubjectDialog({
  onClose,
  subjects,
  teachers,
}: {
  onClose: () => void;
  subjects: ScheduleSubject[];
  teachers: { id: string; name: string; code: string | null; linked: boolean }[];
}) {
  const {
    rows,
    setRows,
    patchRow,
    filled,
    gradeLevel,
    setGradeLevel,
    category,
    setCategory,
    formError,
    createMany,
    handleCreate,
  } = useAddSubjects(onClose);
  return (
    <CardModal
      open
      onClose={onClose}
      dismissable={!createMany.isPending}
      size="md"
      title="Add subjects"
      description="Subjects are usable in the timetable immediately."
      watchKey={createMany.isPending}
    >
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Grade level (all rows)</span>
            <DropdownSelect
              value={gradeLevel}
              onValueChange={setGradeLevel}
              options={[
                { value: "G7", label: "Grade 7" },
                { value: "G8", label: "Grade 8" },
                { value: "G9", label: "Grade 9" },
                { value: "G10", label: "Grade 10" },
              ]}
              ariaLabel="Grade level"
            />
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Category (all rows)</span>
            <DropdownSelect
              value={category}
              onValueChange={setCategory}
              options={[
                { value: "CORE", label: "Core" },
                { value: "ELECTIVE", label: "Elective" },
              ]}
              ariaLabel="Category"
            />
          </div>
        </div>
        <div className={`flex max-h-[40dvh] flex-col gap-2 overflow-y-auto pr-0.5 ${styles.noScrollbar}`}>
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Subject {i + 1}</span>
                {rows.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove subject row ${i + 1}`}
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Input
                placeholder="Subject name"
                value={row.name}
                onChange={(e) => patchRow(i, { name: e.target.value })}
                aria-label={`Subject ${i + 1} name`}
              />
              <Input
                placeholder="Code (e.g. MATH7)"
                value={row.code}
                onChange={(e) => patchRow(i, { code: e.target.value.toUpperCase() })}
                aria-label={`Subject ${i + 1} code`}
              />
            </div>
          ))}
        </div>
        {rows.length < MAX_ROWS ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { name: "", code: "" }])}
            className="self-start"
          >
            <Plus size={14} aria-hidden />
            Add another
          </Button>
        ) : null}
        <details className="rounded-lg border border-input px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Existing subjects ({subjects.length})
          </summary>
          {subjects.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No subjects listed yet.</p>
          ) : (
            <ul className={`mt-2 grid max-h-40 gap-1 overflow-y-auto ${styles.noScrollbar}`}>
              {subjects.map((s) => (
                <li key={s.id} className="text-sm">
                  {s.name}{" "}
                  <span className="text-muted-foreground">
                    ({s.code}) · Grade {s.gradeLevel.replace("G", "")} · {categoryLabel(s.category)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
        <details className="rounded-lg border border-input px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Teacher names ({teachers.length})
          </summary>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No names listed yet.</p>
          ) : (
            <ul className={`mt-2 grid max-h-40 gap-1 overflow-y-auto ${styles.noScrollbar}`}>
              {teachers.map((t) => (
                <li key={t.id} className="text-sm">
                  {t.name}{" "}
                  <span className="text-muted-foreground">({t.code ?? "—"})</span>
                  {t.linked ? (
                    <span className="ml-1 text-xs font-medium text-green-600 dark:text-green-500">
                      · Linked
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </details>
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="destructive"
            onClick={onClose}
            disabled={createMany.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMany.isPending || filled.length === 0}
            aria-busy={createMany.isPending || undefined}
          >
            {createMany.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span aria-live="polite">Creating…</span>
              </>
            ) : (
              `Create ${filled.length > 0 ? `${filled.length} ` : ""}subject${filled.length === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
    </CardModal>
  );
}
