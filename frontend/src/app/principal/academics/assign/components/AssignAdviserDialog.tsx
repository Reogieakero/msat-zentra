"use client";

import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownSelect } from "./DropdownSelect";
import type {
  AdvisoryEntryInput,
  GradeLevel,
  Section,
  Teacher,
} from "../api";
import styles from "./form.module.css";

// Principal is school-wide — every grade band (G7–G12).
const GRADES: GradeLevel[] = [7, 8, 9, 10, 11, 12];

const MAX_SUGGESTIONS = 6;

function matchByName<T extends { name: string }>(rows: T[], query: string): T | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return rows.find((r) => r.name.toLowerCase() === q);
}

function suggestByName<T extends { id: string; name: string }>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return rows.filter((r) => r.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
}

type Entry = {
  key: number;
  sectionName: string;
  adviserName: string;
};

type RowProps = {
  index: number;
  entry: Entry;
  gradeSections: Section[];
  teachers: Teacher[];
  gradeSelected: boolean;
  removable: boolean;
  disableRemove: boolean;
  onSectionName: (key: number, value: string) => void;
  onPickSection: (key: number, section: Section) => void;
  onAdviserName: (key: number, value: string) => void;
  onPickTeacher: (key: number, teacher: Teacher) => void;
  onRemove: (key: number) => void;
};

