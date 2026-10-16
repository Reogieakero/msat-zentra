"use client";

import { useState, type ComponentType } from "react";
import { Clock, Coffee, CupSoda, Gauge, Loader2, Settings2, Timer, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import {
  AfterSelect,
  TimePicker,
} from "./ScheduleConfigDialog";
import {
  buildTimetable,
  DEFAULT_DAY_CONFIG,
  formatClock,
  type DayConfig,
  type TimetableRow,
} from "./schedule-time";
import kanbanStyles from "./subject-kanban.module.css";

const CONFIG_SAVE_STEPS = ["Validating shape", "Saving to server", "Confirming timetables"];

export type ConfigSaveStatus = "saving" | "saved" | "failed";

export type ConfigIcon = "clock" | "timer" | "lunch" | "recess-am" | "recess-pm" | "caps";

const CONFIG_ICONS: Record<ConfigIcon, ComponentType<{ size?: number | string; className?: string }>> = {
  clock: Clock,
  timer: Timer,
  lunch: UtensilsCrossed,
  "recess-am": Coffee,
  "recess-pm": CupSoda,
  caps: Gauge,
};

export interface ConfigSaveItem {
  label: string;
  /** Each info bit renders as its own rectangle pill (never joined in one string). */
  parts: string[];
  icon: ConfigIcon;
}

export interface ConfigSaveProgress {
  active: boolean;
  done: boolean;
  status: ConfigSaveStatus;
  items: ConfigSaveItem[];
  summary: string;
  message?: string;
}

function ord(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function formatStart(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return startTime;
  return formatClock(h * 60 + m);
}

function recessParts(recess: { enabled: boolean; afterPeriod: number; mins: number }): string[] {
  if (!recess.enabled) return ["Off"];
  return ["On", `after ${ord(recess.afterPeriod)}`, `${recess.mins} min`];
}

/** Human-readable snapshot of an applied config for the save dock. */
export function describeConfig(next: DayConfig): { items: ConfigSaveItem[]; summary: string } {
  const rows = buildTimetable(next);
  const lastRow = rows[rows.length - 1];
  const items: ConfigSaveItem[] = [
    { label: "Start of classes", parts: [formatStart(next.startTime)], icon: "clock" },
    { label: "Subject duration", parts: [`${next.periodMins} min`], icon: "timer" },
    { label: "Lunch", parts: [`${next.lunch.mins} min`, `after ${ord(next.lunch.afterPeriod)}`], icon: "lunch" },
    { label: "Morning recess", parts: recessParts(next.morningRecess), icon: "recess-am" },
    { label: "Afternoon recess", parts: recessParts(next.afternoonRecess), icon: "recess-pm" },
    {
      label: "Workload caps",
      parts: [
        `${next.workload?.maxDailyPeriods ?? 6} / day`,
        `${next.workload?.maxWeeklyPeriods ?? 30} / week`,
      ],
      icon: "caps",
    },
  ];
  const summary = lastRow ? `School day ends ${formatClock(lastRow.endMin)}` : "School day saved";
  return { items, summary };
}

const inputClass = "rounded-md border border-input bg-transparent px-2 py-1 font-sans text-sm";

interface Props {
  config: DayConfig;
  onClose: () => void;
  onApply: (config: DayConfig) => void;
  saving?: boolean;
}

export function ScheduleConfigKanban({ config, onClose, onApply, saving }: Props) {
  const [draft, setDraft] = useState<DayConfig>(config);
  // Dropdown triggers are native buttons (centered text by default) — force left.
  const left = kanbanStyles.triggerLeft;

  const preview = buildTimetable(draft);
  const isRecess = (
    r: TimetableRow,
    label: "Morning Recess" | "Afternoon Recess",
  ): r is Extract<TimetableRow, { kind: "recess" }> =>
    r.kind === "recess" && r.label === label;
  const morningRow = preview.find((r) => isRecess(r, "Morning Recess"));
  const afternoonRow = preview.find((r) => isRecess(r, "Afternoon Recess"));
  const lastRow = preview[preview.length - 1];

  const clampMins = (v: number, fallback: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(v) || fallback));

  const handleApply = () => {
    const workload = {
      maxDailyPeriods: Math.min(8, Math.max(1, Math.round(draft.workload?.maxDailyPeriods ?? 6) || 6)),
      maxWeeklyPeriods: Math.min(40, Math.max(1, Math.round(draft.workload?.maxWeeklyPeriods ?? 30) || 30)),
    };
    onApply({
      startTime: draft.startTime || DEFAULT_DAY_CONFIG.startTime,
      periodMins: clampMins(draft.periodMins, DEFAULT_DAY_CONFIG.periodMins, 15, 120),
      lunch: {
        afterPeriod: [1, 2, 3, 4, 5, 6, 7, 8].includes(draft.lunch.afterPeriod)
          ? draft.lunch.afterPeriod
          : DEFAULT_DAY_CONFIG.lunch.afterPeriod,
        mins: clampMins(draft.lunch.mins, DEFAULT_DAY_CONFIG.lunch.mins, 15, 180),
      },
      morningRecess: {
        ...draft.morningRecess,
        mins: clampMins(draft.morningRecess.mins, 15, 5, 45),
      },
      afternoonRecess: {
        ...draft.afternoonRecess,
        mins: clampMins(draft.afternoonRecess.mins, 15, 5, 45),
      },
      workload,
    });
  };

  const recessField = (
    key: "morningRecess" | "afternoonRecess",
    title: string,
    options: number[],
  ) => {
    const recess = draft[key];
    const row = key === "morningRecess" ? morningRow : afternoonRow;
    return (
      <div className="rounded-lg border border-input p-3">
        <div className="flex items-center justify-between">
          <span className="font-sans text-sm font-medium">{title}</span>
          <Switch
            checked={recess.enabled}
            onCheckedChange={(v) => setDraft({ ...draft, [key]: { ...recess, enabled: v } })}
            aria-label={`${title} enabled`}
          />
        </div>
        {recess.enabled ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
              <span>After period</span>
              <AfterSelect
                value={recess.afterPeriod}
                options={options}
                onChange={(v) => setDraft({ ...draft, [key]: { ...recess, afterPeriod: v } })}
                label={`${title} after period`}
                triggerClassName={left}
              />
            </div>
            <label className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
              Duration (min)
              <input
                type="number"
                min={5}
                max={45}
                step={5}
                value={recess.mins}
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  if (Number.isFinite(v)) setDraft({ ...draft, [key]: { ...recess, mins: v } });
                }}
                className={inputClass}
              />
            </label>
          </div>
        ) : null}
        {recess.enabled && row ? (
          <p className="mt-2 font-sans text-xs text-muted-foreground">
            {row.label} → {formatClock(row.startMin)}–{formatClock(row.endMin)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className={kanbanStyles.view} aria-label="Configure school day">
      <div className={`${kanbanStyles.column} mx-auto w-full max-w-3xl`}>
        <KanbanBoard
          title="Configure school day"
          icon={
            <span className="text-amber-500" aria-hidden>
              <Settings2 size={14} />
            </span>
          }
          description="General shape for the whole term — saving applies to all sections. Breaks, lunch, start time and period length reshape every timetable on Apply."
          className="h-full"
          footer={
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDraft(DEFAULT_DAY_CONFIG)}
                disabled={saving}
                className="h-6 font-sans"
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={onClose}
                disabled={saving}
                className="h-6 border-transparent bg-red-600 px-3 font-sans text-white hover:bg-red-700 hover:text-white dark:border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={saving}
                aria-busy={saving || undefined}
                className="h-6 border-input bg-white font-sans text-black hover:bg-neutral-100 hover:text-black dark:border-transparent dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Saving…</span>
                  </>
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 px-1">
            <div className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
              <span>Start of classes</span>
              <TimePicker
                value={draft.startTime}
                onChange={(v) => setDraft({ ...draft, startTime: v })}
                label="Start of classes"
                triggerClassName={left}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
                Subject duration (min)
                <input
                  type="number"
                  min={15}
                  max={120}
                  step={5}
                  value={draft.periodMins}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (Number.isFinite(v)) setDraft({ ...draft, periodMins: v });
                  }}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
                Lunch length (min)
                <input
                  type="number"
                  min={15}
                  max={180}
                  step={5}
                  value={draft.lunch.mins}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (Number.isFinite(v))
                      setDraft({ ...draft, lunch: { ...draft.lunch, mins: v } });
                  }}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
              <span>Lunch after</span>
              <AfterSelect
                value={draft.lunch.afterPeriod}
                options={[1, 2, 3, 4, 5, 6, 7, 8]}
                onChange={(v) => setDraft({ ...draft, lunch: { ...draft.lunch, afterPeriod: v } })}
                label="Lunch after period"
                triggerClassName={left}
              />
            </div>

            {recessField("morningRecess", "Morning recess", [1, 2, 3, 4])}
            {recessField("afternoonRecess", "Afternoon recess", [5, 6, 7, 8])}

            <div className="rounded-lg border border-input p-3">
              <span className="font-sans text-sm font-medium">Teacher workload caps</span>
              <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                Warn-allow limits for the conflict detector. Saving still goes through.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
                  Max periods / day
                  <input
                    type="number"
                    min={1}
                    max={8}
                    step={1}
                    value={draft.workload?.maxDailyPeriods ?? 6}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber;
                      if (Number.isFinite(v))
                        setDraft({
                          ...draft,
                          workload: {
                            maxDailyPeriods: v,
                            maxWeeklyPeriods: draft.workload?.maxWeeklyPeriods ?? 30,
                          },
                        });
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 font-sans text-xs text-muted-foreground">
                  Max periods / week
                  <input
                    type="number"
                    min={1}
                    max={40}
                    step={1}
                    value={draft.workload?.maxWeeklyPeriods ?? 30}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber;
                      if (Number.isFinite(v))
                        setDraft({
                          ...draft,
                          workload: {
                            maxDailyPeriods: draft.workload?.maxDailyPeriods ?? 6,
                            maxWeeklyPeriods: v,
                          },
                        });
                    }}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            <p className="font-sans text-xs text-muted-foreground">
              School day ends {lastRow ? formatClock(lastRow.endMin) : "—"}.
            </p>
          </div>
        </KanbanBoard>
      </div>
    </div>
  );
}

