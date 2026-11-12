"use client";

import { useMemo, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
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
  /** Retained for callers; the catalog no longer renders its own close action. */
  onBack?: () => void;
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
    // Delete mode puts a checkbox on every teacher row; the add form stays shut.
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
            variant="secondary"
            onClick={handleDeleteCancel}
            className="h-6 gap-1 px-2 font-sans text-[11px]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.length === 0}
            className="h-6 gap-1 px-2 font-sans text-[11px]"
          >
            <Trash2 size={12} aria-hidden />
            Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </Button>
        </div>
      ) : (
        <div className={styles.header}>
          <Button
            variant="secondary"
            onClick={handleDeleteOpen}
            disabled={teachers.length === 0 || (addOpen && !showList)}
            title={
              teachers.length === 0
                ? "No teachers to delete"
                : addOpen && !showList
                  ? "Close the add-teacher form to delete"
                  : "Delete a teacher"
            }
            className="ml-auto h-6 gap-1 px-2 font-sans text-[11px]"
          >
            <Trash2 size={12} aria-hidden />
            Delete teacher
          </Button>
          <Button
            onClick={() => onAddOpenChange(true)}
            className="h-6 gap-1 px-2 font-sans text-[11px]"
          >
            <UserPlus size={12} aria-hidden />
            Add teacher
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
          <div
            className="flex flex-col gap-2 rounded-xl border border-border p-2.5"
            aria-busy="true"
            aria-label="Loading teachers"
          >
            <div className="h-4 w-32 rounded bg-muted" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <p role="alert" className="font-sans text-sm text-destructive">
            Could not load teachers.
          </p>
        ) : teachers.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center">
            <InsightCallout role="status" className="w-fit max-w-xl text-center font-sans">
              No teachers yet — use <strong>Add teacher</strong> to build the name list.
            </InsightCallout>
          </div>
        ) : (
          <div
            className={`${styles.boardIn} flex min-h-80 flex-col gap-2 rounded-xl border border-border p-2.5`}
          >
            <div className="relative -mx-2.5 flex items-center justify-end gap-2 border-b border-border px-3 pb-2">
              <div className="w-44 sm:w-56">
                <Input
                  placeholder="Search name…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search teachers"
                  className="h-8 rounded-2xl px-3 font-sans text-[11px]"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <InsightCallout role="status" className="w-fit max-w-full">
                  No teachers match “{q.trim()}” — clear the search or use{" "}
                  <strong>Add teacher</strong> to create one.
                </InsightCallout>
              </div>
            ) : (
              <div className="px-0.5 pb-0.5">
                <Table className={styles.table}>
                  <TableBody key={needle || "all"}>
                    {filtered.map((t, index) => {
                      const checked = deleteMode && selectedIds.includes(t.id);
                      return (
                        <TableRow
                          key={t.id}
                          onClick={deleteMode ? () => toggleSelect(t.id) : undefined}
                          className={`border-b border-border${
                            deleteMode
                              ? ` cursor-pointer${checked ? " bg-red-500/5 dark:bg-red-500/10" : ""}`
                              : ""
                          }`}
                          style={{ animationDelay: `${40 + Math.min(index, 8) * 35}ms` }}
                        >
                          {deleteMode ? (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleSelect(t.id)}
                                aria-label={`Select ${t.name} for deletion`}
                              />
                            </TableCell>
                          ) : null}
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>
                            <TeacherCodePill code={t.code} />
                          </TableCell>
                          <TableCell>
                            <Pill
                              tone={t.linked ? "green" : "neutral"}
                              label={t.linked ? "Linked account" : "Name only"}
                            >
                              {t.linked ? "Linked" : "Name only"}
                            </Pill>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}
