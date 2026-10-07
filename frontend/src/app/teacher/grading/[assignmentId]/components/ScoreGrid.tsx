"use client";

import * as React from "react";
import { useSession } from "@/lib/auth/useSession";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
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
import { CardModal } from "@/components/ui/CardModal";
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
  sectionName,
  students,
  components,
  category,
  selectedId,
  onChanged,
}: Props) {
  const refreshAcademic = useRefreshAcademic();
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
  // Stable callbacks (no per-render closures) so effects below never loop.
  const storageKey = React.useCallback(
    (assessmentId: string) => `zentra.score-drafts.${teacherId}.${assessmentId}`,
    [teacherId],
  );
  const readStored = React.useCallback(
    (assessmentId: string): { scores: Record<string, string>; max: string | null } => {
      try {
        if (typeof window === "undefined") return { scores: {}, max: null };
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
    },
    [storageKey],
  );
  const writeStored = React.useCallback(
    (assessmentId: string, scores: Record<string, string>, max: string | null) => {
      try {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(storageKey(assessmentId), JSON.stringify({ scores, max }));
      } catch {
        // Private mode etc. — session drafts still work for the visit.
      }
    },
    [storageKey],
  );
  const clearStored = React.useCallback(
    (assessmentId: string) => {
      try {
        if (typeof window === "undefined") return;
        window.localStorage.removeItem(storageKey(assessmentId));
      } catch {
        // Ignore.
      }
    },
    [storageKey],
  );

  const assessments = React.useMemo(
    () => components.find((c) => c.type === category)?.assessments ?? [],
    [components, category],
  );
  const selected = assessments.find((a) => a.id === selectedId) ?? assessments[0] ?? null;

  // Reset any in-progress edit whenever the assessment changes — restoring
  // locally persisted entries so an interrupted session picks up where it
  // left off. Effect (not render-phase setState): render-phase updates with
  // localStorage I/O + multiple setStates per render blocked the main thread
  // ("Page unresponsive / Wait or Exit") on every click that re-rendered.
  const selectedKey = selected?.id ?? "";
  // Syncs external persisted drafts (localStorage) when the assessment
  // changes — the one legitimate setState-in-effect case here. Previously
  // this ran as render-phase setState + sync localStorage I/O, freezing the
  // main thread on every re-render.
  /* eslint-disable react-hooks/set-state-in-effect -- external localStorage sync on assessment switch */
  React.useEffect(() => {
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
  }, [selectedKey, readStored]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onDraftChange = React.useCallback(
    (assessmentId: string) => (studentId: string, value: string) => {
      // Pure updater (no side effects inside): compute next from prev, then
      // persist outside so StrictMode double-invoke can't double-write.
      let next: Record<string, string> | null = null;
      setDrafts((prev) => {
        next = { ...(prev[assessmentId] ?? {}), [studentId]: value };
        return { ...prev, [assessmentId]: next };
      });
      // Deferred persist: runs after state queues, never blocks the keystroke.
      // maxRef read here (not in updater) — uncontrolled max input.
      const max = maxRef.current?.value ?? null;
      queueMicrotask(() => {
        if (next) writeStored(assessmentId, next, max === "" ? null : max);
      });
    },
    [writeStored],
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
    if (!selected || saving) return;
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
    // Pessimistic mutation: the table keeps showing the saved values with
    // a spinner until the server confirms; only the settled refetch below
    // paints the new scores. Editing stays open on failure with every typed
    // value intact so the teacher retries in place.
    setError(null);
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
      // Confirmed: suppress the matching realtime row so one save yields
      // exactly one toast, then repaint from the server.
      markSelfNotified(selected.id);
      sileo.success({
        title: "Scores saved",
        description:
          jobs.length > 0
            ? `${jobs.length} score${jobs.length === 1 ? "" : "s"} saved for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.`
            : `Max score updated for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.`,
      });
      setEditing(false);
      setRecovered(false);
      setRestoredMax(null);
      typedCache.clear();
      clearStored(selected.id);
      setDrafts((prev) => ({ ...prev, [selected.id]: {} }));
      onChanged();
      refreshAcademic();
    } catch (e) {
      const message =
        e instanceof Error && e.message === "max"
          ? "Failed to update max score."
          : e instanceof Error
            ? `${e.message} — the rest were saved.`
            : "Could not save scores.";
      setError(message);
      sileo.warning({ title: "Scores not fully saved", description: `${message} Review and save again.` });
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
      <CardModal
        open={emptyOpen}
        onClose={() => setEmptyOpen(false)}
        size="sm"
        title="No scores to save"
        description="Enter at least one score before saving."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setEmptyOpen(false)}>Got it</Button>
        </div>
      </CardModal>
      <CardModal
        open={rangeError !== null}
        onClose={() => setRangeError(null)}
        size="sm"
        title="Check scores"
        description={rangeError ?? undefined}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setRangeError(null)}>Got it</Button>
        </div>
      </CardModal>

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

  // Memoized filter state: a fresh `[{...}]` literal every render forced
  // getFilteredRowModel (+ sorted + paginated) to recompute synchronously
  // on every keystroke/click, which stacked with the render-phase resets
  // above into the "Page unresponsive" freeze.
  const columnFilters = React.useMemo(
    () => (nameFilter ? [{ id: "student", value: nameFilter }] : []),
    [nameFilter],
  );

  const table = useReactTable({
    data: students,
    columns,
    getRowId: (row) => row.id,
  onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
    // Header search drives the student column filter — derived during
    // render, never synced in an effect.
    state: {
      sorting,
      columnFilters,
    },
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
