"use client";

import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FluidHue } from "@/components/auth/FluidBackground";
import styles from "./FluidColorPicker.module.css";

const OPTIONS: { value: FluidHue; label: string; color: string }[] = [
  { value: "green", label: "Green", color: "oklch(0.83 0.24 142)" },
  { value: "blue", label: "Blue", color: "oklch(0.55 0.13 230)" },
  { value: "amber", label: "Amber", color: "oklch(0.7 0.14 70)" },
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
