"use client";

import * as React from "react";
import { Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { AmberRectPill } from "../../../classes/components/UnlinkCodeDialog";
import {
  COMPONENT_ORDER,
  gradeLabel,
} from "@/services/teacher/grading.compute";
import type {
  ClassDetail,
  ComponentType,
} from "@/services/teacher/grading.types";
import { WeightsVisual } from "./WeightsVisual";
import { useWeightsSave } from "./weights-save-context";
import styles from "./WeightsDialog.module.css";

type Props = {
  detail: ClassDetail;
  onCancel: () => void;
  onSaved: () => void;
};

export function WeightsBoard({ detail, onCancel, onSaved }: Props) {
  const { assignment } = detail;
  const { saveWeights } = useWeightsSave();
  const [inputs, setInputs] = React.useState<Record<ComponentType, string>>(() =>
    Object.fromEntries(
      COMPONENT_ORDER.map((t) => [
        t,
        String(detail.components.find((c) => c.type === t)?.weight ?? 0),
      ]),
    ) as Record<ComponentType, string>,
  );
  const [saving, setSaving] = React.useState(false);
  const [editingField, setEditingField] = React.useState<ComponentType | null>(null);
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
    // The dock opens this tick inside the provider and keeps running even
    // if the user navigates away mid-flight.
    const result = await saveWeights(assignment.id, { weights: parsed });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  };

  const busy = saving;

  return (
    <KanbanBoard
      ariaLabel="Category weights — DepEd Order No. 8"
      title="Category weights"
      icon={
        <span className="text-amber-500" aria-hidden>
          <Scale size={14} />
        </span>
      }
      actions={
        <span className="flex items-center gap-1.5">
          <AmberRectPill>{assignment.sectionName}</AmberRectPill>
          <AmberRectPill>Grade {gradeLabel(assignment.gradeLevel)}</AmberRectPill>
        </span>
      }
      footer={
        <div className="flex justify-end gap-1.5 px-1 pb-1">
          <Button
            size="sm"
            className="h-6 bg-red-600 px-2 text-xs text-white hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            onClick={() => void handleSave()}
            disabled={busy}
            aria-busy={saving || undefined}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save weights"
            )}
          </Button>
        </div>
      }
    >
      <div className={`flex flex-col gap-3 px-1 ${styles.form}`}>
        <WeightsVisual
          ww={ww}
          pt={pt}
          exam={exam}
          showBar={false}
          inputs={inputs}
          editing={editingField}
          onStartEdit={setEditingField}
          onInputChange={(t, v) => setInputs((prev) => ({ ...prev, [t]: v }))}
          onEndEdit={() => setEditingField(null)}
        />
      </div>

      {error ? <p className={`${styles.errorText} px-1`}>{error}</p> : null}
    </KanbanBoard>
  );
}
