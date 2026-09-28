import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownSelect } from "./DropdownSelect";
import { useTerm } from "@/lib/term/TermContext";
import {
  type GradeLevel,
  type Section,
  type Teacher,
} from "../data";
import {
  createSection,
  updateSection,
} from "../api";
import { toast } from "@/components/ui/sonner";
import styles from "./form.module.css";
import stepper from "./section-form.module.css";

type Props = {
  open: boolean;
  section: Section | null;
  teachers: Teacher[];
  onOpenChange: (open: boolean) => void;
  onSave: (section: Section) => void;
};

const GRADES: GradeLevel[] = [11, 12];

// Backend errors arrive as { error: { code, message } } — surface the real
// message (e.g. duplicate section, missing adviser) instead of a generic one.
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
    ?.response?.data;
  return data?.error?.message ?? data?.message ?? fallback;
}

export function SectionFormDialog({
  open,
  section,
  teachers,
  onOpenChange,
  onSave,
}: Props) {
  // New sections are always created under the session's active School Year
  // (Login → select → scope). This dialog never asks for a year.
  const { activeTerm } = useTerm();
  const isEdit = !!section;
  const [name, setName] = React.useState(section?.name ?? "");
  const [gradeLevel, setGradeLevel] = React.useState<GradeLevel>(section?.gradeLevel ?? 11);
  const [adviserId, setAdviserId] = React.useState<string>(section?.adviserId ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Reset the form every time the dialog opens so edits never leak into "new".
  // Subject assignment lives in the separate "Assign Subjects" dialog, not here.
  // (Synced during render keyed by open + section id — never in an effect.)
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevSectionId, setPrevSectionId] = React.useState<string | null>(
    section?.id ?? null
  );
  if (open && (!prevOpen || prevSectionId !== (section?.id ?? null))) {
    setPrevOpen(true);
    setPrevSectionId(section?.id ?? null);
    setName(section?.name ?? "");
    setGradeLevel(section?.gradeLevel ?? 11);
    setAdviserId(section?.adviserId ?? "");
    setError(null);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Editing keeps the section's own year; creating uses the active scope.
  const effectiveYear = isEdit
    ? (section?.schoolYear ?? "")
    : (activeTerm?.schoolYearName ?? "");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Section name is required.");
      return;
    }
    if (!adviserId) {
      setError("Select an adviser.");
      return;
    }
    if (!isEdit && !effectiveYear) {
      setError("No active term selected. Pick one from the top-bar badge first.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEdit) {
        const saved = await updateSection(section!.id, { name: name.trim(), adviserId });
        onSave({ ...saved, assignments: section?.assignments ?? [] });
        toast.success({
          title: "Section updated",
          description: `${saved.name} has been saved successfully.`,
        });
      } else {
        const saved = await createSection({
          name: name.trim(),
          gradeLevel,
          schoolYear: effectiveYear,
          adviserId,
        });
        onSave({ ...saved, assignments: [] });
        toast.success({
          title: "Section created",
          description: `${saved.name} has been saved successfully.`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      const detail = getErrorMessage(err, "Failed to save section.");
      setError(detail);
      toast.error({ title: isEdit ? "Update failed" : "Creation failed", description: detail });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={stepper.dialog}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Section" : "New Section"}</DialogTitle>
          <DialogDescription>
            Create a class section for grades 11–12 within {effectiveYear || "the active school year"}.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.form}>
          <div className={styles.field}>
            <Label className={styles.label} htmlFor="section-name">
              Section Name <span className={styles.required}>*</span>
            </Label>
            <Input
              id="section-name"
              className={styles.control}
              value={name}
              placeholder="e.g. Grade 11-A"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <Label className={styles.label} htmlFor="section-grade">
                Grade Level
              </Label>
              <DropdownSelect
                id="section-grade"
                ariaLabel="Grade level"
                value={String(gradeLevel)}
                onValueChange={(v) => setGradeLevel(Number(v) as GradeLevel)}
                options={GRADES.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
                placeholder="Select grade"
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.label} htmlFor="section-year">
                School Year
              </Label>
              <span className={styles.staticValue} id="section-year">
                {effectiveYear || "No active term — pick one from the top-bar badge"}
              </span>
            </div>
          </div>

          <div className={styles.field}>
            <Label className={styles.label} htmlFor="section-adviser">
              Adviser <span className={styles.required}>*</span>
            </Label>
            <DropdownSelect
              id="section-adviser"
              ariaLabel="Adviser"
              value={adviserId}
              onValueChange={setAdviserId}
              options={teachers.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select adviser"
            />
          </div>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.dialogFooter}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Section"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
