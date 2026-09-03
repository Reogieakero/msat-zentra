import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownSelect } from "./DropdownSelect";
import {
  SCHOOL_YEARS,
  ACTIVE_SCHOOL_YEAR,
  type Assignment,
  type GradeLevel,
  type Section,
  type Subject,
  type Teacher,
} from "../data";
import { createSection, updateSection } from "../api";
import { toast } from "@/components/ui/sonner";
import { SectionAssignments } from "./SectionAssignments";
import styles from "./form.module.css";
import stepper from "./section-form.module.css";

type Props = {
  open: boolean;
  section: Section | null;
  subjects: Subject[];
  teachers: Teacher[];
  onOpenChange: (open: boolean) => void;
  onSave: (section: Section) => void;
};

const GRADES: GradeLevel[] = [7, 8, 9, 10];

export function SectionFormDialog({ open, section, subjects, teachers, onOpenChange, onSave }: Props) {
  const isEdit = !!section;
  const [name, setName] = React.useState(section?.name ?? "");
  const [gradeLevel, setGradeLevel] = React.useState<GradeLevel>(section?.gradeLevel ?? 7);
  const [schoolYear, setSchoolYear] = React.useState<string>(section?.schoolYear ?? ACTIVE_SCHOOL_YEAR);
  const [adviserId, setAdviserId] = React.useState<string>(section?.adviserId ?? "");
  const [assignments, setAssignments] = React.useState<Assignment[]>(section?.assignments ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Section name is required.");
      return;
    }
    if (!adviserId) {
      setError("Select an adviser.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = { name: name.trim(), adviserId };
      const saved = isEdit
        ? await updateSection(section!.id, payload)
        : await createSection({
            name: name.trim(),
            gradeLevel,
            schoolYear,
            adviserId,
          });
      onSave({ ...saved, assignments });
      onOpenChange(false);
      toast.success({
        title: isEdit ? "Section updated" : "Section created",
        description: `${saved.name} has been saved successfully.`,
      });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const detail = msg ?? "Failed to save section.";
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
            Create a class section for grades 7–10 within a school year and assign its subject teachers.
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
              placeholder="e.g. Grade 7-A"
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
              <DropdownSelect
                id="section-year"
                ariaLabel="School year"
                value={schoolYear}
                onValueChange={setSchoolYear}
                options={SCHOOL_YEARS.map((y) => ({ value: y, label: y }))}
                placeholder="Select year"
              />
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

        <div className={stepper.assignWrap}>
          <SectionAssignments
            section={
              section ?? {
                id: "draft",
                name: "",
                gradeLevel: 7,
                schoolYear: ACTIVE_SCHOOL_YEAR,
                adviserId: "",
                adviserName: "",
                assignments,
              }
            }
            subjects={subjects}
            teachers={teachers}
            sectionId={section?.id}
            onChange={setAssignments}
          />
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.dialogFooter}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {isEdit ? "Save Changes" : "Create Section"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
