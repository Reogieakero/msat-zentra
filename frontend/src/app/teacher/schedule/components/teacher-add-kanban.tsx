"use client";

import { CheckCircle2, Loader2, Plus, Trash2, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import { useAddTeachers, type TeacherCreateProgress } from "./use-add-teachers";
import styles from "./subject-kanban.module.css";

const MAX_ROWS = 10;

const TEACHER_CREATE_STEPS = ["Preparing names", "Saving to server", "Confirming catalog"];

interface Props {
  onClose: () => void;
  onProgress?: (p: TeacherCreateProgress | null) => void;
}

export function TeacherAddKanban({ onClose, onProgress }: Props) {
  const { rows, setRows, patchRow, filled, formError, createMany, handleCreate } =
    useAddTeachers(onClose, onProgress);

  return (
    <div className={`${styles.column} mx-auto w-full max-w-xl`} aria-label="Add teachers form">
      <KanbanBoard
        title="Add teachers"
        icon={
          <span className="text-amber-500" aria-hidden>
            <UserPlus size={14} />
          </span>
        }
        count={
          filled.length > 0 ? (
            <span className="text-amber-600 dark:text-amber-500">{filled.length}</span>
          ) : undefined
        }
        description="Type each name once, then pick from the list. Just names — no accounts involved."
        className="h-full"
        footer={
          <div className="flex justify-end gap-1.5 px-1 pb-1">
            <Button
              size="sm"
              onClick={onClose}
              disabled={createMany.isPending}
              className="h-6 border-transparent bg-red-600 px-3 text-white hover:bg-red-700 hover:text-white dark:border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createMany.isPending || filled.length === 0}
              aria-busy={createMany.isPending || undefined}
              className="h-6 border-input bg-white text-black hover:bg-neutral-100 hover:text-black dark:border-transparent dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black"
            >
              {createMany.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Creating…</span>
                </>
              ) : (
                `Create ${filled.length > 0 ? `${filled.length} ` : ""}teacher${filled.length === 1 ? "" : "s"}`
              )}
            </Button>
          </div>
        }
      >
        <ScrollList className="max-h-[32dvh] gap-2 px-1" ariaLabel="New teacher names">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Teacher {i + 1}</span>
                {rows.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove teacher row ${i + 1}`}
                    className="h-6 px-2 text-xs"
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Input
                placeholder="Full name"
                autoComplete="name"
                value={row.fullName}
                onChange={(e) => patchRow(i, { fullName: e.target.value })}
                aria-label={`Teacher ${i + 1} full name`}
              />
            </div>
          ))}
        </ScrollList>
        {rows.length < MAX_ROWS ? (
          <div className="px-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows((prev) => [...prev, { fullName: "" }])}
              className="h-6 self-start border-input bg-white text-black hover:bg-neutral-100 hover:text-black dark:border-transparent dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black"
            >
              <Plus size={14} aria-hidden />
              Add another
            </Button>
          </div>
        ) : null}
        {formError ? (
          <p role="alert" className="px-1 text-center font-sans text-xs text-red-600 dark:text-red-400">
            {formError}
          </p>
        ) : null}
      </KanbanBoard>
    </div>
  );
}

export function TeacherCreateDockRows({ rows }: { rows: TeacherCreateProgress["rows"] }) {
  return (
    <ScrollList as="ul" className="max-h-56 gap-1" ariaLabel="Teachers in this creation">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
          <span className="shrink-0" aria-hidden>
            {r.status === "created" ? (
              <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
            ) : r.status === "failed" ? (
              <XCircle size={15} className="text-destructive" />
            ) : (
              <Loader2 size={15} className="animate-spin text-muted-foreground" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-center text-xs font-medium" title={r.name}>
              {r.name}
            </span>
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {r.status === "created" ? "Added" : r.status === "failed" ? (r.message ?? "Failed") : "Creating…"}
          </span>
        </li>
      ))}
    </ScrollList>
  );
}

export { TEACHER_CREATE_STEPS };
