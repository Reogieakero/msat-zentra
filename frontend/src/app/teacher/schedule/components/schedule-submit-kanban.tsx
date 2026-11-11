"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "@/lib/api/live";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsightCallout } from "@/components/ui/insight-callout";
import { ScrollList } from "@/components/ui/scroll-list";
import { Pill } from "@/components/ui/pill";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useTerm } from "@/lib/term/TermContext";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { toast } from "@/components/ui/sonner";
import type { ScheduleSectionSummary } from "../page";
import { sectionSlug } from "@/lib/sectionSlug";
// Reuse the student list's section-card grid verbatim so the send desk reads
// as the same board as /teacher/overview/students.
import gridStyles from "@/app/teacher/overview/students/components/student-list.module.css";

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
            <Pill tone="amber">
              {r.count} slot{r.count === 1 ? "" : "s"}
            </Pill>
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

const gridListVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

const gridItemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: "easeOut",
      delay: Math.min(index * 0.055, 0.35),
    },
  }),
};

/**
 * Standalone Send-to-principal tab. Uses the student list's section-card grid
 * (`/teacher/overview/students`) so the desk reads as the same board: one
 * bordered card per section holding drafts, with the Send action below.
 */
export function SendToPrincipalKanban({
  onSubmitProgress,
}: {
  onSubmitProgress?: (p: SubmitProgress | null) => void;
}) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const reduceMotion = useReducedMotion() ?? false;
  const router = useRouter();

  const sectionsQuery = useLiveQuery<{ sections: ScheduleSectionSummary[] }>({
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
      gradeLevel: s.gradeLevel,
      count: s.timetableEntries.filter((e) => e.status === "DRAFT").length,
    }))
    .filter((s) => s.count > 0);
  const totalDrafts = drafts.reduce((n, s) => n + s.count, 0);

  const openSectionGrid = (picked: { name: string; gradeLevel: string }) => {
    const slug = sectionSlug(picked.name, picked.gradeLevel, sections);
    router.push(`/teacher/schedule/template/${encodeURIComponent(slug)}?view=grid`);
  };

  // No drafts → no board at all, just the shared empty callout (same treatment
  // as the Subjects/Teachers tabs).
  if (!sectionsQuery.isPending && !sectionsQuery.isError && drafts.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center" aria-label="Send to principal">
        <InsightCallout role="status" className="w-fit max-w-xl text-center">
          No draft slots — stage timetable cells first.
        </InsightCallout>
      </div>
    );
  }

  if (sectionsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading drafts">
        <ul className={gridStyles.sectionCardGrid} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <span className="flex min-h-[124px] flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
                <span className="h-4 w-2/3 rounded bg-muted" />
                <span className="h-4 w-20 rounded-full bg-muted" />
                <span className="mt-auto h-14 rounded-lg bg-muted" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (sectionsQuery.isError) {
    return (
      <p role="alert" className="px-1 font-sans text-sm text-destructive">
        Could not load drafts.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-label="Send to principal">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">
          {totalDrafts} draft slot{totalDrafts === 1 ? "" : "s"} awaiting review. Submitted slots
          await principal approval.
        </span>
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
            <>
              <Send size={12} aria-hidden />
              Send{totalDrafts > 0 ? ` (${totalDrafts})` : ""}
            </>
          )}
        </Button>
      </div>

      <motion.ul
        className={gridStyles.sectionCardGrid}
        variants={gridListVariants}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
      >
        {drafts.map((s, idx) => (
          <motion.li
            key={s.id}
            className="flex min-w-0"
            variants={gridItemVariants}
            custom={idx}
            style={{ willChange: "transform, opacity" }}
          >
            <div className={`${gridStyles.sectionCard} ${gridStyles.sectionCardStatic}`}>
              <span className={gridStyles.sectionCardHead}>
                <span className={gridStyles.sectionCardHeading}>
                  <span className={gridStyles.sectionCardName} title={s.name}>
                    {s.name}
                  </span>
                  <span className={gridStyles.sectionCardMetaRow}>
                    <Pill tone="amber" label="Grade level">
                      Grade {s.gradeLevel.replace("G", "")}
                    </Pill>
                    <Pill tone="neutral" label="Draft slots">
                      {s.count} slot{s.count === 1 ? "" : "s"}
                    </Pill>
                  </span>
                </span>
                <span className={gridStyles.sectionCardIcon} aria-hidden>
                  <Send size={13} />
                </span>
              </span>
              <span className={gridStyles.sectionCardPanel}>
                <span className={gridStyles.sectionCardStat}>
                  <span className={gridStyles.sectionCardStatIcon} aria-hidden>
                    <Send />
                  </span>
                  <Pill tone="blue" label="Draft slots" className="tabular-nums">
                    {s.count}
                  </Pill>
                  <span className={gridStyles.sectionCardStatLabel}>
                    Draft slot{s.count === 1 ? "" : "s"}
                  </span>
                </span>
              </span>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
