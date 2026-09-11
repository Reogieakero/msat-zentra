"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DropdownSelect } from "../components/DropdownSelect";
import type { GradeLevel, Section, Subject, Teacher } from "../data";
import {
  assignTeacher,
  fetchSchoolYears,
  fetchSections,
  fetchSubjects,
  fetchTeachers,
  fetchTerms,
  removeAssignment,
  type SchoolYearOption,
  type TermOption,
} from "../api";
import { toast } from "@/components/ui/sonner";
import styles from "../components/form.module.css";
import assign from "../components/section-assignments.module.css";
import page from "./assign.module.css";

const GRADES: GradeLevel[] = [11, 12];

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
    ?.response?.data;
  return data?.error?.message ?? data?.message ?? fallback;
}

export default function AssignSubjectsPage() {
  const [years, setYears] = React.useState<SchoolYearOption[]>([]);
  const [schoolYearId, setSchoolYearId] = React.useState("");
  const [grade, setGrade] = React.useState<GradeLevel | null>(null);
  const [sections, setSections] = React.useState<Section[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [terms, setTerms] = React.useState<TermOption[]>([]);
  const [sectionId, setSectionId] = React.useState("");
  const [pickedIds, setPickedIds] = React.useState<string[]>([]);
  const [teacherBySubject, setTeacherBySubject] = React.useState<Record<string, string>>({});
  const [termNumber, setTermNumber] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [listsLoading, setListsLoading] = React.useState(false);
  const [yearLoading, setYearLoading] = React.useState(true);

  // Initial load: school years (defaulting to the active year) plus the
  // year-independent lists (subjects, teachers) — all from the backend.
  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchSchoolYears(ctrl.signal)
      .then((list) => {
        setYears(list);
        setSchoolYearId(list.find((y) => y.isActive)?.id ?? list[0]?.id ?? "");
      })
      .catch(() => setYears([]))
      .finally(() => setYearLoading(false));
    fetchSubjects(ctrl.signal)
      .then(setSubjects)
      .catch(() => setSubjects([]));
    fetchTeachers(ctrl.signal)
      .then(setTeachers)
      .catch(() => setTeachers([]));
    return () => ctrl.abort();
  }, []);

  // Whenever the school year changes, reload that year's sections + terms
  // from the backend. Terms come from GET …/terms (always Term 1–3 —
  // the backend backfills any missing row).
  React.useEffect(() => {
    if (!schoolYearId) return;
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- year switch reloads dependent lists
    setListsLoading(true);
    setSectionId("");
    setPickedIds([]);
    setTeacherBySubject({});
    Promise.all([fetchSections(ctrl.signal, schoolYearId), fetchTerms(schoolYearId, ctrl.signal)])
      .then(([sec, tms]) => {
        setSections(sec);
        setTerms(tms);
        setTermNumber((prev) =>
          prev != null && tms.some((t) => t.termNumber === prev)
            ? prev
            : (tms[0]?.termNumber ?? null),
        );
      })
      .catch(() => {
        setSections([]);
        setTerms([]);
        setTermNumber(null);
      })
      .finally(() => setListsLoading(false));
    return () => ctrl.abort();
  }, [schoolYearId]);

  // Sections available for the chosen grade level.
  const gradeSections = React.useMemo(
    () => (grade == null ? sections : sections.filter((s) => s.gradeLevel === grade)),
    [sections, grade],
  );

  // Drop the section pick when it falls outside the chosen grade.
  React.useEffect(() => {
    if (sectionId && grade != null && !gradeSections.some((s) => s.id === sectionId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep pick consistent with grade filter
      setSectionId("");
    }
  }, [grade, gradeSections, sectionId]);

  const selectedSection = React.useMemo(
    () => sections.find((s) => s.id === sectionId) ?? null,
    [sections, sectionId],
  );

  const termLabel = termNumber != null ? `Term ${termNumber}` : "";
  const existing = selectedSection?.assignments ?? [];

  // Subjects offered for the chosen grade that aren't already assigned to the
  // selected section for the chosen term.
  const availableSubjects = React.useMemo(() => {
    const inGrade = grade == null ? subjects.filter((s) => s.active) : subjects.filter((s) => s.active && s.gradeLevel === grade);
    if (!selectedSection || termNumber == null) return inGrade;
    const taken = new Set(
      existing.filter((a) => a.term === termLabel).map((a) => a.subjectId),
    );
    return inGrade.filter((s) => !taken.has(s.id));
  }, [subjects, grade, selectedSection, existing, termNumber, termLabel]);

  // Drop picks that are no longer assignable (grade/section/term changed).
  React.useEffect(() => {
    setPickedIds((prev) => {
      const ok = new Set(availableSubjects.map((s) => s.id));
      const next = prev.filter((id) => ok.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [availableSubjects]);

  const togglePick = (id: string) => {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setTeacher = (subjectId: string, teacherId: string) => {
    setTeacherBySubject((prev) => ({ ...prev, [subjectId]: teacherId }));
  };

  const clearPicks = () => {
    setPickedIds([]);
    setTeacherBySubject({});
    setError(null);
  };

  const pickedSubjects = React.useMemo(
    () =>
      pickedIds
        .map((id) => subjects.find((s) => s.id === id))
        .filter((s): s is Subject => s != null),
    [pickedIds, subjects],
  );

  const handleAssign = async () => {
    if (!schoolYearId) {
      setError("Select a school year first.");
      return;
    }
    if (grade == null) {
      setError("Select a grade level first.");
      return;
    }
    if (!sectionId) {
      setError("Select a section first.");
      return;
    }
    if (termNumber == null) {
      setError("No term available for this school year.");
      return;
    }
    if (pickedIds.length === 0) {
      setError("Tick at least one subject to assign.");
      return;
    }
    const missingTeacher = pickedSubjects.filter((s) => !teacherBySubject[s.id]);
    if (missingTeacher.length > 0) {
      setError(`Select a teacher for: ${missingTeacher.map((s) => s.code).join(", ")}.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created: { id: string; subjectName: string }[] = [];
      const failed: string[] = [];
      for (const s of pickedSubjects) {
        try {
          const saved = await assignTeacher({
            sectionId,
            subjectId: s.id,
            teacherId: teacherBySubject[s.id],
            term: termLabel,
          });
          setSections((prev) =>
            prev.map((sec) =>
              sec.id === sectionId ? { ...sec, assignments: [...sec.assignments, saved] } : sec,
            ),
          );
          created.push(saved);
        } catch (err) {
          failed.push(`${s.code}: ${getErrorMessage(err, "failed")}`);
        }
      }
      setPickedIds([]);
      setTeacherBySubject({});
      if (created.length > 0 && failed.length === 0) {
        toast.success({
          title: created.length > 1 ? `${created.length} subjects assigned` : "Subject assigned",
          description: `${created.map((c) => c.subjectName).join(", ")} → ${selectedSection?.name ?? "section"} (${termLabel}).`,
        });
      } else if (created.length > 0) {
        toast.error({
          title: "Partially assigned",
          description: `Assigned ${created.length} — ${failed.join("; ")}.`,
        });
      } else {
        const detail = failed.join("; ") || "Failed to assign subjects.";
        setError(detail);
        toast.error({ title: "Assignment failed", description: detail });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    setRemovingId(assignmentId);
    try {
      await removeAssignment(assignmentId);
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, assignments: s.assignments.filter((a) => a.id !== assignmentId) }
            : s,
        ),
      );
      toast.success({ title: "Assignment removed", description: "The subject was unassigned from this section." });
    } catch (err) {
      const detail = getErrorMessage(err, "Failed to remove assignment.");
      toast.error({ title: "Removal failed", description: detail });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className={page.page}>
      <Link href="/registrar/academics" className={page.back}>
        <ArrowLeft className={page.backIcon} />
        Back to Sections &amp; Subjects
      </Link>

      <header className={page.header}>
        <h1 className={page.title}>Assign Subjects to Section</h1>
        <p className={page.subtitle}>
          Pick a school year, grade level and section — then tick subjects and set each teacher.
        </p>
      </header>

      <div className={page.grid}>
        <div className={page.card}>
          <h2 className={page.cardTitle}>New assignments</h2>
          <div className={styles.form}>
            <div className={styles.row}>
              <div className={styles.field}>
                <Label className={styles.label} htmlFor="assign-year">
                  School Year <span className={styles.required}>*</span>
                </Label>
                <DropdownSelect
                  id="assign-year"
                  ariaLabel="School year"
                  value={schoolYearId}
                  onValueChange={setSchoolYearId}
                  options={years.map((y) => ({ value: y.id, label: y.name }))}
                  placeholder={
                    yearLoading
                      ? "Loading school years…"
                      : years.length === 0
                        ? "No school years found"
                        : "Select school year"
                  }
                />
              </div>
              <div className={styles.field}>
                <Label className={styles.label} htmlFor="assign-grade">
                  Grade Level <span className={styles.required}>*</span>
                </Label>
                <DropdownSelect
                  id="assign-grade"
                  ariaLabel="Grade level"
                  value={grade != null ? String(grade) : ""}
                  onValueChange={(v) => setGrade(Number(v) as GradeLevel)}
                  options={GRADES.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
                  placeholder="Select grade"
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <Label className={styles.label} htmlFor="assign-section">
                  Section <span className={styles.required}>*</span>
                </Label>
                <DropdownSelect
                  id="assign-section"
                  ariaLabel="Section"
                  value={sectionId}
                  onValueChange={setSectionId}
                  options={gradeSections.map((s) => ({ value: s.id, label: s.name }))}
                  placeholder={
                    grade == null
                      ? "Select a grade level first"
                      : listsLoading
                        ? "Loading sections…"
                        : gradeSections.length === 0
                          ? `No Grade ${grade} sections this year`
                          : "Select section"
                  }
                />
              </div>
              <div className={styles.field}>
                <Label className={styles.label} htmlFor="assign-term">
                  Term
                </Label>
                <DropdownSelect
                  id="assign-term"
                  ariaLabel="Term"
                  value={termNumber != null ? String(termNumber) : ""}
                  onValueChange={(v) => setTermNumber(Number(v))}
                  options={terms.map((t) => ({ value: String(t.termNumber), label: `Term ${t.termNumber}` }))}
                  placeholder={
                    !schoolYearId
                      ? "Select a school year first"
                      : listsLoading
                        ? "Loading terms…"
                        : terms.length === 0
                          ? "No terms for this year"
                          : "Select term"
                  }
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>
                  Subjects {pickedIds.length > 0 ? `(${pickedIds.length} selected)` : null}
                </span>
                <span className={styles.hint}>Tick to assign · per-subject teacher below</span>
              </div>
              {grade == null ? (
                <p className={assign.empty}>Select a grade level to list its subjects.</p>
              ) : availableSubjects.length === 0 ? (
                <p className={assign.empty}>
                  {!selectedSection
                    ? `No Grade ${grade} subjects to show yet.`
                    : `All Grade ${grade} subjects are already assigned to ${selectedSection.name} for ${termLabel || "this term"}.`}
                </p>
              ) : (
                <div className={assign.picker}>
                  <div className={assign.pickerList}>
                    {availableSubjects.map((s) => {
                      const checked = pickedIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`${assign.pickerItem} ${checked ? assign.pickerItemActive : ""}`}
                          onClick={() => togglePick(s.id)}
                          aria-pressed={checked}
                        >
                          <span className={assign.pickerCheck} data-checked={checked}>
                            {checked ? "✓" : ""}
                          </span>
                          <span className={assign.pickerCode}>{s.code}</span>
                          <span className={assign.pickerName}>{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {pickedSubjects.length > 0 ? (
              <div className={styles.field}>
                <span className={styles.label}>Teachers for selected subjects</span>
                <div className={assign.pickList}>
                  {pickedSubjects.map((s) => (
                    <div key={s.id} className={assign.pickItem}>
                      <div className={assign.itemSubject}>
                        <span className={assign.itemCode}>{s.code}</span>
                        <span className={assign.itemName}>{s.name}</span>
                      </div>
                      <DropdownSelect
                        ariaLabel={`Teacher for ${s.name}`}
                        value={teacherBySubject[s.id] ?? ""}
                        onValueChange={(v) => setTeacher(s.id, v)}
                        options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                        placeholder={teachers.length === 0 ? "No teachers found" : "Select teacher"}
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        className={assign.removeButton}
                        aria-label={`Unselect ${s.name}`}
                        onClick={() => togglePick(s.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <div className={styles.dialogFooter}>
              <Button variant="outline" onClick={clearPicks} disabled={pickedIds.length === 0 && !error}>
                Clear
              </Button>
              <Button onClick={() => void handleAssign()} disabled={saving || pickedIds.length === 0}>
                {saving ? "Assigning…" : pickedIds.length > 0 ? `Assign ${pickedIds.length} Subject${pickedIds.length === 1 ? "" : "s"}` : "Assign Subjects"}
              </Button>
            </div>
          </div>
        </div>

        <div className={page.card}>
          <h2 className={page.cardTitle}>
            {selectedSection ? `Assigned to ${selectedSection.name}` : "Assigned subjects"}
          </h2>
          <p className={page.cardSub}>
            {selectedSection ? `${existing.length} subject${existing.length === 1 ? "" : "s"}` : "Select a section to view its subjects"}
          </p>
          {!selectedSection ? (
            <p className={assign.empty}>No section selected yet.</p>
          ) : existing.length === 0 ? (
            <p className={assign.empty}>No subjects assigned to this section yet.</p>
          ) : (
            <div className={assign.list}>
              {existing.map((a) => (
                <div key={a.id} className={assign.item}>
                  <div className={assign.itemSubject}>
                    <span className={assign.itemCode}>{a.subjectCode}</span>
                    <span className={assign.itemName}>{a.subjectName}</span>
                  </div>
                  <span className={assign.itemTeacher}>{a.teacherName}</span>
                  <span className={assign.itemTerm}>{a.term}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className={assign.removeButton}
                    aria-label={`Remove ${a.subjectName}`}
                    disabled={removingId === a.id}
                    onClick={() => void handleRemove(a.id)}
                  >
                    {removingId === a.id ? "Removing…" : "Remove"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
