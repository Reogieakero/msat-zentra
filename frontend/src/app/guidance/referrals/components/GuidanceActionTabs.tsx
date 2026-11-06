"use client";

import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  LayoutGrid,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { GuidanceReferralsSummary } from "@/services/guidance/guidance.types";
import {
  ADM_MENU,
  COUNSELING_MENU,
  trackMenuCounts,
  type GuidanceAction,
  type GuidanceActionValue,
  type GuidanceTrack,
} from "./guidance-referrals-format";

const PILL =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors duration-150";
const PILL_ACTIVE = "border-amber-500/60 bg-amber-500/10 text-foreground";
const PILL_IDLE =
  "border-border bg-card text-muted-foreground hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-foreground";

const ACTION_ICONS: Record<GuidanceActionValue, LucideIcon> = {
  adm_needs: ClipboardCheck,
  endorse: CheckCircle2,
  adm_followup: Clock,
  adm_booked: CalendarClock,
  adm_reject: XCircle,
  adm_cancelled: Ban,
  counseling_needs: ClipboardCheck,
  counseling_booked: CalendarClock,
  counseling_done: CheckCircle2,
  counseling_followup: Clock,
  counseling_cancelled: Ban,
};

const ACTION_ACCENTS: Record<GuidanceActionValue, string> = {
  adm_needs: "text-amber-600 dark:text-amber-400",
  endorse: "text-green-600 dark:text-green-400",
  adm_followup: "text-violet-600 dark:text-violet-400",
  adm_booked: "text-blue-600 dark:text-blue-400",
  adm_reject: "text-red-600 dark:text-red-400",
  adm_cancelled: "text-red-600 dark:text-red-400",
  counseling_needs: "text-amber-600 dark:text-amber-400",
  counseling_booked: "text-blue-600 dark:text-blue-400",
  counseling_done: "text-green-600 dark:text-green-400",
  counseling_followup: "text-violet-600 dark:text-violet-400",
  counseling_cancelled: "text-red-600 dark:text-red-400",
};

/**
 * Pill-tab filter bar for the guidance ADM board — the same horizontal
 * action tabs as the nurse kanban boards, one pill per ADM action filter
 * with its count, plus an "All cases" pill that shows everything.
 */
export function GuidanceActionTabs({
  action,
  summary,
  track,
  onPick,
  onClear,
}: {
  action: GuidanceAction;
  summary: GuidanceReferralsSummary | null;
  track: GuidanceTrack;
  onPick: (value: GuidanceActionValue) => void;
  onClear: () => void;
}) {
  const counts = trackMenuCounts(summary, track);
  const menu = track === "ADM" ? ADM_MENU : COUNSELING_MENU;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Action filters"
    >
      <button
        type="button"
        onClick={onClear}
        aria-pressed={action === ""}
        title="Show every case"
        aria-label={`All cases — ${
          action === "" ? "showing all" : "click to clear the filter"
        }`}
        className={`${PILL} ${action === "" ? PILL_ACTIVE : PILL_IDLE}`}
      >
        <span className="text-muted-foreground" aria-hidden>
          <LayoutGrid size={13} />
        </span>
        All cases
      </button>
      {menu.map((item) => {
        const active = action === item.value;
        const count = counts[item.value] ?? 0;
        const Icon = ACTION_ICONS[item.value];
        const hint = active
          ? "Showing these — click to clear"
          : count > 0
            ? `${count} ${count === 1 ? "case" : "cases"}`
            : "No cases";
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onPick(item.value)}
            aria-pressed={active}
            title={`${item.label} — ${hint}`}
            aria-label={`${item.label} — ${count} ${count === 1 ? "case" : "cases"}`}
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
      })}
    </div>
  );
}
