"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import {
  SECTION_CARD_STATUS_META,
  sectionCardStatus,
} from "@/components/schedule/SectionScheduleCard";
import { scheduleTone } from "@/lib/labels/status-tone";
import type { ScheduleSection } from "./schedule-table";
import styles from "./schedule.module.css";

function errorMessage(err: unknown): string {
  const data = (
    err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } }
  )?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return "Could not record the decision. Please try again.";
}

/**
 * Kanban-styled review overlay for the schedule table. Approve / send back
 * runs through the shared dock and closes the overlay as soon as the decision
 * settles.
 */
export function ScheduleReviewOverlay({
  section,
  onClose,
}: {
  section: ScheduleSection | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const [note, setNote] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const sectionId = section?.id ?? null;
  const dockIdRef = React.useRef<string | null>(null);
  const pendingNameRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    setNote("");
    setFormError(null);
  }, [sectionId]);

  const review = useMutation({
    mutationFn: async (vars: {
      sectionId: string;
      decision: "approve" | "reject";
      note?: string;
    }) => {
      const { data } = await apiClient.post("/api/academics/schedule/review", {
        sectionId: vars.sectionId,
        decision: vars.decision,
        note: vars.note,
      });
      return data as { approved?: number; rejected?: number };
    },
    onSuccess: (data, vars) => {
      const name = pendingNameRef.current ?? "Section";
      void queryClient.invalidateQueries({ queryKey: ["principal-schedule-sections"] });
      if (vars.decision === "approve") {
        toast.success({
          title: "Schedule approved",
          description: `${data.approved ?? 0} slots for ${name} are now official.`,
        });
        if (dockIdRef.current) dock.completeTask(dockIdRef.current, `${name} approved`);
      } else {
        toast.success({
          title: "Sent back for revision",
          description: `${name} returned to draft with your note.`,
        });
        if (dockIdRef.current) dock.completeTask(dockIdRef.current, `${name} sent back`);
      }
      dockIdRef.current = null;
    },
    onError: (err: unknown) => {
      const message = errorMessage(err);
      if (dockIdRef.current) {
        dock.failTask(dockIdRef.current, message);
        dockIdRef.current = null;
      }
      toast.error({ title: "Could not record decision", description: message });
    },
  });

  const submit = (decision: "approve" | "reject") => {
    if (!section || review.isPending) return;
    if (decision === "reject" && !note.trim()) {
      setFormError("A revision note is required to send a schedule back.");
      return;
    }
    // The overlay closes right away and the shared dock carries the progress.
    pendingNameRef.current = section.name;
    dockIdRef.current = dock.startTask({
      kind: "generic",
      title: decision === "approve" ? "Approving schedule" : "Sending schedule back",
      description: `${section.name} · Grade ${section.gradeLevel.replace("G", "")}`,
    });
    onClose();
    review.mutate({
      sectionId: section.id,
      decision,
      note: note.trim() || undefined,
    });
  };

  const status = section ? sectionCardStatus(section.timetableEntries) : "empty";
  const meta = SECTION_CARD_STATUS_META[status];
  const submitted = section
    ? section.timetableEntries.filter((entry) => entry.status === "SUBMITTED").length
    : 0;

  return (
    <KanbanOverlay
      open={Boolean(section)}
      onClose={onClose}
      width="md"
      icon={
        <span className="text-primary" aria-hidden>
          <CalendarDays size={14} />
        </span>
      }
      title={section ? `Review schedule for ${section.name}` : "Review schedule"}
      description="Approve the timetable or send it back to the master teacher with a revision note."
      headerActions={<Pill tone={scheduleTone(status)}>{meta.label}</Pill>}
      footer={
        status === "approved" ? undefined : (
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => submit("reject")}
              disabled={submitted === 0}
            >
              <span aria-live="polite">Reject</span>
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => submit("approve")}
              disabled={submitted === 0}
            >
              <span aria-live="polite">Approve</span>
            </Button>
          </div>
        )
      }
    >
      {section ? (
        <div className={styles.reviewBody}>
          <div className={styles.reviewHead}>
            <span className={styles.reviewMascot}>
              <StudentMascot
                name={section.name}
                seed={`${section.name}:${section.gradeLevel}`}
                size={48}
              />
            </span>
            <div className={styles.reviewMeta}>
              <p className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Section</span>
                <Pill tone="blue" label="Section">
                  {section.name}
                </Pill>
              </p>
              <p className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Grade level</span>
                <Pill tone="neutral" label="Grade level">
                  Grade {section.gradeLevel.replace("G", "")}
                </Pill>
              </p>
              <p className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Teacher</span>
                {section.adviser?.fullName ? (
                  <Pill
                    tone="amber"
                    label="Teacher"
                    className="max-w-[16rem] overflow-hidden"
                  >
                    {section.adviser.fullName}
                  </Pill>
                ) : (
                  <Pill tone="neutral" label="Teacher">
                    No adviser
                  </Pill>
                )}
              </p>
              <p className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Awaiting review</span>
                <span className={styles.reviewValue}>
                  {submitted} of {section.timetableEntries.length} slots
                </span>
              </p>
            </div>
          </div>

          {submitted === 0 ? (
            <p className={styles.reviewHint}>
              Nothing is submitted for this section yet — there is nothing to approve.
            </p>
          ) : (
            <>
              <Textarea
                rows={3}
                placeholder="Revision note (required to send back)…"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setFormError(null);
                }}
                aria-label={`Revision note for ${section.name}`}
              />
              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
