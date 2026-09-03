import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Stepper, { Step } from "@/components/ui/stepper/Stepper";
import { DropdownSelect } from "./DropdownSelect";
import type { GradeLevel, Subject } from "../data";
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

const GRADES: GradeLevel[] = [7, 8, 9, 10];

export function SubjectFormDialog({ open, subject, onOpenChange, onSave }: Props) {
  const isEdit = !!subject;
  const [code, setCode] = React.useState(subject?.code ?? "");
  const [name, setName] = React.useState(subject?.name ?? "");
  const [gradeLevel, setGradeLevel] = React.useState<GradeLevel>(subject?.gradeLevel ?? 7);
  const [error, setError] = React.useState<string | null>(null);
  const [resetKey, setResetKey] = React.useState(0);

  const handleComplete = async () => {
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      setResetKey((k) => k + 1);
      return;
    }
    setError(null);
    try {
      const saved = subject
        ? await updateSubject(subject.id, name.trim())
        : await createSubject({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            gradeLevel,
          });
      onSave({ ...saved, active: true });
      onOpenChange(false);
      toast.success({
        title: isEdit ? "Subject updated" : "Subject created",
        description: `${saved.name} has been saved successfully.`,
      });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const detail = msg ?? "Failed to save subject.";
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
            Configure a subject for grades 7–10. Subject code must be unique.
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
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <Label className={styles.label} htmlFor="subject-grade">
                      Grade Level
                    </Label>
                    <DropdownSelect
                      id="subject-grade"
                      ariaLabel="Grade level"
                      value={String(gradeLevel)}
                      onValueChange={(v) => setGradeLevel(Number(v) as GradeLevel)}
                      options={GRADES.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
                      placeholder="Select grade"
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
