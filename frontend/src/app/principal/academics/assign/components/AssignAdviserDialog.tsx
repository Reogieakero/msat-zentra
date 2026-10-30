"use client";
import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { AdvisoryEntryRow, type AdvisoryRowEntry } from "./advisory-entry-row";
import type {
  AdvisoryEntryInput,
  GradeLevel,
  Section,
  Teacher,
} from "@/services/principal/assign.types";
import styles from "./form.module.css";
const GRADES: GradeLevel[] = [7, 8, 9, 10, 11, 12];
type Entry = AdvisoryRowEntry;
export function AssignAdviserDialog({
  sections,
  teachers,
  schoolYearName,
  initialGrade,
  initialSectionId,
  isAssigning,
  onClose,
  onSubmit,
  onAssigned,
}: {
  sections: Section[];
  teachers: Teacher[];
  schoolYearName: string;
  initialGrade: GradeLevel | null;
  initialSectionId: string;
  isAssigning: boolean;
  onClose: () => void;
  onSubmit: (entries: AdvisoryEntryInput[]) => void;
  onAssigned: () => void;
}) {
  const initialSection = sections.find((s) => s.id === initialSectionId) ?? null;
  const nextKey = React.useRef(1);
  const submittingRef = React.useRef(false);
  const [grade, setGrade] = React.useState<GradeLevel | null>(initialGrade);
  const [entries, setEntries] = React.useState<Entry[]>(() => [
    {
      key: 0,
      sectionName: initialSection?.name ?? "",
      adviserName: initialSection?.adviserName ?? "",
    },
  ]);
  const [error, setError] = React.useState<string | null>(null);
  // Rows animate out before they unmount — React removes on click otherwise.
  const [exitingKeys, setExitingKeys] = React.useState<number[]>([]);
  const exitTimers = React.useRef<number[]>([]);
  React.useEffect(
    () => () => {
      exitTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );
  const gradeSections = React.useMemo(
    () => (grade == null ? [] : sections.filter((s) => s.gradeLevel === grade)),
    [sections, grade],
  );
  const setEntry = (key: number, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
    setError(null);
  };
  const handlePickSection = (key: number, s: Section) => {
    setEntry(key, { sectionName: s.name, adviserName: s.adviserName ?? "" });
  };
  const addEntry = () => {
    setEntries((prev) => [...prev, { key: nextKey.current++, sectionName: "", adviserName: "" }]);
    setError(null);
  };
  const removeEntry = (key: number) => {
    setError(null);
    if (entries.length <= 1) return;
    setExitingKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    const timer = window.setTimeout(() => {
      setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.key !== key) : prev));
      setExitingKeys((prev) => prev.filter((k) => k !== key));
    }, 150);
    exitTimers.current.push(timer);
  };
  const handleAssign = () => {
    if (submittingRef.current || isAssigning) return;
    if (grade == null) {
      setError("Select a grade level first.");
      return;
    }
    const seen = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const label = entries.length > 1 ? `Row ${i + 1}: ` : "";
      const sectionName = entry.sectionName.trim();
      const adviserName = entry.adviserName.trim();
      if (!sectionName) {
        setError(`${label}Input the section name first.`);
        return;
      }
      const dupKey = `${grade}:${sectionName.toLowerCase()}`;
      if (seen.has(dupKey)) {
        setError(`${label}Duplicate section "${sectionName}" — keep one row per section.`);
        return;
      }
      seen.add(dupKey);
      if (!adviserName) {
        setError(`${label}Input the adviser name first.`);
        return;
      }
    }
    setError(null);
    submittingRef.current = true;
    try {
      onSubmit(
        entries.map((e) => ({
          sectionName: e.sectionName.trim(),
          gradeLevel: grade,
          adviserName: e.adviserName.trim(),
        })),
      );
      onAssigned();
    } finally {
      submittingRef.current = false;
    }
  };
  const canSubmit =
    grade != null && entries.some((e) => e.sectionName.trim() !== "" && e.adviserName.trim() !== "");
  return (
    <KanbanOverlay
      open
      onClose={onClose}
      width="md"
      busy={isAssigning}
      title="Assign Advisory"
      description={
        <>
          One grade level per batch — input each section name and adviser name for{" "}
          <strong>{schoolYearName || "the active school year"}</strong>. Sections that
          don&apos;t exist yet are created automatically. Each assignment mints an
          advisory code — share it with the teacher, they enter it to claim the seat.
        </>
      }
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            size="sm"
            className="h-6 px-3 text-xs"
            onClick={handleAssign}
            disabled={isAssigning || !canSubmit}
            aria-busy={isAssigning || undefined}
          >
            {isAssigning ? (
              <>
                <Loader2 className={styles.btnSpin} aria-hidden />
                <span aria-live="polite">
                  {entries.length > 1 ? `Assigning ${entries.length} advisers…` : "Assigning adviser…"}
                </span>
              </>
            ) : entries.length > 1 ? (
              `Assign ${entries.length} Advisers`
            ) : (
              "Assign Adviser"
            )}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {/* Grade scope card: pill-tab strip + the add-row action top-right so
            the section cards below stay the only full-width blocks. */}
        <div className={styles.gradeCard}>
          <div className={styles.labelRow}>
            <span className={styles.label} id="adviser-dialog-grade-label">
              Grade Level <span className={styles.required}>*</span>
            </span>
            <Button
              type="button"
              variant="outline"
              className={styles.addSectionPill}
              onClick={addEntry}
              disabled={isAssigning}
              aria-label="Add another section"
            >
              <Plus aria-hidden />
              Add section
            </Button>
          </div>
          <div
            className={styles.gradeTabs}
            role="tablist"
            aria-label="Grade level"
            aria-labelledby="adviser-dialog-grade-label"
          >
            {GRADES.map((g) => {
              const active = grade === g;
              return (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={styles.gradeTab}
                  disabled={isAssigning}
                  onClick={() => {
                    setGrade(g);
                    setError(null);
                  }}
                >
                  <Pill tone={active ? "blue" : "neutral"} className={styles.gradeTabPill}>
                    Grade {g}
                  </Pill>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.rowsList}>
          {entries.map((entry, i) => {
            const exiting = exitingKeys.includes(entry.key);
            return (
              <div
                key={entry.key}
                className={`${styles.entryCard} ${exiting ? styles.entryCardExit : ""}`}
              >
                <AdvisoryEntryRow
                  index={i}
                  entry={entry}
                  gradeSections={gradeSections}
                  teachers={teachers}
                  gradeSelected={grade != null}
                  removable={entries.length > 1}
                  disableRemove={isAssigning || exiting}
                  onSectionName={(key, value) => setEntry(key, { sectionName: value })}
                  onPickSection={handlePickSection}
                  onAdviserName={(key, value) => setEntry(key, { adviserName: value })}
                  onPickTeacher={(key, teacher) => setEntry(key, { adviserName: teacher.name })}
                  onRemove={removeEntry}
                />
              </div>
            );
          })}
        </div>
        {error ? (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </KanbanOverlay>
  );
}
