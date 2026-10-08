"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CounselingSessionItem,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
import { sessionTypeLabel } from "./guidance-referrals-format";
import { SessionPlanCard } from "@/components/session-plan/SessionPlanCard";
import { SessionDocsDialog } from "./GuidanceSessionDocsDialog";
import styles from "./GuidanceReferralEntry.module.css";
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
  return (
    <>
      <Dialog open={sessOpen} onOpenChange={onSessOpenChange}>
        <DialogContent
          className={`${styles.modalCard} max-h-[85vh] overflow-y-auto sm:max-w-lg`}
        >
          <DialogHeader className="relative">
            <DialogTitle>Counseling sessions for {row.student}</DialogTitle>
            <DialogDescription>
              {row.sessions.length} {row.sessions.length === 1 ? "session" : "sessions"} on this case.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
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
                <>No sessions yet — schedule the first talk with{" "}{row.student.split(" ")[0]}.</>
              }
              kindLabel={sessionTypeLabel}
              docsSupported
              gateOnStart
              manageable={canManageSessions}
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
          </div>
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
