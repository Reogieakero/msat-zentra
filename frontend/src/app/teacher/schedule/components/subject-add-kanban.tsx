"use client";

import { BookPlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
import { useAddSubjects, type SubjectCreateProgress } from "./use-add-subjects";
import styles from "./subject-kanban.module.css";
import formStyles from "../schedule-empty.module.css";

const MAX_ROWS = 10;

interface Props {
  onClose: () => void;
  onProgress?: (p: SubjectCreateProgress | null) => void;
}

export function SubjectAddKanban({ onClose, onProgress }: Props) {
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
  } = useAddSubjects(onClose, onProgress);

  return (
    <div className={`${styles.column} mx-auto w-full max-w-xl`} aria-label="Add subjects form">
      <KanbanBoard
        title="Add subjects"
        icon={
          <span className="text-amber-500" aria-hidden>
            <BookPlus size={14} />
          </span>
        }
        count={
          filled.length > 0 ? (
            <span className="text-amber-600 dark:text-amber-500">{filled.length}</span>
          ) : undefined
        }
        description="Subjects are usable in the timetable immediately."
        className="h-full rounded-xl border-border bg-card shadow-xl"
        actions={
          <button
            type="button"
            onClick={onClose}
            disabled={createMany.isPending}
            aria-label="Close add subjects"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <X size={14} aria-hidden="true" />
          </button>
        }
        toolbar={
          <div className="grid grid-cols-1 gap-2 px-1 sm:grid-cols-2">
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
                  { value: "G11", label: "Grade 11" },
                  { value: "G12", label: "Grade 12" },
                ]}
                ariaLabel="Grade level"
                triggerClassName={styles.triggerLeft}
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
                triggerClassName={styles.triggerLeft}
              />
            </div>
          </div>
        }
        footer={
          <div className="flex justify-end gap-1.5 px-1 pb-1">
            <Button
              onClick={handleCreate}
              disabled={createMany.isPending || filled.length === 0}
              aria-busy={createMany.isPending || undefined}
              className="h-6 gap-1 px-2 text-[11px]"
            >
              {createMany.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Creating…</span>
                </>
              ) : (
                <>
                  <BookPlus size={12} aria-hidden />
                  Create {filled.length > 0 ? `${filled.length} ` : ""}subject
                  {filled.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className={`flex max-h-[32dvh] flex-col gap-2 overflow-y-auto px-1 ${formStyles.noScrollbar}`}>
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Subject {i + 1}</span>
                {rows.length > 1 ? (
                  <Button
                    variant="ghost"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove subject row ${i + 1}`}
                    className="h-6 gap-1 px-2 text-[11px]"
                  >
                    <Trash2 size={12} aria-hidden />
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            </div>
          ))}
        </div>
        {rows.length < MAX_ROWS ? (
          <div className="px-1">
            <Button
              variant="secondary"
              onClick={() => setRows((prev) => [...prev, { name: "", code: "" }])}
              className="h-6 gap-1 px-2 text-[11px]"
            >
              <Plus size={12} aria-hidden />
              Add another
            </Button>
          </div>
        ) : null}
        {formError ? (
          <p role="alert" className="px-1 font-sans text-xs text-red-600 dark:text-red-400">
            {formError}
          </p>
        ) : null}
      </KanbanBoard>
    </div>
  );
}
