"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownSelect,
  type DropdownOption,
} from "@/app/principal/academics/assign/components/DropdownSelect";
import { CardModal } from "@/components/ui/CardModal";
import {
  buildTimetable,
  DEFAULT_DAY_CONFIG,
  formatRange,
  formatClock,
  type DayConfig,
  type TimetableRow,
} from "./schedule-time";

type Props = {
  config: DayConfig;
  onClose: () => void;
  onApply: (config: DayConfig) => void;
  saving?: boolean;
};

function ord(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const inputClass = "rounded-md border border-input bg-transparent px-2 py-1 text-sm";

export function TimePicker({
  value,
  onChange,
  label,
  triggerClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  /** Extra class for the dropdown trigger (e.g. left-align the text). */
  triggerClassName?: string;
}) {
  const [h, m] = value.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = Number.isFinite(m) ? m.toString().padStart(2, "0") : "00";
  const emit = (nh12: number, nmm: string, nampm: string) => {
    const h24 = (nh12 % 12) + (nampm === "PM" ? 12 : 0);
    onChange(`${String(h24).padStart(2, "0")}:${nmm}`);
  };
  const hourOptions: DropdownOption[] = HOURS.map((hh) => ({ value: hh, label: hh }));
  const minuteOptions: DropdownOption[] = MINUTES.map((m2) => ({ value: m2, label: m2 }));
  return (
    <div className="flex gap-1.5" role="group" aria-label={label}>
      <div className="flex-1">
        <DropdownSelect
          value={String(h12)}
          onValueChange={(v) => emit(Number(v), mm, ampm)}
          options={hourOptions}
          ariaLabel="Hour"
          triggerClassName={triggerClassName}
        />
      </div>
      <div className="flex-1">
        <DropdownSelect
          value={mm}
          onValueChange={(v) => emit(h12, v, ampm)}
          options={minuteOptions}
          ariaLabel="Minute"
          triggerClassName={triggerClassName}
        />
      </div>
      <div className="flex-1">
        <DropdownSelect
          value={ampm}
          onValueChange={(v) => emit(h12, mm, v)}
          options={[
            { value: "AM", label: "AM" },
            { value: "PM", label: "PM" },
          ]}
          ariaLabel="AM or PM"
          triggerClassName={triggerClassName}
        />
      </div>
    </div>
  );
}

export function AfterSelect({
  value,
  options,
  onChange,
  label,
  triggerClassName,
}: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
  label: string;
  /** Extra class for the dropdown trigger (e.g. left-align the text). */
  triggerClassName?: string;
}) {
  return (
    <DropdownSelect
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      options={options.map((n) => ({ value: String(n), label: `After ${ord(n)} period` }))}
      ariaLabel={label}
      triggerClassName={triggerClassName}
    />
  );
}

export function ScheduleConfigDialog({ config, onClose, onApply, saving }: Props) {
  const [draft, setDraft] = useState<DayConfig>(config);

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
          <span className="text-sm font-medium">{title}</span>
          <Switch
            checked={recess.enabled}
            onCheckedChange={(v) => setDraft({ ...draft, [key]: { ...recess, enabled: v } })}
            aria-label={`${title} enabled`}
          />
        </div>
        {recess.enabled ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>After period</span>
              <AfterSelect
                value={recess.afterPeriod}
                options={options}
                onChange={(v) => setDraft({ ...draft, [key]: { ...recess, afterPeriod: v } })}
                label={`${title} after period`}
              />
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
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
          <p className="mt-2 text-xs text-muted-foreground">
            {row.label} → {formatRange(row.startMin, row.endMin)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <CardModal
      open
      onClose={onClose}
      dismissable={!saving}
      size="md"
      title="Configure school day"
      description="General shape for the whole term — saving applies to all sections. Breaks, lunch, start time and period length reshape every timetable on Apply."
    >

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Start of classes</span>
            <TimePicker
              value={draft.startTime}
              onChange={(v) => setDraft({ ...draft, startTime: v })}
              label="Start of classes"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
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
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
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

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Lunch after</span>
            <AfterSelect
              value={draft.lunch.afterPeriod}
              options={[1, 2, 3, 4, 5, 6, 7, 8]}
              onChange={(v) => setDraft({ ...draft, lunch: { ...draft.lunch, afterPeriod: v } })}
              label="Lunch after period"
            />
          </div>

          {recessField("morningRecess", "Morning recess", [1, 2, 3, 4])}
          {recessField("afternoonRecess", "Afternoon recess", [5, 6, 7, 8])}

          <div className="rounded-lg border border-input p-3">
            <span className="text-sm font-medium">Teacher workload caps</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Warn-allow limits for the conflict detector. Saving still goes through.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
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
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
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

          <p className="text-xs text-muted-foreground">
            School day ends {formatClock(lastRow.endMin)}.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_DAY_CONFIG)} className="h-6 px-2 text-xs">
            Reset
          </Button>
          <Button variant="destructive" onClick={onClose} disabled={saving} className="h-6 px-2 text-xs">
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={saving} aria-busy={saving || undefined} className="h-6 px-2 text-xs">
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
    </CardModal>
  );
}
