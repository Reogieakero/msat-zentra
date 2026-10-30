"use client";
import * as React from "react";
import { useSession } from "@/lib/auth/useSession";
import { ClipboardList, FileText, Loader2, PenLine, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { formatSurnameFirst } from "@/lib/names";
import { CardModal } from "@/components/ui/CardModal";
import { COMPONENT_NAMES } from "@/services/teacher/grading.compute";
import { useQueryClient } from "@tanstack/react-query";
import { submitScore, submitScores, updateAssessment, classDetailKey } from "@/services/teacher/grading.service";
import { useTerm } from "@/lib/term/TermContext";
import { apiErrorMessage } from "@/lib/api/errors";
import type { ClassDetail, ClassStudent, ClassComponent, ComponentType } from "@/services/teacher/grading.types";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { useScoreSave } from "./score-save-context";
import type { ScoreSaveRow } from "./ScoreSaveDock";
import styles from "./ScoreGrid.module.css";
import { useScoreDrafts } from "./use-score-drafts";
import { clearStoredDrafts, typedCache } from "./score-storage";
import { PlainEncodeTable } from "./encode-table";
import { ScoreDataTable } from "./score-data-table";

const CATEGORY_COLOR: Record<ComponentType, string> = {
  WRITTEN_WORK: "#3b82f6",
  PERFORMANCE_TASK: "#f59e0b",
  EXAM: "#ef4444",
};

const CATEGORY_ICON = {
  WRITTEN_WORK: PenLine,
  PERFORMANCE_TASK: ClipboardList,
  EXAM: FileText,
} as const;
type Props = {
  queryKeyId: string;
  sectionName: string;
  students: ClassStudent[];
  components: ClassComponent[];
  category: ComponentType;
  selectedId: string;
  onChanged: () => void;
}
export function ScoreGrid({ queryKeyId, sectionName, students, components, category, selectedId, onChanged }: Props) {
  const queryClient = useQueryClient();
  const { activeTerm } = useTerm();
  const session = useSession();
  const { reportScorePhase } = useScoreSave();
  const teacherId = session?.sub ?? "anon";
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nameFilter, setNameFilter] = React.useState("");
  const [emptyOpen, setEmptyOpen] = React.useState(false);
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  const assessments = React.useMemo(() => components.find((c) => c.type === category)?.assessments ?? [], [components, category]);
  const selected = assessments.find((a) => a.id === selectedId) ?? assessments[0] ?? null;
  const selectedKey = selected?.id ?? "";
  const { scores, recovered, restoredMax, onDraft, clear, writeMax, maxRef } = useScoreDrafts(teacherId, selectedKey);
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setEditing(false);
    setError(null);
  }, [selectedKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const startEdit = () => {
    if (!selected) return;
    setError(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    setError(null);
    setEditing(false);
    clear();
  };
  const handleSaveAll = async () => {
    if (!selected || saving) return;
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
    const jobs: { studentId: string; raw: number }[] = [];
    for (const s of students) {
      const raw = (scores[s.id] ?? "").trim();
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
    // Dirty-only: skip rows whose value already matches the saved score, so
    // re-saving or touching a cell without changing it sends nothing.
    // Cleared cells keep existing skip semantics (never delete).
    const maxChanged = effectiveMax !== selected.maxScore;
    const dirty = maxChanged
      ? jobs
      : jobs.filter((j) => {
          const saved = selected.scores[j.studentId];
          return saved === undefined || saved === null ? true : j.raw !== saved;
        });
    if (dirty.length === 0 && !maxChanged) {
      setEmptyOpen(true);
      return;
    }
    // Root-level dock opens this tick and keeps settling even if the user
    // navigates away mid-flight.
    const dockPills = [COMPONENT_NAMES[category], `Max ${effectiveMax}`, sectionName];
    const dockRows: ScoreSaveRow[] = dirty.map((j) => ({
      id: j.studentId,
      name: formatSurnameFirst(
        students.find((s) => s.id === j.studentId)?.name ?? j.studentId,
      ),
      meta: `${j.raw} / ${effectiveMax}`,
      state: "saving" as const,
    }));
    const dockDetail = { title: selected.title, pills: dockPills, rows: dockRows };
    reportScorePhase("saving", dockDetail, `Saving scores for "${selected.title}"…`);
    setError(null);
    setSaving(true);
    // Optimistic paint: patch the cached class detail so the read view shows
    // the new scores instantly, then reconcile against the server response.
    // No full-page refetch flash; the grid stays interactive.
    // NOTE: the query key uses the route-level composite id (subject|section),
    // NOT assignment.id — the backend may return the raw assignment UUID in
    // `detail.assignment.id`, which would patch a cache entry nobody renders.
    const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
    const detailKey = classDetailKey(teacherId, queryKeyId, termKey);
    const scoreByStudent = new Map(dirty.map((j) => [j.studentId, j.raw]));
    const previous = queryClient.getQueryData<ClassDetail>(detailKey);
    const applyOptimistic = () => {
      queryClient.setQueryData<ClassDetail>(detailKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          components: old.components.map((c) => ({
            ...c,
            assessments: c.assessments.map((a) =>
              a.id === selected.id
                ? { ...a, maxScore: effectiveMax, scores: { ...a.scores, ...Object.fromEntries(scoreByStudent) } }
                : a,
            ),
          })),
        };
      });
    };
    const rollbackOptimistic = () => {
      if (previous) queryClient.setQueryData(detailKey, previous);
      else queryClient.invalidateQueries({ queryKey: detailKey });
    };
    // Show the saved values immediately and leave edit mode at once.
    // Paint even for max-score-only edits so the header updates instantly.
    if (dirty.length > 0 || maxChanged) applyOptimistic();
    setEditing(false);
    let failures: string[] = [];
    const failedIds = new Set<string>();
    let dockSettled = false;
    const settleError = (message: string) => {
      dockSettled = true;
      reportScorePhase(
        "error",
        {
          title: selected.title,
          pills: dockPills,
          rows: dockRows.map((r): ScoreSaveRow => ({
            ...r,
            state: failedIds.size === 0 || failedIds.has(r.id) ? "failed" : "saved",
          })),
        },
        message,
      );
    };
    try {
      if (effectiveMax !== selected.maxScore) {
        try {
          await updateAssessment(selected.id, { maxScore: effectiveMax });
        } catch {
          rollbackOptimistic();
          setEditing(true);
          throw new Error("max");
        }
      }
      try {
        if (dirty.length > 0) {
          const bulk = await submitScores(
            selected.id,
            dirty.map((j) => ({ studentId: j.studentId, rawScore: j.raw }))
          );
          const bad = (bulk.results ?? []).filter((r) => !r.ok);
          for (const r of bad) failedIds.add(r.studentId);
          failures = bad
            .map((r) => {
              const name = students.find((s) => s.id === r.studentId)?.name ?? r.studentId;
              return `${name}: ${r.error ?? "save failed"}`;
            });
        }
      } catch (e) {
        // Fallback for transport-level errors: retry per-item so a single
        // bad row can't sink the whole batch without a per-student reason.
        const results = await Promise.allSettled(dirty.map((j) => submitScore(selected.id, { studentId: j.studentId, rawScore: j.raw })));
        const rejected = results
          .map((r, i) => ({ result: r, job: dirty[i] as { studentId: string; raw: number } }))
          .filter((x): x is { result: PromiseRejectedResult; job: { studentId: string; raw: number } } => x.result.status === "rejected");
        for (const { job } of rejected) failedIds.add(job.studentId);
        failures = rejected
          .map(({ result, job }) => {
            const name = students.find((s) => s.id === job.studentId)?.name ?? job.studentId;
            return `${name}: ${apiErrorMessage(result.reason, "save failed")}`;
          });
      }
      if (failures.length > 0) {
        // Partial failure: revalidate from the server so bad rows revert.
        queryClient.invalidateQueries({ queryKey: detailKey });
        onChanged();
        setEditing(true);
        const shown = failures.slice(0, 5).join("; ");
        const more = failures.length > 5 ? ` (+${failures.length - 5} more)` : "";
        const message = `${failures.length} score${failures.length === 1 ? "" : "s"} failed to save (${shown}${more})`;
        settleError(message);
        throw new Error(message);
      }
      markSelfNotified(selected.id);
      typedCache.clear();
      clearStoredDrafts(teacherId, selected.id);
      clear();
      // Background reconcile only — the UI already shows the saved values.
      // Single targeted invalidation, not the whole academic overview.
      onChanged();
      reportScorePhase(
        "saved",
        {
          title: selected.title,
          pills: dockPills,
          rows: dockRows.map((r) => ({ ...r, state: "saved" as const })),
        },
        dirty.length > 0 ? `${dirty.length} score${dirty.length === 1 ? "" : "s"} saved for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.` : `Max score updated for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.`,
      );
    } catch (e) {
      const message = e instanceof Error && e.message === "max" ? "The max score was not updated — the encoded scores are unchanged." : e instanceof Error ? `${e.message} — the rest were saved.` : "The scores were not saved — check your connection.";
      setError(message);
      // Partial failures already settled the dock above — settle anything
      // else here so the dock never sticks on "saving".
      if (!dockSettled) settleError(message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div key={selected?.id ?? "empty"} className={styles.enter}>
    <KanbanBoard
      title={selected ? selected.title : COMPONENT_NAMES[category]}
      icon={(() => {
        const Icon = CATEGORY_ICON[category] ?? ClipboardList;
        return (
          <span aria-hidden style={{ color: CATEGORY_COLOR[category] ?? "#f59e0b" }}>
            <Icon size={14} />
          </span>
        );
      })()}
      count={
        selected ? `${students.filter((s) => selected.scores[s.id] != null).length}/${students.length} scored` : undefined
      }
      description={
        selected ? (
          <span className="flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1">
              <Pill tone="amber" label="Assessment category">{COMPONENT_NAMES[category]}</Pill>
              <Pill tone="amber" label="Maximum score">Max {selected.maxScore}</Pill>
              <Pill tone="amber" label="Section">{sectionName}</Pill>
            </span>
            <InputGroup className="max-w-40 shrink-0 rounded-[16px]">
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
          </span>
        ) : null
      }
      actions={
        selected ? (
          <span className="flex flex-wrap items-center gap-2">
            {editing ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Max
                <input ref={maxRef} key={selected.id} className={styles.maxInput} inputMode="numeric" aria-label="Max score" defaultValue={restoredMax ?? selected.maxScore} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); e.target.value = v; writeMax(v === "" ? null : v); }} />
              </label>
            ) : null}
            {editing ? (
              <>
                <Button size="sm" className="h-6 px-3 text-xs" onClick={() => void handleSaveAll()} disabled={saving} aria-busy={saving || undefined}>
                  {saving ? (<><Loader2 className="animate-spin" aria-hidden size={14} />Saving scores…</>) : ("Save")}
                </Button>
                <Button
                  size="sm"
                  className="h-6 bg-red-500 px-3 text-xs text-white hover:bg-red-600"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </>
            ) : saving ? (
              <Button size="sm" className="h-6 px-3 text-xs" disabled aria-busy="true">
                <Loader2 className="animate-spin" aria-hidden size={14} />Saving…
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-6 px-3 text-xs" onClick={startEdit}>
                Edit scores
              </Button>
            )}
          </span>
        ) : null
      }
      ariaLabel={selected ? `Encode scores for ${selected.title}` : undefined}
      boardLabel={
        selected
          ? `${selected.title}, ${students.filter((s) => selected.scores[s.id] != null).length} of ${students.length} scored`
          : undefined
      }
    >
      <CardModal open={emptyOpen} onClose={() => setEmptyOpen(false)} size="sm" title="No scores to save" description="Enter at least one score before saving."><div className="flex justify-end gap-2"><Button onClick={() => setEmptyOpen(false)}>Got it</Button></div></CardModal>
      <CardModal open={rangeError !== null} onClose={() => setRangeError(null)} size="sm" title="Check scores" description={rangeError ?? undefined}><div className="flex justify-end gap-2"><Button onClick={() => setRangeError(null)}>Got it</Button></div></CardModal>
      {error ? <p className={styles.errorText}>{error}</p> : null}
      {recovered && editing ? (<p className={styles.recovered} role="status">Recovered unsaved entries from your last visit — review and save.</p>) : null}
      {assessments.length === 0 || !selected ? (
        <KanbanBoardEmpty>No {COMPONENT_NAMES[category].toLowerCase()} assessments yet — use the Add assessment card.</KanbanBoardEmpty>
      ) : editing ? (
        <PlainEncodeTable assessment={selected} students={students} drafts={scores} nameFilter={nameFilter} onDraftChange={onDraft} />
      ) : (
        <ScoreDataTable assessment={selected} students={students} drafts={scores} nameFilter={nameFilter} />
      )}
    </KanbanBoard>
    </div>
  );
}
