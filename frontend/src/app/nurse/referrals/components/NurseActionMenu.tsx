"use client";

import {
  Activity,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ListX,
  Send,
  Stethoscope,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ADM_MENU,
  CLINIC_MENU,
  type ActionFilter,
  type ActionValue,
  type TypeFilter,
} from "./nurse-referrals-format";

// Icon + accent per action — same recipe as the overview KPI rail
// (amber = attention, blue = booked, orange = follow-up, etc.). Shared with
// the ADM board's pill-tab filter (NurseActionTabs).
export const ACTION_ICONS: Record<ActionValue, LucideIcon> = {
  adm_needs: ClipboardList,
  endorse: Send,
  followup: Activity,
  booked: CalendarClock,
  reject: XCircle,
  adm_cancelled: Ban,
  clinic_needs: Stethoscope,
  clinic_booked: CalendarClock,
  clinic_done: CheckCircle2,
  clinic_followup: Activity,
  clinic_cancelled: Ban,
};

export const ACTION_ACCENTS: Record<ActionValue, string> = {
  adm_needs: "text-primary",
  endorse: "text-amber-500",
  followup: "text-orange-500",
  booked: "text-blue-500",
  reject: "text-destructive",
  adm_cancelled: "text-muted-foreground",
  clinic_needs: "text-primary",
  clinic_booked: "text-blue-500",
  clinic_done: "text-emerald-600 dark:text-emerald-400",
  clinic_followup: "text-orange-500",
  clinic_cancelled: "text-muted-foreground",
};

function RailTip({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <span className="font-medium">{title}</span>
      <span className="opacity-60">{hint}</span>
    </>
  );
}

/**
 * Icon-only right rail for the referrals pages — the former "Case actions"
 * panel as the same sticky icon rail the overview page uses: one icon per
 * action filter, count badge, tooltip on the left. Clicking an icon toggles
 * that filter (click again, or the Show-all icon, to clear).
 */
export function NurseActionMenu({
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
  function renderIcon(
    item: { value: ActionValue; label: string },
    type: "ADM" | "Clinic",
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
      <Tooltip key={item.value}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onPick(item.value, type)}
            aria-pressed={active}
            aria-label={`${prefix}${item.label} — ${count} ${count === 1 ? "case" : "cases"}`}
            className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
              active
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
            }`}
          >
            <span className={ACTION_ACCENTS[item.value]} aria-hidden>
              <Icon size={16} />
            </span>
            {count > 0 ? (
              <span
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                aria-hidden="true"
              >
                {count}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={10}>
          <RailTip title={`${prefix}${item.label}`} hint={hint} />
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className="w-full self-start lg:sticky lg:top-16 lg:ml-auto lg:w-auto"
        aria-label="Action filters"
      >
        <div className="flex flex-row flex-wrap justify-end gap-2 lg:flex-col lg:items-end">
          {typeFilter !== "Clinic" &&
            ADM_MENU.map((item) => renderIcon(item, "ADM"))}
          {typeFilter !== "ADM" &&
            CLINIC_MENU.map((item) => renderIcon(item, "Clinic"))}
          {actionFilter !== "" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClear}
                  aria-label="Show all cases — clear the action filter"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-card transition-colors hover:border-amber-500/60 hover:bg-amber-500/10"
                >
                  <ListX size={16} className="text-muted-foreground" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <RailTip title="Show all" hint="Clear the action filter" />
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
