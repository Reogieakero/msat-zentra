"use client";

import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FluidHue } from "@/components/auth/FluidBackground";
import styles from "./FluidColorPicker.module.css";

const OPTIONS: { value: FluidHue; label: string; color: string }[] = [
  { value: "green", label: "Onyx", color: "oklch(0.205 0 0)" },
  { value: "blue", label: "Graphite", color: "oklch(0.439 0 0)" },
  { value: "amber", label: "Fog", color: "oklch(0.87 0 0)" },
];

export function FluidColorPicker({
  value,
  onChange,
}: {
  value: FluidHue;
  onChange: (value: FluidHue) => void;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as FluidHue)}
      className={styles.group}
      aria-label="Fluid color"
    >
      {OPTIONS.map((opt) => (
        <label key={opt.value} className={styles.option}>
          <RadioGroupItem value={opt.value} className={styles.item} />
          <span
            className={styles.swatch}
            style={{ backgroundColor: opt.color }}
            aria-hidden="true"
          />
          <span className={styles.label}>{opt.label}</span>
        </label>
      ))}
    </RadioGroup>
  );
}
