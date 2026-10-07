"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAssessment } from "@/services/teacher/grading.service";
import type {
  ClassComponent,
  ComponentType,
} from "@/services/teacher/grading.types";
import { sileo } from "@/components/ui/sonner";
import { CategoryTabs } from "./CategoryTabs";
import styles from "./AddAssessmentDialog.module.css";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  assignmentId: string;
  defaultType: ComponentType;
  components: ClassComponent[];
  onClose: () => void;
  onSaved: () => void;
};

export function AddAssessmentDialog({ assignmentId, defaultType, components, onClose, onSaved }: Props) {
  const [componentType, setComponentType] = React.useState<ComponentType>(defaultType);
  const [title, setTitle] = React.useState("");
  const [max, setMax] = React.useState("100");
  const [date, setDate] = React.useState(todayKey());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    const maxScore = Number(max);
    if (!title.trim()) {
      setError("Assessment title is required.");
      return;
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setError("Max score must be greater than 0.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createAssessment(assignmentId, {
        componentType,
        title: title.trim(),
        maxScore,
        dateGiven: date ? new Date(`${date}T00:00:00Z`).toISOString() : undefined,
      });
      onSaved();
      sileo.success({ title: "Assessment added", description: `"${created.title}" is ready for score encoding.` });
    } catch {
      setError("Failed to add assessment.");
      sileo.error({ title: "Could not add assessment", description: "Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardModal
      open
      onClose={onClose}
      dismissable={!saving}
      size="md"
      title="Add assessment"
      description="Pick the category, then set the title, max score, and date given."
    >

        <div className={styles.form}>
          <div className={styles.field}>
            <span className={styles.label}>Category</span>
            <CategoryTabs value={componentType} onChange={setComponentType} components={components} />
          </div>

          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="add-assessment-title">
              Title
            </Label>
            <Input
              id="add-assessment-title"
              className={styles.titleInput}
              value={title}
              placeholder="e.g. Quiz 1"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor="add-assessment-max">
                Max score
              </Label>
              <Input
                id="add-assessment-max"
                className={styles.scoreInput}
                inputMode="decimal"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <Label className={styles.fieldLabel} htmlFor="add-assessment-date">
                Date given
              </Label>
              <Input
                id="add-assessment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <p className={styles.hint}>
            Scores are encoded per student from the category table after adding.
          </p>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="destructive" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} aria-busy={saving || undefined}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Adding assessment…
              </>
            ) : (
              "Add assessment"
            )}
          </Button>
        </div>
    </CardModal>
  );
}
