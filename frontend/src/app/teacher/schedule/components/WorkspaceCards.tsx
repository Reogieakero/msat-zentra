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
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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
    <div
      className={assign.card}
      style={{
        borderColor: "color-mix(in oklch, #22c55e 45%, transparent)",
        background:
          "linear-gradient(135deg, color-mix(in oklch, #22c55e 26%, var(--card)), color-mix(in oklch, #16a34a 18%, var(--card)))",
      }}
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-500/15"
          aria-hidden="true"
        >
          <Send size={20} className="text-green-500" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Send to Principal</h3>
          <p className="text-xs text-muted-foreground">
            {totalDrafts > 0
              ? `${totalDrafts} draft slot${totalDrafts === 1 ? "" : "s"} awaiting review.`
              : "No draft slots right now."}
          </p>
        </div>
      </div>
      <div className="relative mt-auto flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => submitWeek.mutate()}
          disabled={totalDrafts === 0 || submitWeek.isPending}
          aria-busy={submitWeek.isPending || undefined}
        >
          {submitWeek.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              <span aria-live="polite">Sending…</span>
            </>
          ) : (
            `Send to principal${totalDrafts > 0 ? ` (${totalDrafts})` : ""}`
          )}
        </Button>
      </div>
    </div>
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
      <div
        className={assign.card}
        style={{
          borderColor: "color-mix(in oklch, #eab308 45%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in oklch, #eab308 26%, var(--card)), color-mix(in oklch, #ca8a04 18%, var(--card)))",
        }}
      >
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow-500/15"
            aria-hidden="true"
          >
            <SlidersHorizontal size={20} className="text-yellow-500" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">Configure</h3>
            <p className="text-xs text-muted-foreground">
              School day shape, breaks and period lengths.
            </p>
          </div>
        </div>
        <div className="relative mt-auto flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
            aria-label="Configure school day"
          >
            <SlidersHorizontal size={16} aria-hidden />
            Configure
          </Button>
        </div>
      </div>
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
