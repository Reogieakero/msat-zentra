"use client";
import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Section, Teacher } from "@/services/principal/assign.types";
import { matchByName, suggestByName } from "./advisory-name-match";
import styles from "./form.module.css";
export type AdvisoryRowEntry = {
  key: number;
  sectionName: string;
  adviserName: string;
};
export function AdvisoryEntryRow({
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
}: {
  index: number;
  entry: AdvisoryRowEntry;
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
}) {
  const [sectionFocus, setSectionFocus] = React.useState(false);
  const [adviserFocus, setAdviserFocus] = React.useState(false);
  const matchedSection = React.useMemo(
    () => (gradeSelected ? matchByName(gradeSections, entry.sectionName) : undefined),
    [gradeSections, gradeSelected, entry.sectionName],
  );
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
