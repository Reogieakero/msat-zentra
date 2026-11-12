"use client";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type {
  CounselingSessionItem,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
import { sessionTypeLabel } from "./guidance-referrals-format";
import {
  SessionPlanCard,
  sessionBoardDialogWidth,
} from "@/components/session-plan/SessionPlanCard";
import { SessionDocsDialog } from "./GuidanceSessionDocsDialog";

export function GuidanceEntryDocsHost({
  row,
  now,
  sessOpen,
  onSessOpenChange,
  docsFor,
  onDocs,
  onDocsClose,
  onOpenSession,
  actionPending,
  onChanged,
  isClosed,
  canManageSessions,
}: {
  row: GuidanceReferralItem;
  now: number;
  sessOpen: boolean;
  onSessOpenChange: (v: boolean) => void;
  docsFor: CounselingSessionItem | null;
  onDocs: (s: CounselingSessionItem) => void;
  onDocsClose: () => void;
  onOpenSession: (
    referralId: string,
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess" | "deleteSess"
  ) => void;
  actionPending: boolean;
  onChanged: () => void;
  isClosed: boolean;
  canManageSessions: boolean;
}) {
  const count = row.sessions.length;
  const firstName = row.student.split(" ")[0];
  return (
    <>
      <Dialog open={sessOpen} onOpenChange={onSessOpenChange}>
        <DialogContent
          showCloseButton={false}
          // The dialog is only a frame for the sessions board — drop its own
          // card chrome so the kanban board is the only surface on screen.
          className={`max-h-[85vh] overflow-y-auto border-0 bg-transparent p-0 shadow-none ${sessionBoardDialogWidth(count)}`}
        >
          {/* Title/description live on the kanban board below (the sr-only
              pair keeps the dialog labelled for screen readers). */}
          <DialogTitle className="sr-only">
            Counseling sessions for {row.student}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {count} {count === 1 ? "session" : "sessions"} on this case.
          </DialogDescription>
          <KanbanBoard
            className="relative bg-card"
            title={`Counseling sessions for ${row.student}`}
            icon={<CalendarClock className="size-3.5" aria-hidden="true" />}
            actions={
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  aria-label="Close"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </DialogClose>
            }
          >
            <SessionPlanCard
              title="Counseling sessions"
              sessions={row.sessions.map((s) => ({
                ...s,
                attachmentsCount: s.attachments?.length ?? 0,
              }))}
              now={now}
              closed={isClosed}
              closedHint="This case is closed — the sessions below are kept as history and can't be changed."
              emptyHint={
                <>No sessions yet — schedule the first talk with {firstName}.</>
              }
              kindLabel={sessionTypeLabel}
              docsSupported
              gateOnStart
              manageable={canManageSessions}
              // Reschedule/cancel live on the case card itself, so the
              // sessions overlay keeps only "Mark done" — same for ADM and
              // counseling cases.
              hideScheduledActions
              disabled={actionPending}
              onAction={(s, action) => {
                if (action === "docs") {
                  onDocs(s);
                  return;
                }
                onOpenSession(
                  row.id,
                  s,
                  action === "cancel"
                    ? "cancelSess"
                    : action === "delete"
                      ? "deleteSess"
                      : action
                );
              }}
            />
          </KanbanBoard>
        </DialogContent>
      </Dialog>
      {docsFor && (
        <SessionDocsDialog
          referralId={row.id}
          session={docsFor}
          open
          onClose={onDocsClose}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
