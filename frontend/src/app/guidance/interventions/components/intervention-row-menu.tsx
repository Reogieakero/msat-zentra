"use client";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
} from "@/services/guidance/interventions.types";
export function InterventionRowMenu({
  row,
  closed,
  isUnbooked,
  scheduledSession,
  canReschedule,
  canScheduleFollowUp,
  workable,
  filesTotal,
  viewerLoading,
  locked,
  isActionPending,
  onToggleDetails,
  onSessionsOpen,
  onHistoryOpen,
  onOpenViewer,
  onStart,
  onSchedule,
  onSession,
}: {
  row: AtRiskStudentItem;
  closed: boolean;
  isUnbooked: boolean;
  scheduledSession: CounselingSessionItem | null;
  canReschedule: boolean;
  canScheduleFollowUp: boolean;
  workable: boolean;
  filesTotal: number;
  viewerLoading: boolean;
  locked: boolean;
  isActionPending: boolean;
  onToggleDetails: () => void;
  onSessionsOpen: () => void;
  onHistoryOpen: () => void;
  onOpenViewer: () => void;
  onStart: () => void;
  onSchedule: () => void;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${row.student}'s intervention`}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {closed ? (
          <>
            <DropdownMenuItem onSelect={onToggleDetails}>
              See details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onHistoryOpen}>
              View session history
            </DropdownMenuItem>
            {filesTotal > 0 && (
              <DropdownMenuItem
                disabled={viewerLoading}
                onSelect={() => onOpenViewer()}
              >
                {viewerLoading ? "Loading files…" : "See attached files"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={locked || isActionPending}
              onSelect={onStart}
            >
              Schedule for follow up
            </DropdownMenuItem>
          </>
        ) : isUnbooked ? (
          <>
            <DropdownMenuItem
              disabled={locked || isActionPending}
              onSelect={onSchedule}
            >
              Book session
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleDetails}>
              See details
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={onSessionsOpen}>
              Booked session
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleDetails}>
              See details
            </DropdownMenuItem>
            {filesTotal > 0 && (
              <DropdownMenuItem
                disabled={viewerLoading}
                onSelect={() => onOpenViewer()}
              >
                {viewerLoading
                  ? "Loading files…"
                  : `See attached files (×${filesTotal})`}
              </DropdownMenuItem>
            )}
            {!scheduledSession && workable && (
              <DropdownMenuItem
                disabled={locked || isActionPending}
                onSelect={onSchedule}
              >
                Book session
              </DropdownMenuItem>
            )}
            {canReschedule && scheduledSession && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={locked || isActionPending}
                  onSelect={() => onSession(scheduledSession, "move")}
                >
                  Reschedule
                </DropdownMenuItem>
              </>
            )}
            {canScheduleFollowUp && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={locked || isActionPending}
                  onSelect={onSchedule}
                >
                  Schedule for follow up
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
