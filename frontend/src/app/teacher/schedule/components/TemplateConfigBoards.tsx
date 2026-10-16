"use client";
import { CalendarDays, Clock, Gauge, SlidersHorizontal, Timer, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type { DayConfig } from "./schedule-time";

interface Props {
  config: DayConfig | null;
  maxDaily: number;
  maxWeekly: number;
  onConfigure: () => void;
}

function DayPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-sans text-xs font-medium text-amber-700 dark:text-amber-400">
      <span className="text-amber-500" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  );
}

export function TemplateConfigBoards({ config, maxDaily, maxWeekly, onConfigure }: Props) {
  return (
    <KanbanBoard
      title="School day"
      icon={
        <span className="text-amber-500" aria-hidden>
          <SlidersHorizontal size={14} />
        </span>
      }
      count={<span className="text-amber-600 dark:text-amber-500">{config ? `${config.periodMins}m` : "—"}</span>}
      description="General — applies to all sections this term."
      className="h-full"
      footer={
        <div className="flex justify-end gap-1.5 px-1 pb-1">
          <Button className="h-6 px-2 text-xs" onClick={onConfigure} disabled={!config}>
            Configure
          </Button>
        </div>
      }
    >
      {config ? (
        <div className="flex flex-1 flex-wrap content-start gap-1.5 px-1">
          <DayPill icon={<Clock size={12} />}>Starts {config.startTime}</DayPill>
          <DayPill icon={<Timer size={12} />}>{config.periodMins} min periods</DayPill>
          <DayPill icon={<Utensils size={12} />}>Lunch {config.lunch.mins}m</DayPill>
          <DayPill icon={<Gauge size={12} />}>Cap {maxDaily}/day</DayPill>
          <DayPill icon={<CalendarDays size={12} />}>Cap {maxWeekly}/week</DayPill>
        </div>
      ) : (
        <p className="flex-1 px-1 text-xs text-muted-foreground">Loading day shape…</p>
      )}
    </KanbanBoard>
  );
}
