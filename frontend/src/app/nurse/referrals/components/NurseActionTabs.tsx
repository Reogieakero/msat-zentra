"use client";

import { LayoutGrid } from "lucide-react";
import {
  ADM_MENU,
  CLINIC_MENU,
  type ActionFilter,
  type ActionValue,
  type TypeFilter,
} from "./nurse-referrals-format";
import { ACTION_ACCENTS, ACTION_ICONS } from "./NurseActionMenu";

const PILL =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors duration-150";
const PILL_ACTIVE = "border-amber-500/60 bg-amber-500/10 text-foreground";
const PILL_IDLE =
  "border-border bg-card text-muted-foreground hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-foreground";

/**
 * Pill-tab filter bar for the nurse kanban boards (ADM cases / Clinic
 * matters) — the right-side action rail turned into horizontal tabs above
 * the records: one pill per action filter with its count, plus an "All
 * cases" pill that shows everything. Clicking the active pill clears the
 * filter, same as the rail.
 */
export function NurseActionTabs({
  actionFilter,
  counts,
  typeFilter,
  onPick,
  onClear,
}: {
  actionFilter: ActionFilter;
  counts: Record<ActionValue, number>;
  typeFilter: TypeFilter;
  onPick: (value: ActionValue, type: "ADM" | "Clinic") => void;
  onClear: () => void;
}) {
  function renderPill(
    item: { value: ActionValue; label: string },
    type: "ADM" | "Clinic"
  ) {
    const active = actionFilter === item.value;
    const count = counts[item.value] ?? 0;
    const Icon = ACTION_ICONS[item.value];
    const prefix = typeFilter === "" ? `${type} · ` : "";
    const hint = active
      ? "Showing these — click to clear"
      : count > 0
        ? `${count} ${count === 1 ? "case" : "cases"}`
        : "No cases";
    return (
      <button
        key={item.value}
        type="button"
        onClick={() => onPick(item.value, type)}
        aria-pressed={active}
        title={`${prefix}${item.label} — ${hint}`}
        aria-label={`${prefix}${item.label} — ${count} ${count === 1 ? "case" : "cases"}`}
        className={`${PILL} ${active ? PILL_ACTIVE : PILL_IDLE}`}
      >
        <span className={ACTION_ACCENTS[item.value]} aria-hidden>
          <Icon size={13} />
        </span>
        {item.label}
        {count > 0 ? (
          <span
            className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
              active
                ? "bg-amber-500/25 text-amber-900 dark:text-amber-200"
                : "bg-secondary text-secondary-foreground"
            }`}
            aria-hidden="true"
          >
            {count}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Action filters"
    >
      <button
        type="button"
        onClick={onClear}
        aria-pressed={actionFilter === ""}
        title="Show every case"
        aria-label={`All cases — ${
          actionFilter === "" ? "showing all" : "click to clear the filter"
        }`}
        className={`${PILL} ${actionFilter === "" ? PILL_ACTIVE : PILL_IDLE}`}
      >
        <span className="text-muted-foreground" aria-hidden>
          <LayoutGrid size={13} />
        </span>
        All cases
      </button>
      {typeFilter !== "Clinic" && ADM_MENU.map((item) => renderPill(item, "ADM"))}
      {typeFilter !== "ADM" && CLINIC_MENU.map((item) => renderPill(item, "Clinic"))}
    </div>
  );
}
