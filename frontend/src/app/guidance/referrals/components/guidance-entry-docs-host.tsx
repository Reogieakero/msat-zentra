"use client";
import { Users } from "lucide-react";
import { CardModal } from "@/components/ui/CardModal";
import type {
  CounselingSessionItem,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
import { sessionTypeLabel } from "./guidance-referrals-format";
import { SessionPlanCard } from "@/components/session-plan/SessionPlanCard";
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
      <CardModal
        open={sessOpen}
        onClose={() => onSessOpenChange(false)}
        size="md"
        title={
          <span className="flex items-center gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold leading-6 text-foreground">
                Counseling sessions
              </span>
              <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">{row.student}</span>
                {" · "}
                {count} {count === 1 ? "session" : "sessions"} on this case
              </span>
            </span>
          </span>
        }
        watchKey={`${row.id}:${count}`}
      >
        <div className="flex flex-col gap-3">
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
      </CardModal>
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
