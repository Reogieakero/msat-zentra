"use client";

import * as React from "react";
import { Pill, type PillTone } from "@/components/ui/pill";

/**
 * Pill tab group — same markup/behaviour as the guidance interventions desk's
 * FilterTabs, so an adviser reads the board exactly like the guidance board.
 */
export function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "blue",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  tone?: PillTone;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className="inline-flex cursor-pointer rounded-md p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Pill tone={active ? tone : "neutral"}>{option.label}</Pill>
          </button>
        );
      })}
    </div>
  );
}
