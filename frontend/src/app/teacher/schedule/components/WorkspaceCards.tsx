"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { Loader2, Send, SlidersHorizontal } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScheduleConfigDialog } from "./ScheduleConfigDialog";
import type { DayConfig } from "./schedule-time";
import type { ScheduleSectionSummary } from "../page";

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function SendToPrincipalCard() {
  const invalidateTeacher = useTeacherInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const sectionsQuery = useQuery<{ sections: ScheduleSectionSummary[] }>({
    queryKey: ["teacher-schedule-summary", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSectionSummary[] }>(
        "/api/teacher/schedule?summary=1",
      );
      return data;
    },
  });

  const submitWeek = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/api/teacher/schedule/submit", {});
      return data as { submitted: number };
    },
    onSuccess: (data) => {
      if (activeTerm?.termId) markSelfNotified(activeTerm.termId);
      invalidateTeacher.schedule();
      toast.success({
        title: "Sent to principal",
        description: `${data.submitted} draft slot${data.submitted === 1 ? "" : "s"} workspace-wide awaiting approval.`,
      });
    },
    onError: (err: unknown) => {
      toast.error({
        title: "Could not send to principal",
        description: getErrorMessage(err, "Failed to submit timetables."),
      });
    },
  });

  const totalDrafts = (sectionsQuery.data?.sections ?? []).reduce(
    (n, s) => n + s.timetableEntries.filter((e) => e.status === "DRAFT").length,
    0,
  );

  return (
    <KanbanBoard
      title="Send to Principal"
      icon={
        <span className="text-amber-500" aria-hidden>
          <Send size={14} />
        </span>
      }
      count={<span className="text-amber-600 dark:text-amber-500">{totalDrafts}</span>}
      description={
        totalDrafts > 0
          ? `${totalDrafts} draft slot${totalDrafts === 1 ? "" : "s"} awaiting review. Submitted slots await principal approval.`
          : "No draft slots right now."
      }
      className="h-full"
      footer={
        <div className="flex justify-end gap-1.5 px-1 pb-1">
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => submitWeek.mutate()}
            disabled={totalDrafts === 0 || submitWeek.isPending}
            aria-busy={submitWeek.isPending || undefined}
          >
            {submitWeek.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                <span aria-live="polite">Sending…</span>
              </>
            ) : (
              `Send to principal${totalDrafts > 0 ? ` (${totalDrafts})` : ""}`
            )}
          </Button>
        </div>
      }
    >
      <p className="flex-1 px-1 text-xs text-muted-foreground">
        {totalDrafts > 0
          ? "Drafts flip to submitted instantly, then confirm in the background."
          : "Stage timetable cells first — drafts appear here."}
      </p>
    </KanbanBoard>
  );
}

function ConfigureCard() {
  const invalidateTeacher = useTeacherInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [configOpen, setConfigOpen] = useState(false);

  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
  });

  const configMutation = useMutation({
    mutationFn: async (next: DayConfig) => {
      const { data } = await apiClient.patch<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
        next,
      );
      return data.config;
    },
    onSuccess: () => {
      setConfigOpen(false);
      invalidateTeacher.schedule();
      toast.success({ title: "School day saved", description: "Timetables reshaped themselves." });
    },
    onError: (err: unknown) => {
      toast.error({
        title: "Could not save school day",
        description: getErrorMessage(err, "Failed to save school-day shape."),
      });
    },
  });

  return (
    <>
      <KanbanBoard
        title="Configure"
        icon={
          <span className="text-amber-500" aria-hidden>
            <SlidersHorizontal size={14} />
          </span>
        }
        description="School day shape, breaks and period lengths."
        className="h-full"
        footer={
          <div className="flex justify-end gap-1.5 px-1 pb-1">
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setConfigOpen(true)}
              aria-label="Configure school day"
            >
              <SlidersHorizontal size={14} aria-hidden />
              Configure
            </Button>
          </div>
        }
      >
        <p className="flex-1 px-1 text-xs text-muted-foreground">
          {configQuery.data ? "General shape for the whole term — saving applies to all sections." : "Loading day shape…"}
        </p>
      </KanbanBoard>
      {configOpen && configQuery.data ? (
        <ScheduleConfigDialog
          config={configQuery.data.config}
          onClose={() => setConfigOpen(false)}
          onApply={(next) => configMutation.mutate(next)}
          saving={configMutation.isPending}
        />
      ) : null}
    </>
  );
}

export function WorkspaceCards() {
  return (
    <>
      <SendToPrincipalCard />
      <ConfigureCard />
    </>
  );
}
