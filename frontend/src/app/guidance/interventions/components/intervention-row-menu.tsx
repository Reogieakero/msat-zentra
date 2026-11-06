"use client";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Eye,
  History,
  MoreHorizontal,
  Paperclip,
  Repeat,
} from "lucide-react";
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
              <Eye aria-hidden />
              See details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onHistoryOpen}>
              <History aria-hidden />
              View session history
            </DropdownMenuItem>
            {filesTotal > 0 && (
              <DropdownMenuItem
                disabled={viewerLoading}
                onSelect={() => onOpenViewer()}
              >
                <Paperclip aria-hidden />
                {viewerLoading ? "Loading files…" : "See attached files"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={locked || isActionPending}
              onSelect={onStart}
            >
              <Repeat aria-hidden />
              Schedule for follow up
            </DropdownMenuItem>
          </>
        ) : isUnbooked ? (
          <>
            <DropdownMenuItem
              disabled={locked || isActionPending}
              onSelect={onSchedule}
            >
              <CalendarPlus aria-hidden />
              Book session
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleDetails}>
              <Eye aria-hidden />
              See details
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={onSessionsOpen}>
              <CalendarCheck aria-hidden />
              Booked session
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleDetails}>
              <Eye aria-hidden />
              See details
            </DropdownMenuItem>
            {filesTotal > 0 && (
              <DropdownMenuItem
                disabled={viewerLoading}
                onSelect={() => onOpenViewer()}
              >
                <Paperclip aria-hidden />
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
                <CalendarPlus aria-hidden />
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
                  <CalendarClock aria-hidden />
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
                  <Repeat aria-hidden />
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
