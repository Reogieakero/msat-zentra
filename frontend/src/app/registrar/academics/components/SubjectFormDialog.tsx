import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Stepper, { Step } from "@/components/ui/stepper/Stepper";
import { DropdownSelect } from "./DropdownSelect";
import { SUBJECT_CATEGORIES, type GradeLevel, type Subject, type SubjectCategory } from "../data";
import { createSubject, updateSubject } from "../api";
import { toast } from "@/components/ui/sonner";
import styles from "./form.module.css";
import stepper from "./subject-form.module.css";

type Props = {
  open: boolean;
  subject: Subject | null;
  onOpenChange: (open: boolean) => void;
  onSave: (subject: Subject) => void;
};

const GRADES: GradeLevel[] = [11, 12];

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
    ?.response?.data;
  return data?.error?.message ?? data?.message ?? fallback;
}

export function SubjectFormDialog({ open, subject, onOpenChange, onSave }: Props) {
  const isEdit = !!subject;
  const [code, setCode] = React.useState(subject?.code ?? "");
  const [name, setName] = React.useState(subject?.name ?? "");
  const [grades, setGrades] = React.useState<GradeLevel[]>([subject?.gradeLevel ?? 11]);
  const [category, setCategory] = React.useState<SubjectCategory>(subject?.category ?? "Core");
  const [error, setError] = React.useState<string | null>(null);
  const [resetKey, setResetKey] = React.useState(0);

  // Reset the form every time the dialog opens — the landing page reuses one
  // mounted instance for every "Add Subject" click. Teacher/section assignment
  // lives in the separate "Assign Subjects" dialog, not here.
  React.useEffect(() => {
    if (!open) return;
    setCode(subject?.code ?? "");
    setName(subject?.name ?? "");
    setGrades([subject?.gradeLevel ?? 11]);
    setCategory(subject?.category ?? "Core");
    setError(null);
  }, [open, subject]);

  const toggleGrade = (g: GradeLevel) => {
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort()));
  };

  const handleComplete = async () => {
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      setResetKey((k) => k + 1);
      return;
    }
    if (!isEdit && grades.length === 0) {
      setError("Select at least one grade level.");
      setResetKey((k) => k + 1);
      return;
    }
    setError(null);
    try {
      if (subject) {
        const saved = await updateSubject(subject.id, { name: name.trim(), category });
        onSave({ ...saved, active: true });
        onOpenChange(false);
        toast.success({
          title: "Subject updated",
          description: `${saved.name} has been saved successfully.`,
        });
        return;
      }
      // One subject row is created per selected grade (codes are unique per
      // grade, so the same code may live in both Grade 11 and Grade 12).
      const created: Subject[] = [];
      const failed: string[] = [];
      for (const g of grades) {
        try {
          const saved = await createSubject({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            gradeLevel: g,
            category,
          });
          created.push(saved);
        } catch (err) {
          failed.push(`Grade ${g}: ${getErrorMessage(err, "failed")}`);
        }
      }
      created.forEach((s) => onSave({ ...s, active: true }));
      if (created.length > 0 && failed.length === 0) {
        onOpenChange(false);
        const gradeText = created.length > 1 ? ` for Grades ${grades.join(" & ")}` : "";
        toast.success({
          title: created.length > 1 ? "Subjects created" : "Subject created",
          description: `${created[0].name} (${category}) has been created${gradeText}.`,
        });
      } else if (created.length > 0) {
        onOpenChange(false);
        toast.error({
          title: "Partially created",
          description: `Created for ${created.map((s) => `Grade ${s.gradeLevel}`).join(", ")} — ${failed.join("; ")}.`,
        });
      } else {
        const detail = failed.join("; ") || "Failed to save subject.";
        setError(detail);
        setResetKey((k) => k + 1);
        toast.error({ title: "Creation failed", description: detail });
      }
    } catch (err) {
      const detail = getErrorMessage(err, "Failed to save subject.");
      setError(detail);
      setResetKey((k) => k + 1);
      toast.error({ title: isEdit ? "Update failed" : "Creation failed", description: detail });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={stepper.dialog}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Subject" : "New Subject"}</DialogTitle>
          <DialogDescription>
            Configure a subject for grades 11–12. Subject code must be unique per grade.
          </DialogDescription>
        </DialogHeader>

        <div className={stepper.stepperWrap}>
          <Stepper
            key={resetKey}
            initialStep={1}
            nextButtonText="Continue"
            onFinalStepCompleted={handleComplete}
          >
            <Step>
              <div className={styles.form}>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <Label className={styles.label} htmlFor="subject-code">
                      Code <span className={styles.required}>*</span>
                    </Label>
                    <Input
                      id="subject-code"
                      className={styles.control}
                      value={code}
                      placeholder="e.g. GEN 001"
                      disabled={isEdit}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <Label className={styles.label} htmlFor="subject-category">
                      Category
                    </Label>
                    <DropdownSelect
                      id="subject-category"
                      ariaLabel="Subject category"
                      value={category}
                      onValueChange={(v) => setCategory(v as SubjectCategory)}
                      options={SUBJECT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                      placeholder="Select category"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <Label className={styles.label} htmlFor="subject-name">
                    Name <span className={styles.required}>*</span>
                  </Label>
                  <Input
                    id="subject-name"
                    className={styles.control}
                    value={name}
                    placeholder="e.g. Oral Communication in Context"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>
                    Grade Level {!isEdit ? <span className={styles.required}>*</span> : null}
                  </span>
                  {isEdit ? (
                    <span className={styles.staticValue}>Grade {subject!.gradeLevel}</span>
                  ) : (
                    <>
                      <div className={styles.checkRow}>
                        {GRADES.map((g) => (
                          <label key={g} className={styles.checkLabel}>
                            <input
                              type="checkbox"
                              checked={grades.includes(g)}
                              onChange={() => toggleGrade(g)}
                            />
                            Grade {g}
                          </label>
                        ))}
                      </div>
                      <span className={styles.hint}>
                        Select one or both grades — a subject row is created per grade.
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Step>
          </Stepper>
        </div>

        {error ? (
          <p className={styles.errorText}>{error}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
