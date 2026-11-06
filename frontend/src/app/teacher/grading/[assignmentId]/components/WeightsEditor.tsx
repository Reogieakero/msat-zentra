"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPONENT_ORDER } from "@/services/teacher/grading.compute";
import type {
  ClassDetail,
  ComponentType,
} from "@/services/teacher/grading.types";
import { WeightsVisual } from "./WeightsVisual";
import { useWeightsSave } from "./weights-save-context";
import styles from "./WeightsDialog.module.css";

type Props = {
  detail: ClassDetail;
  /** Called as soon as the user confirms — closes the flyout immediately. */
  onConfirm?: () => void;
  onSaved: () => void;
};

/**
 * Category weights editor (DepEd Order No. 8) without any modal chrome —
 * designed to live inside the gutter dropdown panel, same as the
 * add-assessment form. Editing happens directly in the cards, same as the
 * first-time weights setup.
 */
export function WeightsEditor({ detail, onConfirm, onSaved }: Props) {
  const { assignment } = detail;
  const { saveWeights } = useWeightsSave();
  const [editing, setEditing] = React.useState(false);
  const [inputs, setInputs] = React.useState<Record<ComponentType, string>>(() =>
    Object.fromEntries(
      COMPONENT_ORDER.map((t) => [
        t,
        String(detail.components.find((c) => c.type === t)?.weight ?? 0),
      ]),
    ) as Record<ComponentType, string>,
  );
  const [editingField, setEditingField] = React.useState<ComponentType | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ww = detail.components.find((c) => c.type === "WRITTEN_WORK")?.weight ?? 0;
  const pt = detail.components.find((c) => c.type === "PERFORMANCE_TASK")?.weight ?? 0;
  const exam = detail.components.find((c) => c.type === "EXAM")?.weight ?? 0;

  const handleSave = async () => {
    if (saving) return;
    const parsed = COMPONENT_ORDER.map((t) => ({ type: t, value: Number(inputs[t]) }));
    if (parsed.some((p) => !Number.isInteger(p.value) || p.value < 0 || p.value > 100)) {
      setError("Each weight must be a whole number from 0 to 100.");
      return;
    }
    const total = parsed.reduce((s, p) => s + p.value, 0);
    if (total !== 100) {
      setError(`Weights must total 100% (currently ${total}%).`);
      return;
    }
    setError(null);
    setSaving(true);
    // The weights are patched optimistically, so the flyout can close on
    // confirm; the shared dock reports the outcome and the save keeps running.
    onConfirm?.();
    const result = await saveWeights(assignment.id, { weights: parsed });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  };

  return (
    <>
      <div className={`${styles.form} px-1`}>
        {editing ? (
          <WeightsVisual
            ww={ww}
            pt={pt}
            exam={exam}
            inputs={inputs}
            editing={editingField}
            onStartEdit={setEditingField}
            onInputChange={(t, v) => setInputs((prev) => ({ ...prev, [t]: v }))}
            onEndEdit={() => setEditingField(null)}
          />
        ) : (
          <WeightsVisual ww={ww} pt={pt} exam={exam} />
        )}
      </div>

      {error ? <p className={`${styles.errorText} px-1`}>{error}</p> : null}

      <div className="flex justify-end gap-2 px-1 pb-1">
        {editing ? (
          <Button
            size="sm"
            className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            onClick={() => void handleSave()}
            disabled={saving}
            aria-busy={saving || undefined}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" aria-hidden size={14} />
                Saving weights…
              </>
            ) : (
              "Save weights"
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>
    </>
  );
}
