"use client";
import * as React from "react";
import { useSession } from "@/lib/auth/useSession";
import { Loader2, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { CardModal } from "@/components/ui/CardModal";
import { COMPONENT_NAMES } from "@/services/teacher/grading.compute";
import { useQueryClient } from "@tanstack/react-query";
import { submitScore, submitScores, updateAssessment, classDetailKey } from "@/services/teacher/grading.service";
import { useTerm } from "@/lib/term/TermContext";
import { apiErrorMessage } from "@/lib/api/errors";
import type { ClassDetail, ClassStudent, ClassComponent, ComponentType } from "@/services/teacher/grading.types";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import styles from "./ScoreGrid.module.css";
import { useScoreDrafts } from "./use-score-drafts";
import { clearStoredDrafts, typedCache } from "./score-storage";
import { PlainEncodeTable } from "./encode-table";
import { ScoreDataTable } from "./score-data-table";
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
      let failures: string[] = [];
      try {
        if (dirty.length > 0) {
          const bulk = await submitScores(
            selected.id,
            dirty.map((j) => ({ studentId: j.studentId, rawScore: j.raw }))
          );
          failures = (bulk.results ?? [])
            .filter((r) => !r.ok)
            .map((r) => {
              const name = students.find((s) => s.id === r.studentId)?.name ?? r.studentId;
              return `${name}: ${r.error ?? "save failed"}`;
            });
        }
      } catch (e) {
        // Fallback for transport-level errors: retry per-item so a single
        // bad row can't sink the whole batch without a per-student reason.
        const results = await Promise.allSettled(dirty.map((j) => submitScore(selected.id, { studentId: j.studentId, rawScore: j.raw })));
        failures = results
          .map((r, i) => ({ result: r, job: dirty[i] as { studentId: string; raw: number } }))
          .filter((x): x is { result: PromiseRejectedResult; job: { studentId: string; raw: number } } => x.result.status === "rejected")
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
        throw new Error(`${failures.length} score${failures.length === 1 ? "" : "s"} failed to save (${shown}${more})`);
      }
      markSelfNotified(selected.id);
      typedCache.clear();
      clearStoredDrafts(teacherId, selected.id);
      clear();
      // Background reconcile only — the UI already shows the saved values.
      // Single targeted invalidation, not the whole academic overview.
      onChanged();
      // Toast fires only after the server confirms, never before.
      sileo.success({ title: "Scores saved", description: dirty.length > 0 ? `${dirty.length} score${dirty.length === 1 ? "" : "s"} saved for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.` : `Max score updated for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.` });
    } catch (e) {
      const message = e instanceof Error && e.message === "max" ? "Failed to update max score." : e instanceof Error ? `${e.message} — the rest were saved.` : "Could not save scores.";
      setError(message);
      sileo.warning({ title: "Scores not fully saved", description: `${message} Review and save again.` });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={assign.card} aria-label="Encode scores">
      <span className={assign.glowClip} aria-hidden="true"><span className={assign.cardGlow} /></span>
      <CardHeader className={`${styles.header} relative`}>
        {assessments.length > 0 && selected ? (
          <CardAction className={`${styles.headerActions} w-full justify-between`}>
            {editing ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Max
                <input ref={maxRef} key={selected.id} className={styles.maxInput} inputMode="numeric" aria-label="Max score" defaultValue={restoredMax ?? selected.maxScore} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); e.target.value = v; writeMax(v === "" ? null : v); }} />
              </label>
            ) : (<span />)}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <InputGroup className="max-w-40"><InputGroupInput placeholder="Search..." value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} aria-label="Filter students" /><InputGroupAddon><SearchIcon /></InputGroupAddon></InputGroup>
              {editing ? (<><Button onClick={() => void handleSaveAll()} disabled={saving} aria-busy={saving || undefined}>{saving ? (<><Loader2 className="animate-spin" aria-hidden />Saving scores…</>) : ("Save")}</Button><Button variant="destructive" onClick={cancelEdit} disabled={saving}>Cancel</Button></>) : saving ? (<Button disabled aria-busy="true"><Loader2 className="animate-spin" aria-hidden />Saving…</Button>) : (<Button variant="outline" onClick={startEdit}>Edit scores</Button>)}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardModal open={emptyOpen} onClose={() => setEmptyOpen(false)} size="sm" title="No scores to save" description="Enter at least one score before saving."><div className="flex justify-end gap-2"><Button onClick={() => setEmptyOpen(false)}>Got it</Button></div></CardModal>
      <CardModal open={rangeError !== null} onClose={() => setRangeError(null)} size="sm" title="Check scores" description={rangeError ?? undefined}><div className="flex justify-end gap-2"><Button onClick={() => setRangeError(null)}>Got it</Button></div></CardModal>
      <CardContent className={`${styles.content} relative`}>
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {recovered && editing ? (<p className={styles.recovered} role="status">Recovered unsaved entries from your last visit — review and save.</p>) : null}
        {assessments.length === 0 || !selected ? (<p className={styles.empty}>No {COMPONENT_NAMES[category].toLowerCase()} assessments yet — use the Add assessment card.</p>) : editing ? (<PlainEncodeTable assessment={selected} students={students} drafts={scores} nameFilter={nameFilter} onDraftChange={onDraft} />) : (<ScoreDataTable assessment={selected} students={students} drafts={scores} nameFilter={nameFilter} />)}
      </CardContent>
    </div>
  );
}
