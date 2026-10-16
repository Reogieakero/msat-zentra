"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ScrollList } from "@/components/ui/scroll-list";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useTerm } from "@/lib/term/TermContext";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
import type { ScheduleSectionSummary } from "../page";
import kanbanStyles from "./subject-kanban.module.css";

export type SubmitRowState = {
  sectionId: string;
  name: string;
  count: number;
  status: "submitting" | "submitted" | "failed";
  message?: string;
};

export type SubmitProgress = {
  active: boolean;
  done: boolean;
  rows: SubmitRowState[];
  total: number;
  startedAt: number;
};

const SUBMIT_STEPS = ["Collecting drafts", "Sending for review", "Confirming queue"];

type SummaryCache = { sections: ScheduleSectionSummary[] };

/**
 * Workspace-wide send-to-principal with low latency: draft slots flip to
 * submitted in every cached summary instantly (counts drop this tick), then
 * the POST confirms in the background with per-section dock updates.
 *
 * No success toast here — the dock confirms locally, and the server fanout
 * delivers the real-time "You sent…" toast + bell badge + notification row
 * through the teacher channel (no refresh needed).
 */
export function useSubmitTimetable(termKey: string, onProgress?: (p: SubmitProgress | null) => void) {
  const qc = useQueryClient();
  const invalidateTeacher = useTeacherInvalidate();
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(false);

  const submit = useCallback(async () => {
    if (busyRef.current) return;
    const key = ["teacher-schedule-summary", termKey];
    const prev = qc.getQueryData<SummaryCache>(key);
    const sections = prev?.sections ?? [];
    const targets = sections
      .map((s) => ({
        sectionId: s.id,
        name: s.name,
        count: s.timetableEntries.filter((e) => e.status === "DRAFT").length,
      }))
      .filter((t) => t.count > 0);
    if (targets.length === 0) return;
    busyRef.current = true;
    setSubmitting(true);
    const total = targets.reduce((n, t) => n + t.count, 0);
    const rows: SubmitRowState[] = targets.map((t) => ({ ...t, status: "submitting" as const }));
    const startedAt = Date.now();
    const report = (next: SubmitRowState[], active: boolean) =>
      onProgress?.({ active, done: !active, rows: [...next], total, startedAt });
    // Instant UI: drafts read as submitted everywhere this tick.
    qc.setQueryData<SummaryCache>(key, (old) =>
      old
        ? {
            ...old,
            sections: old.sections.map((s) => ({
              ...s,
              timetableEntries: s.timetableEntries.map((e) =>
                e.status === "DRAFT" ? { ...e, status: "SUBMITTED" as const } : e,
              ),
            })),
          }
        : old,
    );
    report(rows, true);
    try {
      const { data } = await apiClient.post<{ submitted: number }>("/api/teacher/schedule/submit", {});
      for (const r of rows) r.status = "submitted";
      report(rows, false);
      invalidateTeacher.schedule();
      void data;
    } catch (err) {
      // Roll back the optimistic flip so drafts reappear.
      qc.setQueryData(key, prev);
      const message = apiErrorMessage(err, "Failed to submit timetables.");
      for (const r of rows) r.status = "failed";
      rows[0] = { ...rows[0], message };
      report(rows, false);
      toast.error({ title: "Could not send to principal", description: message });
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  }, [invalidateTeacher, onProgress, qc, termKey]);

  return { submit, submitting };
}

export function SubmitDockRows({ rows }: { rows: SubmitRowState[] }) {
  return (
    <ScrollList as="ul" className="max-h-56 gap-1" ariaLabel="Sections in this submission">
      {rows.map((r) => (
        <li key={r.sectionId} className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
          <span className="shrink-0" aria-hidden>
            {r.status === "submitted" ? (
              <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
            ) : r.status === "failed" ? (
              <XCircle size={15} className="text-destructive" />
            ) : (
              <Loader2 size={15} className="animate-spin text-muted-foreground" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className="font-sans text-xs font-medium" title={r.name}>
              {r.name}
            </span>
            <span className="shrink-0 rounded border border-amber-600/45 bg-amber-500/10 px-1.5 font-sans text-[12px] font-medium text-amber-700 dark:border-amber-500/45 dark:text-amber-400">
              {r.count} slot{r.count === 1 ? "" : "s"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-sans text-[11px] text-muted-foreground">
            {r.status === "submitted" ? (
              <>
                <Send size={11} aria-hidden />
                Sent
              </>
            ) : r.status === "failed" ? (
              (r.message ?? "Failed")
            ) : (
              "Sending…"
            )}
          </span>
        </li>
      ))}
    </ScrollList>
  );
}

export { SUBMIT_STEPS };

/**
 * Standalone Send-to-principal tab: full-width kanban under the header with
 * one card per section holding drafts, then a Send footer.
 */
export function SendToPrincipalKanban({
  onSubmitProgress,
}: {
  onSubmitProgress?: (p: SubmitProgress | null) => void;
}) {
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

  const { submit, submitting } = useSubmitTimetable(termKey, onSubmitProgress);

  const sections = sectionsQuery.data?.sections ?? [];
  const drafts = sections
    .map((s) => ({
      id: s.id,
      name: s.name,
      count: s.timetableEntries.filter((e) => e.status === "DRAFT").length,
    }))
    .filter((s) => s.count > 0);
  const totalDrafts = drafts.reduce((n, s) => n + s.count, 0);

  return (
    <div className={kanbanStyles.view} aria-label="Send to principal">
      <div className={`${kanbanStyles.column} mx-auto w-full max-w-3xl`}>
        <KanbanBoard
          title="Send to principal"
          icon={
            <span className="text-amber-500" aria-hidden>
              <Send size={14} />
            </span>
          }
          count={<span className="text-amber-600 dark:text-amber-500">{totalDrafts}</span>}
          description={
            totalDrafts > 0
              ? `${totalDrafts} draft slot${totalDrafts === 1 ? "" : "s"} awaiting review. Submitted slots await principal approval.`
              : undefined
          }
          className="h-full"
          footer={
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button
                size="sm"
                onClick={() => void submit()}
                disabled={totalDrafts === 0 || submitting}
                aria-busy={submitting || undefined}
                className="h-6 border-input bg-white font-sans text-black hover:bg-neutral-100 hover:text-black dark:border-transparent dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Sending…</span>
                  </>
                ) : (
                  `Send${totalDrafts > 0 ? ` (${totalDrafts})` : ""}`
                )}
              </Button>
            </div>
          }
        >
          {sectionsQuery.isPending ? (
            <div className="flex flex-col gap-1.5 px-1" aria-busy="true" aria-label="Loading drafts">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-muted" />
              ))}
            </div>
          ) : sectionsQuery.isError ? (
            <p role="alert" className="px-1 font-sans text-sm text-destructive">
              Could not load drafts.
            </p>
          ) : drafts.length === 0 ? (
            <p className={kanbanStyles.empty}>No draft slots — stage timetable cells first.</p>
          ) : (
            <ScrollList className="grid max-h-[50dvh] grid-cols-1 gap-1.5 px-1 sm:grid-cols-2" role="list" ariaLabel="Sections with drafts">
              {drafts.map((s, idx) => (
                <div
                  key={s.id}
                  role="listitem"
                  className={kanbanStyles.card}
                  style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                >
                  <span className={`${kanbanStyles.name} font-sans`} title={s.name}>
                    {s.name}
                  </span>
                  <span className={kanbanStyles.meta}>
                    <span className="shrink-0 rounded border border-amber-600/45 bg-amber-500/10 px-1.5 font-sans text-[12px] font-medium text-amber-700 dark:border-amber-500/45 dark:text-amber-400">
                      {s.count} slot{s.count === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
              ))}
            </ScrollList>
          )}
        </KanbanBoard>
      </div>
    </div>
  );
}
