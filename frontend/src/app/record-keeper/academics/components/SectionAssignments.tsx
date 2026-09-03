import * as React from "react";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "./DropdownSelect";
import {
  TERMS,
  type Assignment,
  type Section,
  type Subject,
  type Teacher,
} from "../data";
import { assignTeacher, removeAssignment } from "../api";
import styles from "./section-assignments.module.css";

type Props = {
  section: Section;
  subjects: Subject[];
  teachers: Teacher[];
  sectionId?: string;
  onChange: (assignments: Assignment[]) => void;
};

export function SectionAssignments({ section, subjects, teachers, sectionId, onChange }: Props) {
  const assignments = section.assignments;
  const availableSubjects = subjects.filter((s) => s.active);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string[]>([]);
  const [termBySubject, setTermBySubject] = React.useState<Record<string, string>>(
    () => Object.fromEntries(assignments.map((a) => [a.subjectId, a.term])),
  );
  const [busy, setBusy] = React.useState(false);

  const assignedIds = new Set(assignments.map((a) => a.subjectId));
  const unassignedSubjects = availableSubjects.filter((s) => !assignedIds.has(s.id));

  const togglePending = (id: string) => {
    setPending((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAddSelected = async () => {
    const next: Assignment[] = [...assignments];
    const added: Assignment[] = [];
    for (const id of pending) {
      const subject = subjects.find((s) => s.id === id);
      if (!subject || assignedIds.has(id)) continue;
      const term = termBySubject[id] || TERMS[0];
      if (sectionId) {
        try {
          const saved = await assignTeacher({
            sectionId,
            subjectId: subject.id,
            teacherId: teachers[0]?.id ?? "",
            term,
          });
          added.push(saved);
        } catch (err) {
          console.error("assignTeacher failed:", err);
        }
      } else {
        added.push({
          id: `a-${Date.now()}-${id}`,
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          teacherId: teachers[0]?.id ?? "",
          teacherName: teachers[0]?.name ?? "",
          term,
        });
      }
    }
    const merged = [...next, ...added];
    onChange(merged);
    setPending([]);
    setPickerOpen(false);
  };

  const handleTeacher = (id: string, teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    onChange(
      assignments.map((a) =>
        a.subjectId === id ? { ...a, teacherId, teacherName: teacher?.name ?? "" } : a,
      ),
    );
  };

  const handleTerm = (id: string, term: string) => {
    setTermBySubject((prev) => ({ ...prev, [id]: term }));
    onChange(assignments.map((a) => (a.subjectId === id ? { ...a, term } : a)));
  };

  const handleRemove = async (assignmentId: string) => {
    if (sectionId) {
      setBusy(true);
      try {
        await removeAssignment(assignmentId);
      } catch (err) {
        console.error("removeAssignment failed:", err);
      } finally {
        setBusy(false);
      }
    }
    onChange(assignments.filter((a) => a.id !== assignmentId));
  };

  return (
    <div className={styles.assign}>
      <div className={styles.assignHead}>
        <div>
          <h4 className={styles.assignTitle}>Subject Assignments</h4>
          <p className={styles.assignSub}>{assignments.length} of {availableSubjects.length} subjects</p>
        </div>
        {unassignedSubjects.length > 0 ? (
          <Button variant="outline" size="xs" className={styles.pickerToggle} onClick={() => setPickerOpen((o) => !o)}>
            {pickerOpen ? "Close" : "Add subjects"}
          </Button>
        ) : null}
      </div>

      {pickerOpen && unassignedSubjects.length > 0 ? (
        <div className={styles.picker}>
          <div className={styles.pickerList}>
            {unassignedSubjects.map((s) => {
              const checked = pending.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.pickerItem} ${checked ? styles.pickerItemActive : ""}`}
                  onClick={() => togglePending(s.id)}
                  aria-pressed={checked}
                >
                  <span className={styles.pickerCheck} data-checked={checked}>
                    {checked ? "✓" : ""}
                  </span>
                  <span className={styles.pickerCode}>{s.code}</span>
                  <span className={styles.pickerName}>{s.name}</span>
                </button>
              );
            })}
          </div>
          <Button className={styles.addButton} onClick={handleAddSelected} disabled={pending.length === 0 || busy}>
            Add selected{pending.length > 0 ? ` (${pending.length})` : ""}
          </Button>
        </div>
      ) : null}

      {assignments.length === 0 ? (
        <p className={styles.empty}>No subjects assigned yet. Use “Add subjects” to select them for this section.</p>
      ) : (
        <div className={styles.list}>
          {assignments.map((a) => (
            <div key={a.id} className={styles.item}>
              <div className={styles.itemSubject}>
                <span className={styles.itemCode}>{a.subjectCode}</span>
                <span className={styles.itemName}>{a.subjectName}</span>
              </div>
              <DropdownSelect
                ariaLabel={`Teacher for ${a.subjectName}`}
                value={a.teacherId}
                onValueChange={(v) => handleTeacher(a.subjectId, v)}
                options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Assign teacher"
              />
              <DropdownSelect
                ariaLabel={`Term for ${a.subjectName}`}
                value={a.term}
                onValueChange={(v) => handleTerm(a.subjectId, v)}
                options={TERMS.map((t) => ({ value: t, label: t }))}
                placeholder="Term"
              />
              <Button variant="ghost" size="xs" className={styles.removeButton} aria-label="Remove assignment" onClick={() => handleRemove(a.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
