"use client";

import common from "./heatmap-table.module.css";

export function SortTh({
  label,
  sorted,
  onToggle,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle: (e?: unknown) => void;
}) {
  const direction =
    sorted === "asc"
      ? "ascending"
      : sorted === "desc"
        ? "descending"
        : "not sorted";
  return (
    <button
      type="button"
      className={common.thSort}
      onClick={onToggle}
      aria-label={`Sort by ${label}, currently ${direction}`}
    >
      <span>{label}</span>
    </button>
  );
}
