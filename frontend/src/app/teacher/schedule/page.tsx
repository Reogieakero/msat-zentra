"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { useTeacherInvalidate } from "../components/use-teacher-invalidate";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useSession } from "@/lib/auth/useSession";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { Inbox, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
// Section cards share one component with the principal schedule grid.
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { SectionScheduleCard } from "@/components/schedule/SectionScheduleCard";
import styles from "./schedule-empty.module.css";
import { CatalogCards } from "./components/CatalogCards";
import { WorkspaceCards } from "./components/WorkspaceCards";

export interface ScheduleSubject {
  id: string;
  name: string;
  code: string;
  gradeLevel: string;
  category: string;
}

interface Assignment {
  id: string;
  subjectId: string;
  sectionId: string;
  subject: ScheduleSubject;
  section: { name: string; gradeLevel: string };
}

export interface ScheduleSection {
  id: string;
  name: string;
  gradeLevel: string;
  adviserId: string | null;
  adviser: { fullName: string } | null;
  _count: { students: number };
  teacherAssignments: Assignment[];
  timetableEntries: TimetableEntry[];
}

export interface TimetableEntry {
  subjectId: string;
  teacherNameId: string | null;
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  reviewNote: string | null;
  subject: { id: string; name: string; code: string };
  teacherName: { id: string; name: string } | null;
}

interface ScheduleData {
  sections: ScheduleSection[];
}

