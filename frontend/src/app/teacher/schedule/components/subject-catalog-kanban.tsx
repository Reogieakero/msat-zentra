"use client";

import { useMemo, useState } from "react";
import { BookPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
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
  { key: "G11", label: "Grade 11" },
  { key: "G12", label: "Grade 12" },
] as const;

function categoryLabel(category: string): string {
  return category === "ELECTIVE" ? "Elective" : "Core";
}

interface Props {
  subjects: ScheduleSubject[];
  pending?: boolean;
  loadError?: boolean;
  /** Retained for callers; the catalog no longer renders its own close action. */
  onBack?: () => void;
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
  addOpen,
  onAddOpenChange,
  showGrid = true,
  onCreateProgress,
  onDeleteProgress,
}: Props) {
  const gradeRank = useMemo(() => {
    const map = new Map<string, number>();
    GRADES.forEach((g, i) => map.set(g.key, i));
    return map;
  }, []);

  const [activeGrade, setActiveGrade] = useState<string | null>(null);

  // One table at a time — grade tabs filter the catalog, same pattern as the
  // registry desks' subjects page.
  const filtered = useMemo(() => {
    const list = activeGrade
      ? subjects.filter((s) => s.gradeLevel === activeGrade)
      : subjects;
    return [...list].sort((a, b) => {
      const rank = (gradeRank.get(a.gradeLevel) ?? 99) - (gradeRank.get(b.gradeLevel) ?? 99);
      return rank !== 0 ? rank : a.name.localeCompare(b.name);
    });
  }, [subjects, activeGrade, gradeRank]);

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
            variant="secondary"
            onClick={handleDeleteCancel}
            disabled={deleting}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={selectedIds.length === 0 || deleting}
            className="h-6 gap-1 px-2 text-[11px]"
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
            disabled={subjects.length === 0 || (addOpen && !showGrid)}
            title={
              subjects.length === 0
                ? "No subjects to delete"
                : addOpen && !showGrid
                  ? "Close the add-subject form to delete"
                  : "Delete a subject"
            }
            className="ml-auto h-6 gap-1 px-2 text-[11px]"
          >
            <Trash2 size={12} aria-hidden />
            Delete subject
          </Button>
          <Button
            onClick={() => onAddOpenChange(true)}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            <BookPlus size={12} aria-hidden />
            Add subject
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
          <div
            className="flex flex-col gap-2 rounded-xl border border-border p-2.5"
            aria-busy="true"
            aria-label="Loading subjects"
          >
            <div className="h-4 w-32 rounded bg-muted" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load subjects.
          </p>
        ) : subjects.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center">
            <InsightCallout role="status" className="w-fit max-w-xl text-center">
              No subjects yet — use <strong>Add subject</strong> to create one for this
              term.
            </InsightCallout>
          </div>
        ) : (
          <div
            className={`${styles.boardIn} flex min-h-80 flex-col gap-2 rounded-xl border border-border p-2.5`}
          >
            <div className="relative -mx-2.5 flex items-center border-b border-border px-3 pb-2">
              <span className="text-[13px] font-semibold text-muted-foreground">
                Subjects
              </span>
              <div
                className="absolute top-1/2 left-1/2 flex max-w-full -translate-x-1/2 -translate-y-1/2 flex-wrap items-center justify-center gap-1"
                role="tablist"
                aria-label="Filter subjects by grade"
              >
                {[null, ...GRADES.map((g) => g.key)].map((key) => {
                  const active = activeGrade === key;
                  const label =
                    key === null
                      ? "All"
                      : (GRADES.find((g) => g.key === key)?.label ?? key);
                  return (
                    <button
                      key={key ?? "all"}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveGrade(key)}
                      className="inline-flex cursor-pointer rounded-md p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Pill tone={active ? "blue" : "neutral"}>{label}</Pill>
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <InsightCallout role="status" className="w-fit max-w-full">
                  No {GRADES.find((g) => g.key === activeGrade)?.label ?? "selected grade"}{" "}
                  subjects yet — switch grade tabs or use <strong>Add subject</strong> to
                  create one.
                </InsightCallout>
              </div>
            ) : (
              <div className="px-0.5 pb-0.5">
                <Table className={styles.table}>
                  <TableBody key={activeGrade ?? "all"}>
                    {filtered.map((s, index) => {
                      const checked = deleteMode && selectedIds.includes(s.id);
                      return (
                        <TableRow
                          key={s.id}
                          onClick={deleteMode ? () => toggleSelect(s.id) : undefined}
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
                                onCheckedChange={() => toggleSelect(s.id)}
                                aria-label={`Select ${s.name} (${s.code}) for deletion`}
                              />
                            </TableCell>
                          ) : null}
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <Pill tone="green" label="Subject code">
                              {s.code}
                            </Pill>
                          </TableCell>
                          <TableCell>
                            <Pill tone="blue" label="Grade level">
                              {GRADES.find((g) => g.key === s.gradeLevel)?.label ?? s.gradeLevel}
                            </Pill>
                          </TableCell>
                          <TableCell>
                            <Pill
                              tone={s.category === "ELECTIVE" ? "blue" : "amber"}
                              label="Subject category"
                            >
                              {categoryLabel(s.category)}
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
