"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import type { CatalogTeacher } from "./use-schedule-catalog";
import { TeacherAddKanban } from "./teacher-add-kanban";
import {
  TeacherCodePill,
  TeacherDeleteConfirm,
  useTeacherDelete,
  type TeacherDeleteProgress,
} from "./teacher-delete-kanban";
import type { TeacherCreateProgress } from "./use-add-teachers";
import styles from "./subject-kanban.module.css";

interface Props {
  teachers: CatalogTeacher[];
  pending?: boolean;
  loadError?: boolean;
  onBack: () => void;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  /** Hide the list — form card only. */
  showList?: boolean;
  /** Creation progress reporter (page renders the dock outside the kanban). */
  onCreateProgress?: (p: TeacherCreateProgress | null) => void;
  /** Deletion progress reporter (page renders the dock outside the kanban). */
  onDeleteProgress?: (p: TeacherDeleteProgress | null) => void;
}

export function TeacherCatalogKanban({
  teachers,
  pending,
  loadError,
  onBack,
  addOpen,
  onAddOpenChange,
  showList = true,
  onCreateProgress,
  onDeleteProgress,
}: Props) {
  const [q, setQ] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { deleteTeachers } = useTeacherDelete(onDeleteProgress);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      needle === ""
        ? teachers
        : teachers.filter((t) => t.name.toLowerCase().includes(needle)),
    [teachers, needle],
  );

  const selected = useMemo(
    () => teachers.filter((t) => selectedIds.includes(t.id)),
    [teachers, selectedIds],
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleDeleteOpen = () => {
    // Delete mode puts a checkbox on every teacher card; the add form stays shut.
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
    void deleteTeachers(targets);
  };

  return (
    <div className={styles.view} aria-label="All teachers">
      {deleteMode ? (
        <div className={styles.header}>
          <span className="ml-auto font-sans text-xs text-muted-foreground" aria-live="polite">
            {selectedIds.length === 0
              ? "Tick the box on each teacher to delete"
              : `${selectedIds.length} selected`}
          </span>
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.length === 0}
            className="h-6 border border-red-600/50 bg-transparent px-3 font-sans text-red-600 hover:bg-red-600/10 hover:text-red-600 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={14} aria-hidden />
            Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </Button>
          <Button
            size="sm"
            onClick={handleDeleteCancel}
            className="h-6 border-transparent bg-red-600 px-3 font-sans text-white hover:bg-red-700 hover:text-white dark:border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:hover:text-white"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className={styles.header}>
          <Button
            size="sm"
            onClick={() => onAddOpenChange(true)}
            className="ml-auto h-6 border-transparent bg-white font-sans text-black hover:bg-neutral-200 hover:text-black dark:border-transparent dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black"
          >
            <Plus size={14} aria-hidden />
            Add teacher
          </Button>
          <Button
            size="sm"
            onClick={handleDeleteOpen}
            disabled={teachers.length === 0 || (addOpen && !showList)}
            title={
              teachers.length === 0
                ? "No teachers to delete"
                : addOpen && !showList
                  ? "Close the add-teacher form to delete"
                  : "Delete a teacher"
            }
            className="h-6 border border-red-600/50 bg-transparent px-3 font-sans text-red-600 hover:bg-red-600/10 hover:text-red-600 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={14} aria-hidden />
            Delete teacher
          </Button>
          <Button
            size="sm"
            onClick={onBack}
            className="h-6 border-transparent bg-red-600 px-3 font-sans text-white hover:bg-red-700 hover:text-white dark:border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:hover:text-white"
          >
            Close
          </Button>
        </div>
      )}

      {addOpen && !deleteMode ? (
        <TeacherAddKanban onClose={() => onAddOpenChange(false)} onProgress={onCreateProgress} />
      ) : null}

      {confirmOpen && selected.length > 0 ? (
        <TeacherDeleteConfirm
          teachers={selected}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {showList ? (
        pending ? (
          <div className={styles.column} aria-busy="true" aria-label="Loading teachers">
            <KanbanBoard title="Teachers" className="h-full">
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 rounded-lg bg-muted" />
                ))}
              </div>
            </KanbanBoard>
          </div>
        ) : loadError ? (
          <p role="alert" className="font-sans text-sm text-destructive">
            Could not load teachers.
          </p>
        ) : teachers.length === 0 && !addOpen ? (
          <p className="font-sans text-sm text-muted-foreground">
            No teachers yet — add one to get started.
          </p>
        ) : (
          <div className={`${styles.column} mx-auto w-full max-w-3xl`}>
            <KanbanBoard
              title="Teachers"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <Users size={14} />
                </span>
              }
              count={<span className="text-amber-600 dark:text-amber-500">{filtered.length}</span>}
              description={`${teachers.length} name${teachers.length === 1 ? "" : "s"} total. Type a name once, pick it forever.`}
              className="h-full"
              toolbar={
                <div className="px-1">
                  <Input
                    placeholder="Search name…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Search teachers"
                  />
                </div>
              }
            >
              {filtered.length === 0 ? (
                <p className={styles.empty}>No matches.</p>
              ) : (
                <ScrollList className="max-h-[50dvh] gap-1.5 px-1" role="list" ariaLabel="Teachers">
                  {filtered.map((t, idx) => {
                    const checked = deleteMode && selectedIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        role="listitem"
                        className={`${styles.card} ${deleteMode ? "cursor-pointer" : ""} ${checked ? "border-red-500/60 bg-red-500/5 dark:border-red-500/60" : ""}`}
                        style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                        onClick={deleteMode ? () => toggleSelect(t.id) : undefined}
                      >
                        {deleteMode ? (
                          <span
                            className="flex shrink-0 items-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleSelect(t.id)}
                              aria-label={`Select ${t.name} for deletion`}
                            />
                          </span>
                        ) : null}
                        <span
                          className={`${styles.name} ${deleteMode ? "flex-1" : ""} font-sans`}
                          title={t.name}
                        >
                          {t.name}
                        </span>
                        <span className={styles.meta}>
                          <TeacherCodePill code={t.code} />
                        </span>
                      </div>
                    );
                  })}
                </ScrollList>
              )}
            </KanbanBoard>
          </div>
        )
      ) : null}
    </div>
  );
}
