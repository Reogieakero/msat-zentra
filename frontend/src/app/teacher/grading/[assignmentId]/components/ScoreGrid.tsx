"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
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

const SHORT: Record<ComponentType, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

type Props = {
  students: ClassStudent[];
  components: ClassComponent[];
  category: ComponentType;
  selectedId: string;
  onChanged: () => void;
};

export function ScoreGrid({ students, components, category, selectedId, onChanged }: Props) {
  const refreshAcademic = useRefreshAcademic();
  const unregistered = students.filter((s) => !s.hasAccount);
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

  // Selection now comes from the sidebar — reset any in-progress edit
  // (including the max draft) whenever the assessment changes.
  // (Render-phase reset: allowed because it is conditional on prop change.)
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

  const scoredCount = selected
    ? students.filter((s) => selected.scores[s.id] != null).length
    : 0;

  return (
    <Card className={styles.card} aria-label="Encode scores">
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>Encode scores</p>
          {selected ? (
            <>
              <h2 className={styles.metaLine}>
                <span className={styles.metaLabel}>Assessment</span>
                <span className={styles.metaValue}>{selected.title}</span>
                <span className={styles.metaSep} aria-hidden />
                <span className={styles.metaLabel}>Category</span>
                <span className={styles.metaValue}>
                  {SHORT[category]} {COMPONENT_NAMES[category]}
                </span>
              </h2>
              <p className={styles.sectionSub}>
                Given {selected.dateGiven}, max{" "}
                {editing ? (
                  <input
                    className={styles.maxInput}
                    inputMode="numeric"
                    aria-label="Max score"
                    value={maxDraft ?? ""}
                    onChange={(e) => setMaxDraft(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                ) : (
                  selected.maxScore
                )}
              </p>
            </>
          ) : (
            <>
              <h2 className={styles.metaLine}>
                <span className={styles.metaLabel}>Category</span>
                <span className={styles.metaValue}>
                  {SHORT[category]} {COMPONENT_NAMES[category]}
                </span>
              </h2>
              <p className={styles.sectionSub}>
                No assessment yet — use Add assessment in the sidebar to create one.
              </p>
            </>
          )}
        </div>
        {assessments.length > 0 && selected ? (
          <CardAction className={styles.headerActions}>
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

      <CardContent className={styles.content}>
        {error ? <p className={styles.errorText}>{error}</p> : null}

        {assessments.length === 0 || !selected ? (
          <p className={styles.empty}>
            No {COMPONENT_NAMES[category].toLowerCase()} assessments yet — use Add assessment in the sidebar.
          </p>
        ) : (
          <ScoreTable
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

      <CardFooter className={styles.footer}>
        <p className={styles.range}>
          {scoredCount} of {students.length} scored
        </p>
        {unregistered.length > 0 ? (
          <p className={styles.hint}>
            {unregistered.length} without account — scores carry over on registration.
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function ScoreTable({
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
  if (students.length === 0) {
    return <p className={styles.empty}>No students in this section yet.</p>;
  }

  // Display reads saved values; inputs read drafts while editing.
  const shownOf = (studentId: string) =>
    editing
      ? (drafts[studentId] ?? "")
      : assessment.scores[studentId] != null
        ? String(assessment.scores[studentId])
        : "";

  return (
    <Table aria-label={`Scores for ${assessment.title}`}>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>LRN</TableHead>
          <TableHead>
            Score <span className={styles.headMuted}>/ {assessment.maxScore}</span>
          </TableHead>
          <TableHead>%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => {
          const val = shownOf(s.id);
          const num = Number(val);
          const pct =
            val.trim() !== "" && Number.isFinite(num) && assessment.maxScore > 0
              ? `${((num / assessment.maxScore) * 100).toFixed(1)}%`
              : "—";
          return (
            <TableRow key={s.id}>
              <TableCell>
                <p className={styles.cellMain}>{s.name}</p>
              </TableCell>
              <TableCell>
                <span className={styles.lrnCell}>{s.lrn}</span>
              </TableCell>
              <TableCell>
                {editing ? (
                  <input
                    className={styles.scoreInput}
                    inputMode="decimal"
                    aria-label={`${assessment.title} score for ${s.name}`}
                    value={val}
                    onChange={(e) => onDraftChange(s.id, e.target.value)}
                  />
                ) : (
                  <span className={styles.scoreValue}>{val.trim() === "" ? "—" : val}</span>
                )}
              </TableCell>
              <TableCell>
                <span className={styles.scorePct}>{pct}</span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
