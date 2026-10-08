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
import { submitScore, updateAssessment, useRefreshAcademic } from "@/services/teacher/grading.service";
import type { ClassStudent, ClassComponent, ComponentType } from "@/services/teacher/grading.types";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import styles from "./ScoreGrid.module.css";
import { useScoreDrafts } from "./use-score-drafts";
import { clearStoredDrafts, typedCache } from "./score-storage";
import { PlainEncodeTable } from "./encode-table";
import { ScoreDataTable } from "./score-data-table";
type Props = {
  assignmentId: string;
  sectionName: string;
  students: ClassStudent[];
  components: ClassComponent[];
  category: ComponentType;
  selectedId: string;
  onChanged: () => void;
}
export function ScoreGrid({ sectionName, students, components, category, selectedId, onChanged }: Props) {
  const refreshAcademic = useRefreshAcademic();
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
      const results = await Promise.allSettled(jobs.map((j) => submitScore(selected.id, { studentId: j.studentId, rawScore: j.raw })));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw new Error(`${failed} score${failed === 1 ? "" : "s"} failed to save`);
      markSelfNotified(selected.id);
      sileo.success({ title: "Scores saved", description: jobs.length > 0 ? `${jobs.length} score${jobs.length === 1 ? "" : "s"} saved for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.` : `Max score updated for ${selected.title} (${COMPONENT_NAMES[category]}) in ${sectionName}.` });
      setEditing(false);
      typedCache.clear();
      clearStoredDrafts(teacherId, selected.id);
      clear();
      onChanged();
      refreshAcademic();
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
