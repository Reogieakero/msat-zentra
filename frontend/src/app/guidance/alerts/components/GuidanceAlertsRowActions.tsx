"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import {
  BookSessionDialog,
  type BookSessionFields,
  type BookSessionStudentCard,
} from "@/components/session-booking/BookSessionDialog";
import { useDock } from "@/components/dock/dock-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import { fetchDaySchedule } from "@/services/guidance/sessions.service";
import {
  scheduleFollowUpSession,
  startFollowUp,
} from "@/services/guidance/interventions.service";
import type {
  AtRiskStudentItem,
  CounselingSessionType,
} from "@/services/guidance/interventions.types";
import styles from "./guidance-alerts-table.module.css";

function studentCardOf(item: AtRiskStudentItem): BookSessionStudentCard {
  const level = item.riskLevel;
  return {
    name: item.student,
    sub: [item.grade, item.section].filter(Boolean).join(" · "),
    lrn: item.lrn,
    // The board card shows the section pill next to the LRN.
    grade: item.section,
    badgeText: level ? `${level} risk` : undefined,
    badgeVariant:
      level === "High" ? "red" : level === "Moderate" ? "amber" : "outline",
  };
}

/**
 * Booked-session control. With no sessions it renders a "Book session" button
 * so a schedule can be booked straight from the alerts board; once a session
 * exists it collapses to the 24px calendar icon. Both open the same wide
 * booking overlay used by the ADM coordinator (student only, no attendees).
 */
export function GuidanceBookedSessionButton({
  item,
  onBeforeOpen,
  keepOverlayOnOpen = false,
}: {
  item: AtRiskStudentItem;
  onBeforeOpen?: () => void;
  /** Keep the surrounding case overlay mounted while the board is open. */
  keepOverlayOnOpen?: boolean;
}) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const sessions = item.intervention?.sessions ?? [];
  const hasSessions = sessions.length > 0;
  const hasActiveSession = sessions.some((s) => s.status === "scheduled");

  const submit = async (fields: BookSessionFields) => {
    const followUpId = item.intervention?.id ?? null;
    const sessionType = (fields.sessionType || "individual") as CounselingSessionType;
    setServerError(null);
    setBusy(true);
    setOpen(false);
    // Confirm always dismisses every alert overlay — the booking board and any
    // case-detail overlay open underneath it.
    onBeforeOpen?.();

    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Booking session",
        description: `${item.student} · ${new Date(fields.scheduledAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`,
      });
    } catch {
      taskId = null;
    }

    try {
      const payload = {
        scheduledAt: fields.scheduledAt,
        sessionType,
        ...(fields.venue ? { venue: fields.venue } : {}),
      };
      if (followUpId) {
        await scheduleFollowUpSession(followUpId, payload);
      } else {
        // Legacy alert rows can exist before the engine opened a follow-up.
        await startFollowUp(item.studentKey, {
          recommendedAction: "Schedule a counseling session",
          priority:
            item.riskLevel === "High"
              ? "high"
              : item.riskLevel === "Moderate"
                ? "normal"
                : "low",
          firstSession: payload,
        });
      }
      if (taskId) dock.completeTask(taskId, "Session booked.");
      await queryClient.invalidateQueries({ queryKey: ["guidance-alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["guidance-interventions"] });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not book this session. Please try again.";
      if (taskId) dock.failTask(taskId, message);
      setServerError(message);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const control = hasSessions ? (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={styles.actionIconButton}
            aria-label={`Booked sessions for ${item.student}`}
            onClick={(event) => {
              event.stopPropagation();
              if (!keepOverlayOnOpen) onBeforeOpen?.();
              setServerError(null);
              setOpen(true);
            }}
          >
            <CalendarCheck className={styles.actionIcon} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="font-medium">Booked session</span>
          <span className="opacity-60">
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <button
      type="button"
      className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[0.6875rem] font-semibold outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ backgroundColor: "rgb(59 130 246 / 0.15)", color: "#1d4ed8" }}
      onClick={(event) => {
        event.stopPropagation();
        if (!keepOverlayOnOpen) onBeforeOpen?.();
        setServerError(null);
        setOpen(true);
      }}
      aria-label={`Book a session for ${item.student}`}
    >
      <CalendarPlus size={13} aria-hidden />
      Book session
    </button>
  );

  return (
    <>
      {control}
      <BookSessionDialog
        open={open}
        onClose={() => {
          if (busy) return;
          setOpen(false);
          setServerError(null);
        }}
        onSubmit={submit}
        title="Book session"
        description={`Schedule a counseling session for ${item.student}.`}
        studentCard={studentCardOf(item)}
        fetchTakenTimes={(dateKey, signal) => fetchDaySchedule(dateKey, { signal })}
        venueHint="Held at the guidance office unless another venue is given."
        venuePlaceholder="Guidance office"
        showSessionType
        sessionTypeOptions={SESSION_KIND_OPTIONS}
        hasActiveSession={hasActiveSession}
        busy={busy}
        serverError={serverError}
        idPrefix="alerts-book"
        variant="board"
      />
    </>
  );
}