function ScheduleSkeleton() {
  return (
    <div className={styles.skelWrap} aria-busy="true" aria-label="Loading schedule">
      <div className="flex items-center gap-3">
        <div className={styles.skelAvatar} />
        <div className="flex-1 space-y-2">
          <div className={styles.skelLabel} />
          <div className={styles.skelSub} />
        </div>
        <div className={styles.skelBtn} />
      </div>
      <div className={styles.skelGrid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skelCard}>
            <div className="flex items-center gap-3">
              <div className={styles.skelAvatar} />
              <div className="flex-1 space-y-1.5">
                <div className={styles.skelLabel} />
                <div className={styles.skelName} />
              </div>
              <div className={styles.skelBtn} />
            </div>
            <div className="space-y-1.5 mt-2">
              {[0, 1].map((j) => (
                <div key={j} className="h-8 rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeacherSchedulePage() {
  const invalidateTeacher = useTeacherInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const session = useSession();
  const overview = useTeacherOverview();
  // First-frame value from the per-teacher cache — on a hard refresh the gate
  // must not flash "enable Master Teacher" for someone who already has it.
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher = overview.data?.isMasterTeacher ?? cachedMaster;
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const {
    data: schedData,
    isLoading: schedIsLoading,
    isError: schedIsError,
  } = useQuery<ScheduleData>({
    queryKey: ["teacher-schedule", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<ScheduleData>("/api/teacher/schedule");
      return data;
    },
    enabled: isMasterTeacher,
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete("/api/teacher/schedule/entries/clear-all");
      return data as { deleted: number; skippedApproved?: number };
    },
    onSuccess: (data) => {
      setConfirmClearOpen(false);
      invalidateTeacher.schedule();
      const skipped = data.skippedApproved ?? 0;
      toast.success({
        title: "Timetables cleared",
        description:
          `${data.deleted} slot${data.deleted === 1 ? "" : "s"} removed workspace-wide.` +
          (skipped > 0
            ? ` ${skipped} approved slot${skipped === 1 ? "" : "s"} kept — unlock ${skipped === 1 ? "its" : "their"} section to remove ${skipped === 1 ? "it" : "them"}.`
            : ""),
      });
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
      const serverMessage = data?.error?.message ?? data?.message;
      const message =
        typeof serverMessage === "string" && serverMessage
          ? serverMessage
          : "Failed to clear timetables.";
      toast.error({ title: "Could not clear timetables", description: message });
    },
  });

  // Overview still unknown: paint the skeleton, never the "enable it" gate —
  // that text must not flash for a teacher who already enabled the toggle.
  // (Branching on `session` here would reintroduce the mismatch: it is null
  // on the server but present on the hydrated client.)
  if (overview.isPending) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <ScheduleSkeleton />
      </section>
    );
  }

  if (!isMasterTeacher) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only Master Teachers can access the subject scheduling workspace.
          </p>
        </div>
        <div className="rounded-xl border border-input bg-card p-8 text-center text-sm text-muted-foreground">
          Enable Master Teacher status in Settings to manage subject assignments for grades 7–10.
        </div>
      </section>
    );
  }

  if (schedIsLoading) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <ScheduleSkeleton />
      </section>
    );
  }

  if (schedIsError || !schedData) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p role="alert" className="text-sm text-destructive">Could not load schedule.</p>
      </section>
    );
  }

  const sections = schedData.sections;
  // Every principal-added section shows here — scheduled or not — so a newly
  // added section is never unreachable. Clicking a card opens its weekly
  // template at its own URL (empty for unscheduled sections). Sorted by
  // grade, then name.
  const gradeNumber = (g: string) => Number(g.replace("G", "")) || 0;
  const orderedSections = [...sections].sort(
    (a, b) => gradeNumber(a.gradeLevel) - gradeNumber(b.gradeLevel) || a.name.localeCompare(b.name),
  );
  const totalSlots = sections.reduce((n, s) => n + s.timetableEntries.length, 0);

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {orderedSections.length === 0 ? (
            <div className={styles.emptyWrap}>
              <div className={styles.card}>
                <span className={styles.glowClip} aria-hidden="true">
                  <span className={styles.cardGlow} />
                </span>
                <div className="relative flex flex-col items-center justify-center gap-0.5 p-8 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Inbox size={32} className="text-primary" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold">No sections yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sections created by the principal (grades 7–10) will appear here for
                    scheduling.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className={assign.grid} role="group" aria-label="Sections">
              {orderedSections.map((section) => {
                const scheduled = section.timetableEntries.length > 0;
                return (
                  <SectionScheduleCard
                    key={section.id}
                    href={`/teacher/schedule/${section.id}`}
                    ariaLabel={
                      scheduled
                        ? `Open schedule for ${section.name}`
                        : `Set up schedule for ${section.name} — no schedule yet`
                    }
                    gradeLevel={section.gradeLevel}
                    sectionName={section.name}
                    adviserName={section.adviser?.fullName ?? null}
                    timetableEntries={section.timetableEntries}
                    hint={scheduled ? null : "No schedule yet — tap to set up"}
                  />
                );
              })}
            </div>
          )}
        </div>
        <div className={`flex min-w-0 flex-col gap-4 ${styles.railSticky}`}>
          <CatalogCards layout="rail" />
          <WorkspaceCards />
          {totalSlots > 0 ? (
            <div
              className={assign.card}
              aria-label="Danger zone"
              style={{
                borderColor: "color-mix(in oklch, #ef4444 45%, transparent)",
                background:
                  "linear-gradient(135deg, color-mix(in oklch, #ef4444 26%, var(--card)), color-mix(in oklch, #b91c1c 18%, var(--card)))",
              }}
            >
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10"
                  aria-hidden="true"
                >
                  <Trash2 size={20} className="text-destructive" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">Clear all timetables</h3>
                  <p className="text-xs text-muted-foreground">
                    Removes {totalSlots} slot{totalSlots === 1 ? "" : "s"} workspace-wide.
                    Approved slots are kept.
                  </p>
                </div>
              </div>
              <div className="relative mt-auto flex gap-2 pt-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmClearOpen(true)}
                  disabled={clearAll.isPending}
                >
                  Clear all timetables
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {confirmClearOpen ? (
        <CardModal
          open
          onClose={() => {
            if (!clearAll.isPending) setConfirmClearOpen(false);
          }}
          dismissable={!clearAll.isPending}
          size="sm"
          title="Clear all timetables?"
          description={
            <>
              This removes all {totalSlots} scheduled slot{totalSlots === 1 ? "" : "s"}{" "}
              workspace-wide. Approved slots are kept — unlock their sections to remove
              them. Subjects and teacher names stay in their lists.
            </>
          }
          watchKey={clearAll.isPending}
        >
          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              onClick={() => setConfirmClearOpen(false)}
              disabled={clearAll.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
              aria-busy={clearAll.isPending || undefined}
            >
              {clearAll.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Removing…</span>
                </>
              ) : (
                "Remove all"
              )}
            </Button>
          </div>
        </CardModal>
      ) : null}
    </section>
  );
}