function AdvisoryEntryRow({
  index,
  entry,
  gradeSections,
  teachers,
  gradeSelected,
  removable,
  disableRemove,
  onSectionName,
  onPickSection,
  onAdviserName,
  onPickTeacher,
  onRemove,
}: RowProps) {
  const [sectionFocus, setSectionFocus] = React.useState(false);
  const [adviserFocus, setAdviserFocus] = React.useState(false);

  const matchedSection = React.useMemo(
    () => (gradeSelected ? matchByName(gradeSections, entry.sectionName) : undefined),
    [gradeSections, gradeSelected, entry.sectionName],
  );
  // Typed name matches nothing on file → this row will create the section.
  const isNewSection =
    gradeSelected && entry.sectionName.trim() !== "" && !matchedSection;
  const matchedTeacher = React.useMemo(
    () => matchByName(teachers, entry.adviserName),
    [teachers, entry.adviserName],
  );
  const sectionSuggestions = React.useMemo(
    () => (gradeSelected ? suggestByName(gradeSections, entry.sectionName) : []),
    [gradeSections, gradeSelected, entry.sectionName],
  );
  const teacherSuggestions = React.useMemo(
    () => suggestByName(teachers, entry.adviserName),
    [teachers, entry.adviserName],
  );

  return (
    <div>
      <div className={styles.rowHead}>
        <span className={styles.rowTitle}>
          Section {index + 1}
          {isNewSection ? <span className={styles.newBadge}>New</span> : null}
        </span>
        {removable ? (
          <Button
            variant="ghost"
            size="xs"
            className={styles.rowRemove}
            aria-label={`Remove section ${index + 1}`}
            disabled={disableRemove}
            onClick={() => onRemove(entry.key)}
          >
            <X aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <Label className={styles.label} htmlFor={`adviser-dialog-section-${entry.key}`}>
            Section Name <span className={styles.required}>*</span>
          </Label>
          <div className={styles.suggestWrap}>
            <Input
              id={`adviser-dialog-section-${entry.key}`}
              value={entry.sectionName}
              placeholder={gradeSelected ? "Type section name" : "Select a grade first"}
              disabled={!gradeSelected}
              autoComplete="off"
              onChange={(e) => onSectionName(entry.key, e.target.value)}
              onFocus={() => setSectionFocus(true)}
              onBlur={() => setSectionFocus(false)}
            />
            {sectionFocus && entry.sectionName.trim() !== "" && sectionSuggestions.length > 0 ? (
              <ul className={styles.suggestList} role="listbox" aria-label="Matching sections">
                {sectionSuggestions.map((s) => (
                  <li key={s.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className={styles.suggestItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onPickSection(entry.key, s);
                        setSectionFocus(false);
                      }}
                    >
                      <span className={styles.suggestName}>{s.name}</span>
                      {s.adviserName ? (
                        <span className={styles.suggestMeta}>{s.adviserName}</span>
                      ) : (
                        <span className={styles.suggestMeta}>No adviser</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className={styles.field}>
          <Label className={styles.label} htmlFor={`adviser-dialog-teacher-${entry.key}`}>
            Adviser Name <span className={styles.required}>*</span>
          </Label>
          <div className={styles.suggestWrap}>
            <Input
              id={`adviser-dialog-teacher-${entry.key}`}
              value={entry.adviserName}
              placeholder={teachers.length === 0 ? "No teachers found" : "Type teacher name"}
              autoComplete="off"
              onChange={(e) => onAdviserName(entry.key, e.target.value)}
              onFocus={() => setAdviserFocus(true)}
              onBlur={() => setAdviserFocus(false)}
            />
            {adviserFocus && entry.adviserName.trim() !== "" && teacherSuggestions.length > 0 ? (
              <ul className={styles.suggestList} role="listbox" aria-label="Matching teachers">
                {teacherSuggestions.map((t) => (
                  <li key={t.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className={styles.suggestItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onPickTeacher(entry.key, t);
                        setAdviserFocus(false);
                      }}
                    >
                      <span className={styles.suggestName}>{t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <span className={styles.hint}>
        {matchedSection?.adviserName
          ? `Current adviser of ${matchedSection.name}: ${matchedSection.adviserName}. Saving replaces them.`
          : matchedSection
            ? `${matchedSection.name} has no adviser yet.`
            : isNewSection
              ? `"${entry.sectionName.trim()}" doesn't exist yet — it will be created on assign.`
              : matchedTeacher
                ? `${matchedTeacher.name} will be assigned as adviser.`
                : "Input the section name and the adviser name."}
      </span>
    </div>
  );
}

type Props = {
  sections: Section[];
  teachers: Teacher[];
  schoolYearName: string;
  initialGrade: GradeLevel | null;
  initialSectionId: string;
  /** True while the batch mutation is in flight (disables submit → no double-clicks). */
  isAssigning: boolean;
  onClose: () => void;
  /** Raw typed entries — the mutation resolves ids, auto-creates missing
    sections, then assigns in one atomic batch. Fire-and-forget: the dialog
    closes the same tick and rows update optimistically; toasts confirm. */
  onSubmit: (entries: AdvisoryEntryInput[]) => void;
  onAssigned: () => void;
};

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
}: Props) {
  const initialSection = sections.find((s) => s.id === initialSectionId) ?? null;
  const nextKey = React.useRef(1);
  // Local re-entrancy guard: closes the double-click / Enter-repeat window
  // before react-query flips `isAssigning` and disables the button.
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

  const gradeSections = React.useMemo(
    () => (grade == null ? [] : sections.filter((s) => s.gradeLevel === grade)),
    [sections, grade],
  );

  const setEntry = (key: number, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
    setError(null);
  };

  const handlePickSection = (key: number, s: Section) => {
    // Prefill with the section's current adviser (saving replaces them).
    setEntry(key, { sectionName: s.name, adviserName: s.adviserName ?? "" });
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { key: nextKey.current++, sectionName: "", adviserName: "" }]);
    setError(null);
  };

  const removeEntry = (key: number) => {
    setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.key !== key) : prev));
    setError(null);
  };

  const handleAssign = () => {
    if (submittingRef.current || isAssigning) return;
    if (grade == null) {
      setError("Select a grade level first.");
      return;
    }
    // Validate shape only (non-empty + no duplicates). Existence is settled
    // by the mutation: unknown section names are auto-created, teachers must
    // already exist — the server re-validates everything authoritatively.
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
      // Fire-and-forget: the hook paints optimistic cards instantly and owns
      // toasts/rollback. Close the same tick so the action feels instant —
      // the dialog never sits open waiting on the server.
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Advisory</DialogTitle>
          <DialogDescription>
            One grade level per batch — input each section name and adviser name for{" "}
            <strong>{schoolYearName || "the active school year"}</strong>. Sections that
            don&apos;t exist yet are created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.form}>
          <div className={styles.field}>
            <Label className={styles.label} htmlFor="adviser-dialog-grade">
              Grade Level <span className={styles.required}>*</span>
            </Label>
            <DropdownSelect
              id="adviser-dialog-grade"
              ariaLabel="Grade level"
              value={grade != null ? String(grade) : ""}
              onValueChange={(v) => {
                setGrade(Number(v) as GradeLevel);
                setError(null);
              }}
              options={GRADES.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
              placeholder="Select grade"
            />
          </div>

          <div className={styles.rowsList}>
            {entries.map((entry, i) => (
              <AdvisoryEntryRow
                key={entry.key}
                index={i}
                entry={entry}
                gradeSections={gradeSections}
                teachers={teachers}
                gradeSelected={grade != null}
                removable={entries.length > 1}
                disableRemove={isAssigning}
                onSectionName={(key, value) => setEntry(key, { sectionName: value })}
                onPickSection={handlePickSection}
                onAdviserName={(key, value) => setEntry(key, { adviserName: value })}
                onPickTeacher={(key, teacher) => setEntry(key, { adviserName: teacher.name })}
                onRemove={removeEntry}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className={styles.addRowBtn}
            onClick={addEntry}
            disabled={isAssigning}
            aria-label="Add another section"
          >
            <Plus aria-hidden />
            Add section
          </Button>

          {error ? (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
