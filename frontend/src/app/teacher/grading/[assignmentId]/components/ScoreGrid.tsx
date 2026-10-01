"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/useSession";
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
import { Loader2, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import {
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  classDetailKey,
  computeSubjectGrade,
  subjectEvidence,
  submitScore,
  updateAssessment,
  useRefreshAcademic,
  type ClassAssessment,
  type ClassComponent,
  type ClassDetail,
  type ClassStudent,
  type ComponentType,
} from "../../components/grading-data";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import styles from "./ScoreGrid.module.css";

// Score inputs accept numbers only — strip any letters or symbols,
// keeping digits and a single decimal point.
function sanitizeScore(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length <= 2 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;
}

/* Self-contained score input. Uncontrolled on purpose: keystrokes only
   touch the DOM (sanitized inline) and write through to the parent drafts,
   so no React state update — and no re-render — happens while typing. Focus
   can never be stolen mid-entry. A module-level cache restores the latest
   typed value even if the cell remounts, so digits are never lost.
   Remounts — via key — reset to saved values on edit start/cancel/save
   and assessment switches. */
const typedCache = new Map<string, string>();

function ScoreCellInput({
  cacheKey,
  initial,
  studentName,
  assessmentTitle,
  onDraft,
}: {
  cacheKey: string;
  initial: string;
  studentName: string;
  assessmentTitle: string;
  onDraft: (value: string) => void;
}) {
  return (
    <input
      className={styles.scoreInput}
      inputMode="decimal"
      defaultValue={typedCache.get(cacheKey) ?? initial}
      aria-label={`${assessmentTitle} score for ${studentName}`}
      onChange={(e) => {
        e.target.value = sanitizeScore(e.target.value);
        typedCache.set(cacheKey, e.target.value);
        onDraft(e.target.value);
      }}
    />
  );
}

type Props = {
  assignmentId: string;
  sectionName: string;
  students: ClassStudent[];
  components: ClassComponent[];
  category: ComponentType;
  selectedId: string;
  onChanged: () => void;
};

export function ScoreGrid({
  assignmentId,
  sectionName,
  students,
  components,
  category,
  selectedId,
  onChanged,
}: Props) {
  const refreshAcademic = useRefreshAcademic();
  const queryClient = useQueryClient();
  const session = useSession();
  const teacherId = session?.sub ?? "anon";
  const [editing, setEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nameFilter, setNameFilter] = React.useState("");
  const [emptyOpen, setEmptyOpen] = React.useState(false);
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  const [recovered, setRecovered] = React.useState(false);
  const [restoredMax, setRestoredMax] = React.useState<string | null>(null);
  const maxRef = React.useRef<HTMLInputElement>(null);

  // Local persistence: unsaved entries survive refresh, navigation, or
  // brownouts. Scoped per teacher + assessment; cleared on save/cancel.
  const storageKey = (assessmentId: string) =>
    `zentra.score-drafts.${teacherId}.${assessmentId}`;
  const readStored = (assessmentId: string): { scores: Record<string, string>; max: string | null } => {
    try {
      const raw = window.localStorage.getItem(storageKey(assessmentId));
      if (!raw) return { scores: {}, max: null };
      const parsed = JSON.parse(raw) as { scores?: Record<string, string>; max?: string | null };
      if (parsed && typeof parsed === "object") {
        return { scores: parsed.scores ?? {}, max: parsed.max ?? null };
      }
    } catch {
      // Corrupt entry — treat as empty below.
    }
    return { scores: {}, max: null };
  };
  const writeStored = (assessmentId: string, scores: Record<string, string>, max: string | null) => {
    try {
      window.localStorage.setItem(storageKey(assessmentId), JSON.stringify({ scores, max }));
    } catch {
      // Private mode etc. — session drafts still work for the visit.
    }
  };
  const clearStored = (assessmentId: string) => {
    try {
      window.localStorage.removeItem(storageKey(assessmentId));
    } catch {
      // Ignore.
    }
  };

  const assessments = React.useMemo(
    () => components.find((c) => c.type === category)?.assessments ?? [],
    [components, category],
  );
  const selected = assessments.find((a) => a.id === selectedId) ?? assessments[0] ?? null;

  // Reset any in-progress edit whenever the assessment changes — restoring
  // locally persisted entries so an interrupted session picks up where it
  // left off. (Render-phase reset: allowed because it is conditional.)
  const selectedKey = selected?.id ?? "";
  const [resetKey, setResetKey] = React.useState("");
  if (resetKey !== selectedKey) {
    setResetKey(selectedKey);
    setEditing(false);
    setRecovered(false);
    setRestoredMax(null);
    setError(null);
    typedCache.clear();
    if (selectedKey) {
      const stored = readStored(selectedKey);
      if (Object.keys(stored.scores).length > 0) {
        setDrafts({ [selectedKey]: stored.scores });
        for (const [k, v] of Object.entries(stored.scores)) {
          typedCache.set(`${selectedKey}:${k}`, v);
        }
        setRecovered(true);
      } else {
        setDrafts({});
      }
      if (stored.max !== null) setRestoredMax(stored.max);
    } else {
      setDrafts({});
    }
  }

  const onDraftChange = React.useCallback(
    (assessmentId: string) => (studentId: string, value: string) =>
      setDrafts((prev) => {
        const next = { ...(prev[assessmentId] ?? {}), [studentId]: value };
        writeStored(assessmentId, next, maxRef.current?.value ?? null);
        return { ...prev, [assessmentId]: next };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teacherId],
  );

  const startEdit = () => {
    if (!selected) return;
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setError(null);
    setEditing(false);
    setRecovered(false);
    setRestoredMax(null);
    typedCache.clear();
    if (selected) {
      clearStored(selected.id);
      setDrafts((prev) => ({ ...prev, [selected.id]: {} }));
    }
  };

  const handleSaveAll = async () => {
    if (!selected) return;
    // Resolve the edited max score first — scores validate against it.
    // Read straight from the DOM: the max input is uncontrolled so typing
    // there never re-renders either.
    let effectiveMax = selected.maxScore;
    const maxRaw = (maxRef.current?.value ?? "").trim();
    if (maxRaw !== String(selected.maxScore)) {
      if (maxRaw === "") {
        setError("Max score must be a number greater than 0.");
        return;
      }
      const parsed = Number(maxRaw);
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
        setRangeError(`${s.name}: scores must be numbers from 0 to ${effectiveMax}.`);
        return;
      }
      jobs.push({ studentId: s.id, raw: value });
    }
    if (jobs.length === 0 && effectiveMax === selected.maxScore) {
      setEmptyOpen(true);
      return;
    }
    // Optimistic mutation: paint the saved scores (and new max) into the
    // cached class detail immediately, so the table updates in the same
    // frame with no refresh. The network below only confirms; a failure
    // rolls the cache back and reopens editing with values intact.
    const detailKey = classDetailKey(teacherId, assignmentId);
    const previous = queryClient.getQueryData<ClassDetail>(detailKey);
    if (previous) {
      const nextScores = { ...selected.scores };
      for (const j of jobs) nextScores[j.studentId] = j.raw;
      const nextComponents = previous.components.map((c) => ({
        ...c,
        assessments: c.assessments.map((a) =>
          a.id === selected.id
            ? { ...a, maxScore: effectiveMax, scores: nextScores }
            : a,
        ),
      }));
      queryClient.setQueryData<ClassDetail>(detailKey, {
        ...previous,
        components: nextComponents,
        students: previous.students.map((s) => {
          const job = jobs.find((j) => j.studentId === s.id);
          if (!job || !s.final) return s;
          // Assessment-driven twin (grading-data): normalized shares over
          // evidenced categories, null when nothing to grade on.
          const result = computeSubjectGrade(subjectEvidence(nextComponents, s.id));
          if (result.computedAverage === null || result.transmutedGrade === null) {
            return s;
          }
          return {
            ...s,
            final: {
              ...s.final,
              computedAverage: result.computedAverage,
              transmutedGrade: result.transmutedGrade,
              remarks: result.remarks ?? s.final.remarks,
            },
          };
        }),
      });
    }
    setError(null);
    setEditing(false);
    setRecovered(false);
    setRestoredMax(null);
    typedCache.clear();
    clearStored(selected.id);
    setDrafts((prev) => ({ ...prev, [selected.id]: {} }));
    // Instant confirmation with full context (section · category ·
    // assessment); the matching realtime row is suppressed by markSelfNotified
    // so one save still yields exactly one toast — the numbers were already
    // painted optimistically (UI first).
    markSelfNotified(selected.id);
    sileo.success({
      title: "Scores saved",
      description:
        jobs.length > 0
          ? `${jobs.length} score${jobs.length === 1 ? "" : "s"} saved for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.`
          : `Max score updated for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.`,
    });
    setSaving(true);
    try {
      if (effectiveMax !== selected.maxScore) {
        try {
          await updateAssessment(selected.id, { maxScore: effectiveMax });
        } catch {
          throw new Error("max");
        }
      }
      const results = await Promise.allSettled(
        jobs.map((j) => submitScore(selected.id, { studentId: j.studentId, rawScore: j.raw })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        throw new Error(`${failed} score${failed === 1 ? "" : "s"} failed to save`);
      }
      onChanged();
      refreshAcademic();
    } catch (e) {
      // Roll back the optimistic paint and reopen editing with every typed
      // value restored — nothing is lost, and the teacher retries in place.
      if (previous) queryClient.setQueryData(detailKey, previous);
      const message =
        e instanceof Error && e.message === "max"
          ? "Failed to update max score."
          : e instanceof Error
            ? `${e.message} — the rest were saved.`
            : "Could not save scores.";
      setError(message);
      sileo.warning({ title: "Scores not fully saved", description: `${message} Review and save again.` });
      setDrafts({
        [selected.id]: Object.fromEntries(jobs.map((j) => [j.studentId, String(j.raw)])),
      });
      for (const j of jobs) typedCache.set(`${selected.id}:${j.studentId}`, String(j.raw));
      setEditing(true);
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
          <CardAction className={`${styles.headerActions} w-full justify-between`}>
            {editing ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Max
                <input
                  ref={maxRef}
                  key={selected.id}
                  className={styles.maxInput}
                  inputMode="numeric"
                  aria-label="Max score"
                  defaultValue={restoredMax ?? selected.maxScore}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    e.target.value = v;
                    writeStored(
                      selected.id,
                      drafts[selected.id] ?? {},
                      v === "" ? null : v,
                    );
                  }}
                />
              </label>
            ) : (
              <span />
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
            <InputGroup className="max-w-40">
              <InputGroupInput
                placeholder="Search..."
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                aria-label="Filter students"
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
            {editing ? (
              <>
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
                <Button variant="destructive" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
              </>
            ) : saving ? (
              <Button disabled aria-busy="true">
                <Loader2 className="animate-spin" aria-hidden />
                Saving…
              </Button>
            ) : (
              <Button variant="outline" onClick={startEdit}>
                Edit scores
              </Button>
            )}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <Dialog open={emptyOpen} onOpenChange={(open) => { if (!open) setEmptyOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>No scores to save</DialogTitle>
            <DialogDescription>
              Enter at least one score before saving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setEmptyOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={rangeError !== null} onOpenChange={(open) => { if (!open) setRangeError(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Check scores</DialogTitle>
            <DialogDescription>
              {rangeError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setRangeError(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardContent className={`${styles.content} relative`}>
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {recovered && editing ? (
          <p className={styles.recovered} role="status">
            Recovered unsaved entries from your last visit — review and save.
          </p>
        ) : null}

        {assessments.length === 0 || !selected ? (
          <p className={styles.empty}>
            No {COMPONENT_NAMES[category].toLowerCase()} assessments yet — use the Add assessment card.
          </p>
        ) : editing ? (
          <PlainEncodeTable
            assessment={selected}
            students={students}
            drafts={drafts[selected.id] ?? {}}
            nameFilter={nameFilter}
            onDraftChange={onDraftChange(selected.id)}
          />
        ) : (
          <ScoreDataTable
            assessment={selected}
            students={students}
            drafts={drafts[selected.id] ?? {}}
            nameFilter={nameFilter}
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

/* Plain encode table: no data-table pipeline while typing — static rows,
   uncontrolled inputs, zero library state. Used only in edit mode so
   nothing can disturb consecutive keystrokes. */
function PlainEncodeTable({
  assessment,
  students,
  drafts,
  nameFilter,
  onDraftChange,
}: {
  assessment: ClassAssessment;
  students: ClassStudent[];
  drafts: Record<string, string>;
  nameFilter: string;
  onDraftChange: (studentId: string, value: string) => void;
}) {
  const q = nameFilter.trim().toLowerCase();
  const rows = q
    ? students.filter(
        (s) => s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q),
      )
    : students;
  if (students.length === 0) {
    return <p className={styles.empty}>No students in this section yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="w-full table-fixed" aria-label={`Encode scores for ${assessment.title}`}>
        <TableHeader>
          <TableRow className="bg-muted/50 [&>th]:border-t-0">
            <TableHead style={{ width: 220 }}>Student</TableHead>
            <TableHead style={{ width: 140 }}>LRN</TableHead>
            <TableHead style={{ width: 130 }}>Score / {assessment.maxScore}</TableHead>
            <TableHead style={{ width: 100 }}>%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No students match your search.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => {
              const savedText =
                assessment.scores[s.id] != null ? String(assessment.scores[s.id]) : "";
              const { num } = scoreOf(assessment, drafts, true, s.id);
              const shownNum = num ?? (savedText !== "" ? Number(savedText) : null);
              return (
                <TableRow key={s.id}>
                  <TableCell style={{ width: 220 }} className="truncate">
                    <p className={styles.cellMain}>{s.name}</p>
                  </TableCell>
                  <TableCell style={{ width: 140 }} className="truncate">
                    <span className={styles.lrnCell}>{s.lrn}</span>
                  </TableCell>
                  <TableCell style={{ width: 130 }} className="truncate">
                    <ScoreCellInput
                      key={`${assessment.id}:${s.id}`}
                      cacheKey={`${assessment.id}:${s.id}`}
                      initial={drafts[s.id] ?? savedText}
                      studentName={s.name}
                      assessmentTitle={assessment.title}
                      onDraft={(value) => onDraftChange(s.id, value)}
                    />
                  </TableCell>
                  <TableCell style={{ width: 100 }} className="truncate">
                    <span className={styles.scorePct}>
                      {shownNum !== null && assessment.maxScore > 0
                        ? `${((shownNum / assessment.maxScore) * 100).toFixed(1)}%`
                        : "—"}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ScoreDataTable({
  assessment,
  students,
  drafts,
  nameFilter,
}: {
  assessment: ClassAssessment;
  students: ClassStudent[];
  drafts: Record<string, string>;
  nameFilter: string;
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
        accessorFn: (row) => scoreOf(assessment, drafts, false, row.id).num ?? -1,
        header: `Score / ${assessment.maxScore}`,
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => {
          const { text } = scoreOf(assessment, drafts, false, row.original.id);
          return (
            <span className={styles.scoreValue}>{text.trim() === "" ? "—" : text}</span>
          );
        },
      },
      {
        id: "pct",
        accessorFn: (row) => {
          const { num } = scoreOf(assessment, drafts, false, row.id);
          return num !== null && assessment.maxScore > 0
            ? (num / assessment.maxScore) * 100
            : -1;
        },
        header: "%",
        size: 100,
        minSize: 100,
        maxSize: 100,
        cell: ({ row }) => {
          const { num } = scoreOf(assessment, drafts, false, row.original.id);
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
    [assessment, drafts],
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
      columnFilters: nameFilter ? [{ id: "student", value: nameFilter }] : [],
    },
    state: { sorting, columnFilters },
  });

  // Header search drives the student column filter.
  React.useEffect(() => {
    table.getColumn("student")?.setFilterValue(nameFilter || undefined);
  }, [table, nameFilter]);

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
