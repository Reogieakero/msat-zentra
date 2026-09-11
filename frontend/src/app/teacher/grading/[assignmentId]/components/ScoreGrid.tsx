"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  COMPONENT_NAMES,
  COMPONENT_ORDER,
  submitScore,
  useRefreshAcademic,
  type ClassAssessment,
  type ClassComponent,
  type ClassStudent,
  type ComponentType,
} from "../../components/grading-data";
import styles from "./ScoreGrid.module.css";

const SHORT: Record<ComponentType, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

type Props = {
  students: ClassStudent[];
  components: ClassComponent[];
  onChanged: () => void;
};

export function ScoreGrid({ students, components, onChanged }: Props) {
  const refreshAcademic = useRefreshAcademic();
  const unregistered = students.filter((s) => !s.hasAccount);
  const [category, setCategory] = React.useState<ComponentType>("WRITTEN_WORK");
  const [selectedId, setSelectedId] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const assessments = React.useMemo(
    () => components.find((c) => c.type === category)?.assessments ?? [],
    [components, category],
  );
  const selected = assessments.find((a) => a.id === selectedId) ?? assessments[0] ?? null;

  const countFor = (t: ComponentType) =>
    components.find((c) => c.type === t)?.assessments.length ?? 0;

  const savedOf = (assessment: ClassAssessment, studentId: string) =>
    assessment.scores[studentId] != null ? String(assessment.scores[studentId]) : "";

  const startEdit = () => {
    if (!selected) return;
    setDrafts((prev) => ({
      ...prev,
      [selected.id]: Object.fromEntries(students.map((s) => [s.id, savedOf(selected, s.id)])),
    }));
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setError(null);
    setEditing(false);
  };

  const handleSaveAll = async () => {
    if (!selected) return;
    const table = drafts[selected.id] ?? {};
    const jobs: { studentId: string; raw: number }[] = [];
    for (const s of students) {
      const raw = (table[s.id] ?? "").trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > selected.maxScore) {
        setError(`${s.name}: scores must be numbers from 0 to ${selected.maxScore}.`);
        return;
      }
      jobs.push({ studentId: s.id, raw: value });
    }
    if (jobs.length === 0) {
      setError("Enter at least one score before saving.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        jobs.map((j) => submitScore(selected.id, { studentId: j.studentId, rawScore: j.raw })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setError(`${failed} score${failed === 1 ? "" : "s"} failed to save — the rest were saved.`);
      } else {
        setEditing(false);
      }
      onChanged();
      refreshAcademic();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeadRow}>
        <div>
          <h2 className={styles.cardTitle}>Encode scores</h2>
          <p className={styles.cardSub}>
            Pick the category, then the assessment — enter raw scores and save them all at once.
          </p>
        </div>
        {assessments.length > 0 && selected ? (
          <div className={styles.cardActions}>
            {editing ? (
              <>
                <Button onClick={() => void handleSaveAll()} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
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
          </div>
        ) : null}
      </div>

      <div className={styles.pickerRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="encode-category-label">
            Category
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${category !== "WRITTEN_WORK" ? styles.filterActive : ""}`}
                aria-labelledby="encode-category-label"
              >
                {SHORT[category]}
                {category !== "WRITTEN_WORK" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden className={styles.filterChevron} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={styles.filterMenu}>
              {COMPONENT_ORDER.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t}
                  checked={category === t}
                  onCheckedChange={() => {
                    setCategory(t);
                    setSelectedId("");
                    setEditing(false);
                    setError(null);
                  }}
                >
                  {SHORT[t]} · {COMPONENT_NAMES[t]} ({countFor(t)})
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="encode-assessment-label">
            Assessment
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={styles.filterBtn}
                disabled={assessments.length === 0}
                aria-labelledby="encode-assessment-label"
              >
                <span className={styles.filterValue}>
                  {selected ? selected.title : "Select assessment"}
                </span>
                <ChevronDown aria-hidden className={styles.filterChevron} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={styles.filterMenu}>
              {assessments.map((a) => (
                <DropdownMenuCheckboxItem
                  key={a.id}
                  checked={selected?.id === a.id}
                  onCheckedChange={() => {
                    setSelectedId(a.id);
                    setEditing(false);
                    setError(null);
                  }}
                >
                  {a.title}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {assessments.length === 0 ? (
        <p className={styles.empty}>
          No {COMPONENT_NAMES[category].toLowerCase()} assessments yet — use Add assessment above.
        </p>
      ) : selected ? (
        <ScoreTable
          assessment={selected}
          students={students}
          editing={editing}
          drafts={drafts[selected.id] ?? {}}
          onDraftChange={(studentId, value) =>
            setDrafts((prev) => ({
              ...prev,
              [selected.id]: { ...(prev[selected.id] ?? {}), [studentId]: value },
            }))
          }
        />
      ) : null}

      {unregistered.length > 0 ? (
        <p className={styles.hint}>
          {unregistered.length} enlisted student{unregistered.length === 1 ? "" : "s"} ({unregistered.map((u) => u.name).join(", ")}){" "}
          {unregistered.length === 1 ? "has" : "have"} no account yet — scores are kept and carry over on registration.
        </p>
      ) : null}
    </div>
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
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.stickyCol}>Student</th>
            <th>
              Score <span className={styles.scorePct}>/ {assessment.maxScore}</span>
            </th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const val = shownOf(s.id);
            const num = Number(val);
            const pct =
              val.trim() !== "" && Number.isFinite(num) && assessment.maxScore > 0
                ? `${((num / assessment.maxScore) * 100).toFixed(1)}%`
                : "—";
            return (
              <tr key={s.id}>
                <th className={styles.stickyCol} scope="row">
                  <div className={styles.nameCell}>
                    <span>{s.name}</span>
                    {!s.hasAccount ? (
                      <Badge variant="outline">No account</Badge>
                    ) : null}
                  </div>
                  <div className={styles.scorePct}>{s.lrn}</div>
                </th>
                <td>
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
                </td>
                <td>
                  <span className={styles.scorePct}>{pct}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
