"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COMPONENT_NAMES,
  COMPONENT_ORDER,
  isSHS,
} from "@/services/teacher/grading.compute";
import {
  WEIGHT_PRESETS,
  applyWeightPreset,
  saveComponentWeight,
} from "@/services/teacher/grading.service";
import type {
  ClassDetail,
  ComponentType,
  WeightPreset,
} from "@/services/teacher/grading.types";
import { sileo } from "@/components/ui/sonner";
import { WeightsVisual } from "./WeightsVisual";
import styles from "./WeightsDialog.module.css";

type Props = {
  detail: ClassDetail;
  onClose: () => void;
  onSaved: () => void;
};

export function WeightsDialog({ detail, onClose, onSaved }: Props) {
  const { assignment } = detail;
  const [editing, setEditing] = React.useState(false);
  const [inputs, setInputs] = React.useState<Record<ComponentType, string>>(() =>
    Object.fromEntries(
      COMPONENT_ORDER.map((t) => [
        t,
        String(detail.components.find((c) => c.type === t)?.weight ?? 0),
      ]),
    ) as Record<ComponentType, string>,
  );
  const [saving, setSaving] = React.useState(false);
  const [presetSaving, setPresetSaving] = React.useState<WeightPreset | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const ww = detail.components.find((c) => c.type === "WRITTEN_WORK")?.weight ?? 0;
  const pt = detail.components.find((c) => c.type === "PERFORMANCE_TASK")?.weight ?? 0;
  const exam = detail.components.find((c) => c.type === "EXAM")?.weight ?? 0;

  const presets = isSHS(assignment.gradeLevel)
    ? WEIGHT_PRESETS.filter((p) => p.key === "SHS")
    : WEIGHT_PRESETS.filter((p) => p.key !== "SHS");

  const handlePreset = async (preset: WeightPreset) => {
    if (presetSaving !== null || saving) return;
    setError(null);
    setPresetSaving(preset);
    try {
      await applyWeightPreset(assignment.id, preset);
      onSaved();
      sileo.success({ title: "Weights applied", description: "DepEd standard weights are now active." });
    } catch {
      setError("Failed to apply DepEd weights.");
      sileo.error({ title: "Could not apply weights", description: "Try again." });
    } finally {
      setPresetSaving(null);
    }
  };

  const handleSave = async () => {
    if (saving || presetSaving !== null) return;
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
    try {
      const results = await Promise.allSettled(
        parsed.map((p) =>
          saveComponentWeight(assignment.id, { componentType: p.type, weightPercentage: p.value }),
        ),
      );
      if (results.some((r) => r.status === "rejected")) {
        setError("Some weights failed to save — please retry.");
        sileo.error({ title: "Weights partially saved", description: "Some weights failed — please retry." });
        return;
      }
      onSaved();
      sileo.success({ title: "Weights saved", description: "Category weights now total 100%." });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || presetSaving !== null;
  return (
    <CardModal
      open
      onClose={onClose}
      dismissable={!busy}
      size="md"
      title="Category weights — DepEd Order No. 8"
      description="Weight is each category's share of the final grade: final = (WW avg × WW%) + (PT avg × PT%) + (E avg × E%). The three weights must total 100%."
    >

        <div className={styles.form}>
          <WeightsVisual ww={ww} pt={pt} exam={exam} />

          {editing ? (
            <>
              <div className={styles.labelRow}>
                <span className={styles.label}>DepEd standard</span>
                <span className={styles.hint}>One click, all three categories</span>
              </div>
              <div className={styles.row}>
                {presets.map((p) => (
                  <Button
                    key={p.key}
                    variant="outline"
                    onClick={() => void handlePreset(p.key)}
                    disabled={presetSaving !== null || saving}
                    aria-busy={presetSaving === p.key || undefined}
                  >
                    {presetSaving === p.key ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden />
                        Applying…
                      </>
                    ) : (
                      `${p.label} (${p.hint})`
                    )}
                  </Button>
                ))}
              </div>

              <div className={styles.labelRow}>
                <span className={styles.label}>Manual weights</span>
                <span className={styles.hint}>Saved only when totaling 100%</span>
              </div>
              <div className={styles.row}>
                {COMPONENT_ORDER.map((t) => (
                  <div key={t} className={styles.field}>
                    <Label className={styles.fieldLabel} htmlFor={`weight-${t}`}>
                      {COMPONENT_NAMES[t]} %
                    </Label>
                    <Input
                      id={`weight-${t}`}
                      className={styles.scoreInput}
                      inputMode="numeric"
                      value={inputs[t]}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [t]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {editing ? "Cancel" : "Close"}
          </Button>
          {editing ? (
            <Button onClick={() => void handleSave()} disabled={saving || presetSaving !== null} aria-busy={saving || undefined}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Saving weights…
                </>
              ) : (
                "Save weights"
              )}
            </Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
    </CardModal>
  );
}
