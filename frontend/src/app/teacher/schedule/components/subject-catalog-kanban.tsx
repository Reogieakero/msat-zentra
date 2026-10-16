"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import type { ScheduleSubject } from "../page";
import { SubjectAddKanban } from "./subject-add-kanban";
import {
  SubjectDeleteConfirm,
  useSubjectDelete,
  type SubjectDeleteProgress,
} from "./subject-delete-kanban";
import type { SubjectCreateProgress } from "./use-add-subjects";
import styles from "./subject-kanban.module.css";

const GRADES = [
  { key: "G7", label: "Grade 7" },
  { key: "G8", label: "Grade 8" },
  { key: "G9", label: "Grade 9" },
  { key: "G10", label: "Grade 10" },
] as const;

function categoryLabel(category: string): string {
  return category === "ELECTIVE" ? "Elective" : "Core";
}

interface Props {
  subjects: ScheduleSubject[];
  pending?: boolean;
  loadError?: boolean;
  onBack: () => void;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  /** Hide the grade grid — form card only (used when Add subject was picked directly). */
  showGrid?: boolean;
  /** Creation progress reporter (page renders the dock outside the kanban). */
  onCreateProgress?: (p: SubjectCreateProgress | null) => void;
  /** Deletion progress reporter (page renders the dock outside the kanban). */
  onDeleteProgress?: (p: SubjectDeleteProgress | null) => void;
}

export function SubjectCatalogKanban({
  subjects,
  pending,
  loadError,
  onBack,
  addOpen,
  onAddOpenChange,
  showGrid = true,
  onCreateProgress,
  onDeleteProgress,
}: Props) {
  const byGrade = useMemo(() => {
    const map = new Map<string, ScheduleSubject[]>();
    for (const g of GRADES) map.set(g.key, []);
    for (const s of subjects) {
      const bucket = map.get(s.gradeLevel);
      if (bucket) bucket.push(s);
      else map.set(s.gradeLevel, [s]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [subjects]);

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { deleteSubjects, deleting } = useSubjectDelete(onDeleteProgress);

  const selected = useMemo(
    () => subjects.filter((s) => selectedIds.includes(s.id)),
    [subjects, selectedIds],
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleDeleteOpen = () => {
    // Delete mode puts a checkbox on every subject card; the add form stays shut.
    onAddOpenChange(false);
    setSelectedIds([]);
    setConfirmOpen(false);
    setDeleteMode(true);
  };

  const handleDeleteCancel = () => {
    setDeleteMode(false);
    setSelectedIds([]);
    setConfirmOpen(false);
  };

  const handleDeleteConfirm = () => {
    const targets = selected;
    setConfirmOpen(false);
    setDeleteMode(false);
    setSelectedIds([]);
    void deleteSubjects(targets);
  };

  return (
    <div className={styles.view} aria-label="All subjects by grade level">
      {deleteMode ? (
        <div className={styles.header}>
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {selectedIds.length === 0
              ? "Tick the box on each subject to delete"
              : `${selectedIds.length} selected`}
          </span>
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.length === 0 || deleting}
            className="h-6 border border-red-600/50 bg-transparent px-3 text-red-600 hover:bg-red-600/10 hover:text-red-600 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={14} aria-hidden />
            Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </Button>
          <Button
            size="sm"
            onClick={handleDeleteCancel}
            disabled={deleting}
            className="h-6 border-transparent bg-red-600 px-3 text-white hover:bg-red-700 hover:text-white dark:border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:hover:text-white"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className={styles.header}>
          <Button
            size="sm"
            onClick={() => onAddOpenChange(true)}
            className="ml-auto h-6 border-transparent bg-white text-black hover:bg-neutral-200 hover:text-black dark:border-transparent dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black"
          >
            <Plus size={14} aria-hidden />
            Add subject
          </Button>
          <Button
            size="sm"
            onClick={handleDeleteOpen}
            disabled={subjects.length === 0 || (addOpen && !showGrid)}
            title={
              subjects.length === 0
                ? "No subjects to delete"
                : addOpen && !showGrid
                  ? "Close the add-subject form to delete"
                  : "Delete a subject"
            }
            className="h-6 border border-red-600/50 bg-transparent px-3 text-red-600 hover:bg-red-600/10 hover:text-red-600 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={14} aria-hidden />
            Delete subject
          </Button>
          <Button
            size="sm"
            onClick={onBack}
            className="h-6 border-transparent bg-red-600 px-3 text-white hover:bg-red-700 hover:text-white dark:border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:hover:text-white"
          >
            Close
          </Button>
        </div>
      )}

      {addOpen && !deleteMode ? (
        <SubjectAddKanban onClose={() => onAddOpenChange(false)} onProgress={onCreateProgress} />
      ) : null}

      {confirmOpen && selected.length > 0 ? (
        <SubjectDeleteConfirm
          subjects={selected}
          pending={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {showGrid ? (
        pending ? (
        <div className={styles.grid} aria-busy="true" aria-label="Loading subjects">
          {GRADES.map((g) => (
            <div key={g.key} className="flex min-h-40 flex-col gap-2 rounded-xl border border-border p-2.5">
              <div className="h-4 w-24 rounded bg-muted" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-muted" />
              ))}
            </div>
          ))}
        </div>
      ) : loadError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load subjects.
        </p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No subjects yet — add one to get started.
        </p>
      ) : (
        <div className={styles.grid} role="list" aria-label="Subjects grouped by grade level">
          {GRADES.map((g, colIdx) => {
            const list = byGrade.get(g.key) ?? [];
            return (
              <div
                key={g.key}
                role="listitem"
                aria-label={`${g.label} subjects`}
                className={styles.column}
                style={{ animationDelay: `${colIdx * 70}ms` }}
              >
                <KanbanBoard
                  title={g.label}
                  count={<span className="text-amber-600 dark:text-amber-500">{list.length}</span>}
                  className="h-full"
                >
                  {list.length === 0 ? (
                    <p className={styles.empty}>No {g.label} subjects.</p>
                  ) : (
                    <ScrollList className="max-h-[46dvh] gap-[0.375rem] pr-[2px]" ariaLabel={`${g.label} list`}>
                      {list.map((s, cardIdx) => {
                        const checked = deleteMode && selectedIds.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            className={`${styles.card} ${deleteMode ? "cursor-pointer" : ""} ${checked ? "border-red-500/60 bg-red-500/5 dark:border-red-500/60" : ""}`}
                            style={{ animationDelay: `${colIdx * 70 + Math.min(cardIdx, 8) * 35}ms` }}
                            onClick={deleteMode ? () => toggleSelect(s.id) : undefined}
                          >
                            {deleteMode ? (
                              <span
                                className="flex shrink-0 items-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleSelect(s.id)}
                                  aria-label={`Select ${s.name} (${s.code}) for deletion`}
                                />
                              </span>
                            ) : null}
                            <span
                              className={`${styles.name} ${deleteMode ? "flex-1" : ""}`}
                              title={`${s.name} (${s.code})`}
                            >
                              {s.name} <span className={styles.code}>({s.code})</span>
                            </span>
                            <span className={styles.meta}>
                              <span
                                className={`${styles.pill} ${s.category === "ELECTIVE" ? styles.pillElective : styles.pillCore}`}
                              >
                                {categoryLabel(s.category)}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </ScrollList>
                  )}
                </KanbanBoard>
              </div>
            );
          })}
        </div>
        )
      ) : null}
    </div>
  );
}