export function ConfigDockRows({
  items,
  status,
}: {
  items: ConfigSaveItem[];
  status: ConfigSaveStatus;
}) {
  return (
    <ScrollList as="ul" className="max-h-56 gap-1" ariaLabel="Applied school-day settings">
      {items.map((it) => {
        const Icon = CONFIG_ICONS[it.icon] ?? Settings2;
        return (
          <li key={it.label} className="flex min-w-0 items-start gap-2 rounded px-1 py-1">
            <span className="shrink-0 pt-0.5" aria-hidden>
              {status === "saving" ? (
                <Loader2 size={15} className="animate-spin text-muted-foreground" />
              ) : (
                <Icon
                  size={15}
                  className={
                    status === "saved"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }
                />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className="font-sans text-xs font-medium" title={it.label}>
                {it.label}
              </span>
              <span className="flex flex-wrap gap-1">
                {it.parts.map((part) => (
                  <span
                    key={part}
                    className="shrink-0 rounded border border-amber-600/45 bg-amber-500/10 px-1.5 font-sans text-[12px] font-medium text-amber-700 dark:border-amber-500/45 dark:text-amber-400"
                  >
                    {part}
                  </span>
                ))}
              </span>
            </span>
            <span className="shrink-0 pt-0.5 font-sans text-[11px] text-muted-foreground">
              {status === "saved" ? "Saved" : status === "failed" ? "Failed" : "Saving…"}
            </span>
          </li>
        );
      })}
    </ScrollList>
  );
}

export { CONFIG_SAVE_STEPS };
