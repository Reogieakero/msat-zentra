"use client";

import * as React from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import {
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COMPONENT_NAMES,
  submitScore,
  updateAssessment,
  useRefreshAcademic,
  type ClassAssessment,
  type ClassComponent,
  type ClassStudent,
  type ComponentType,
} from "../../components/grading-data";
import { sileo } from "@/components/ui/sonner";
import styles from "./ScoreGrid.module.css";

type Props = {
  students: ClassStudent[];
  components: ClassComponent[];
  category: ComponentType;
  selectedId: string;
  onChanged: () => void;
};

export function ScoreGrid({
  students,
  components,
  category,
  selectedId,
  onChanged,
}: Props) {
  const refreshAcademic = useRefreshAcademic();
  const [editing, setEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, Record<string, string>>>({});
  const [maxDraft, setMaxDraft] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const assessments = React.useMemo(
    () => components.find((c) => c.type === category)?.assessments ?? [],
    [components, category],
  );
  const selected = assessments.find((a) => a.id === selectedId) ?? assessments[0] ?? null;

  // Reset any in-progress edit (including the max draft) whenever the
  // assessment changes. (Render-phase reset: allowed because it is
  // conditional on prop change.)
  const selectedKey = selected?.id ?? "";
  const [resetKey, setResetKey] = React.useState(selectedKey);
  if (resetKey !== selectedKey) {
    setResetKey(selectedKey);
    setEditing(false);
    setMaxDraft(null);
    setError(null);
  }

  const savedOf = (assessment: ClassAssessment, studentId: string) =>
    assessment.scores[studentId] != null ? String(assessment.scores[studentId]) : "";

  // Score inputs accept numbers only — strip any letters or symbols,
  // keeping digits and a single decimal point.
  const sanitizeDraft = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    return parts.length <= 2 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;
  };

  const startEdit = () => {
    if (!selected) return;
    setDrafts((prev) => ({
      ...prev,
      [selected.id]: Object.fromEntries(students.map((s) => [s.id, savedOf(selected, s.id)])),
    }));
    setMaxDraft(String(selected.maxScore));
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setError(null);
    setEditing(false);
    setMaxDraft(null);
  };

  const handleSaveAll = async () => {
    if (!selected) return;
    // Resolve the edited max score first — scores validate against it.
    let effectiveMax = selected.maxScore;
    if (maxDraft !== null) {
      if (maxDraft.trim() === "") {
        setError("Max score must be a number greater than 0.");
        return;
      }
      const parsed = Number(maxDraft);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Max score must be a number greater than 0.");
        return;
      }
      effectiveMax = parsed;
    }
    const table = drafts[selected.id] ?? {};
    const jobs: { studentId: string; raw: number }[] = [];
    for (const s of students) {
      const raw = (table[s.id] ?? "").trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > effectiveMax) {
        setError(`${s.name}: scores must be numbers from 0 to ${effectiveMax}.`);
        return;
      }
      jobs.push({ studentId: s.id, raw: value });
    }
    if (jobs.length === 0 && effectiveMax === selected.maxScore) {
      setError("Enter at least one score before saving.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (effectiveMax !== selected.maxScore) {
        try {
          await updateAssessment(selected.id, { maxScore: effectiveMax });
        } catch {
          setError("Failed to update max score.");
          sileo.error({ title: "Could not update max score", description: "Try again." });
          return;
        }
      }
      const results = await Promise.allSettled(
        jobs.map((j) => submitScore(selected.id, { studentId: j.studentId, rawScore: j.raw })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        const message = `${failed} score${failed === 1 ? "" : "s"} failed to save — the rest were saved.`;
        setError(message);
        sileo.warning({ title: "Scores partially saved", description: message });
      } else {
        setEditing(false);
        setMaxDraft(null);
        sileo.success({
          title: "Scores saved",
          description:
            jobs.length > 0
              ? `${jobs.length} score${jobs.length === 1 ? "" : "s"} saved for ${selected.title}.`
              : `Max score updated for ${selected.title}.`,
        });
      }
      onChanged();
      refreshAcademic();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={assign.card} aria-label="Encode scores">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <CardHeader className={`${styles.header} relative`}>
        {assessments.length > 0 && selected ? (
          <CardAction className={styles.headerActions}>
            {editing ? (
              <>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Max
                  <input
                    className={styles.maxInput}
                    inputMode="numeric"
                    aria-label="Max score"
                    value={maxDraft ?? ""}
                    onChange={(e) => setMaxDraft(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </label>
                <Button onClick={() => void handleSaveAll()} disabled={saving} aria-busy={saving || undefined}>
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden />
                      Saving scores…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={startEdit}>
                Edit scores
              </Button>
            )}
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className={`${styles.content} relative`}>
        {error ? <p className={styles.errorText}>{error}</p> : null}

        {assessments.length === 0 || !selected ? (
          <p className={styles.empty}>
            No {COMPONENT_NAMES[category].toLowerCase()} assessments yet — use the Add assessment card.
          </p>
        ) : (
          <ScoreDataTable
            assessment={selected}
            students={students}
            editing={editing}
            drafts={drafts[selected.id] ?? {}}
            onDraftChange={(studentId, value) =>
              setDrafts((prev) => ({
                ...prev,
                [selected.id]: { ...(prev[selected.id] ?? {}), [studentId]: sanitizeDraft(value) },
              }))
            }
          />
        )}
      </CardContent>

    </div>
  );
}

function scoreOf(
  assessment: ClassAssessment,
  drafts: Record<string, string>,
  editing: boolean,
  studentId: string,
): { text: string; num: number | null } {
  const text = editing
    ? (drafts[studentId] ?? "")
    : assessment.scores[studentId] != null
      ? String(assessment.scores[studentId])
      : "";
  const num = Number(text);
  return {
    text,
    num: text.trim() !== "" && Number.isFinite(num) ? num : null,
  };
}

function ScoreDataTable({
  assessment,
  students,
  editing,
  drafts,
  onDraftChange,
}: {
  assessment: ClassAssessment;
  students: ClassStudent[];
  editing: boolean;
  drafts: Record<string, string>;
  onDraftChange: (studentId: string, value: string) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columns = React.useMemo<ColumnDef<ClassStudent>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <p className={styles.cellMain}>{row.original.name}</p>
        ),
      },
      {
        id: "lrn",
        accessorFn: (row) => row.lrn,
        header: "LRN",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => (
          <span className={styles.lrnCell}>{row.original.lrn}</span>
        ),
      },
      {
        id: "score",
        accessorFn: (row) => scoreOf(assessment, drafts, editing, row.id).num ?? -1,
        header: `Score / ${assessment.maxScore}`,
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => {
          const { text } = scoreOf(assessment, drafts, editing, row.original.id);
          return editing ? (
            <input
              className={styles.scoreInput}
              inputMode="decimal"
              aria-label={`${assessment.title} score for ${row.original.name}`}
              value={text}
              onChange={(e) => onDraftChange(row.original.id, e.target.value)}
            />
          ) : (
            <span className={styles.scoreValue}>{text.trim() === "" ? "—" : text}</span>
          );
        },
      },
      {
        id: "pct",
        accessorFn: (row) => {
          const { num } = scoreOf(assessment, drafts, editing, row.id);
          return num !== null && assessment.maxScore > 0
            ? (num / assessment.maxScore) * 100
            : -1;
        },
        header: "%",
        size: 100,
        minSize: 100,
        maxSize: 100,
        cell: ({ row }) => {
          const { num } = scoreOf(assessment, drafts, editing, row.original.id);
          return (
            <span className={styles.scorePct}>
              {num !== null && assessment.maxScore > 0
                ? `${((num / assessment.maxScore) * 100).toFixed(1)}%`
                : "—"}
            </span>
          );
        },
      },
    ],
    [assessment, drafts, editing, onDraftChange],
  );

  const table = useReactTable({
    data: students,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
    state: { sorting, columnFilters },
  });

  if (students.length === 0) {
    return <p className={styles.empty}>No students in this section yet.</p>;
  }

  // Display reads saved values; inputs read drafts while editing. Drafts
  // are keyed by student, so paging, sorting, and filtering never lose edits.
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="overflow-x-auto rounded-md border">
        <Table className="w-full table-fixed" aria-label={`Scores for ${assessment.title}`}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                    className="h-10 cursor-pointer truncate whitespace-nowrap select-none"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="truncate"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No students match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} student
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
