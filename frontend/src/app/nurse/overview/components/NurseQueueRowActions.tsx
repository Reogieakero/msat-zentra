"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  FileText,
  Info,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Play,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import { AdmTrackDialog } from "@/components/adm-tracker/AdmTrackDialog";
import { Textarea } from "@/components/ui/textarea";
import { NurseStartHandlingDialog } from "./NurseStartHandlingDialog";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  addNurseFollowUpNote,
  updateNurseReferralStatus,
} from "@/services/nurse/referrals.service";
import type {
  NurseQueueRow,
  NurseReferralStatus,
} from "@/services/nurse/nurse.types";
import { useNurseMutation } from "./use-nurse-mutation";
import { isEndorsed } from "../../referrals/components/nurse-referrals-format";
import styles from "./nurse-overview.module.css";

const QUICK_ACTIONS: { status: NurseReferralStatus; label: string }[] = [
  { status: "info_requested", label: "Request info" },
];

export function NurseQueueRowActions({
  row,
  onChanged,
  hiddenItems = [],
  seeMoreHref,
  viewFormHref,
  viewOnly = false,
}: {
  row: NurseQueueRow;
  onChanged: () => void;

  hiddenItems?: Array<"start" | "resolve">;

  seeMoreHref?: string;
  viewFormHref?: string;

  viewOnly?: boolean;
}) {
  const [startOpen, setStartOpen] = React.useState(false);
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const [note, setNote] = React.useState("");
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [endorsedOpen, setEndorsedOpen] = React.useState(false);
  const [trackOpen, setTrackOpen] = React.useState(false);

  const statusMutation = useNurseMutation({
    mutationFn: (input: { status: NurseReferralStatus; resolutionSummary?: string }) =>
      updateNurseReferralStatus(row.id, input.status, input.resolutionSummary),
    successTitle: "Case updated",
    successDescription: () => `${row.student} moved to the new status.`,
    errorFallback: "Could not update this case.",
    sourceId: row.id,
    onSuccessExtra: () => onChanged(),
  });
  const noteMutation = useNurseMutation({
    mutationFn: (text: string) => addNurseFollowUpNote(row.anecdotalId!, text),
    successTitle: "Note added",
    successDescription: () => `Follow-up note saved for ${row.student}.`,
    errorFallback: "Could not save the note. Try again.",
    silentError: true,
    sourceId: row.id,
    onSuccessExtra: () => {
      setNoteOpen(false);
      setNote("");
      setDialogError(null);
      onChanged();
    },
  });
  const statusPending = statusMutation.isPending;
  const notePending = noteMutation.isPending;

  const isClosed = row.status === "resolved" || row.status === "dismissed";

  const isEndorsedRow = isEndorsed(row.type, row.status);

  function openReport() {
    if (isEndorsedRow) {
      setEndorsedOpen(true);
      return;
    }
    if (!row.anecdotalId) return;

    if (isClosed) setPrivacyOpen(true);
    else setPreviewId(row.anecdotalId);
  }

  function runStatus(status: NurseReferralStatus, resolutionSummary?: string) {
    statusMutation.mutate(
      { status, resolutionSummary },
      {
        onSuccess: () => {
          if (status === "resolved") {
            setResolveOpen(false);
            setSummary("");
            setDialogError(null);
          }
        },
        onError: () => {
          if (status === "resolved") {
            setDialogError(
              statusMutation.error
                ? apiErrorMessage(statusMutation.error, "Could not resolve this case. Try again.")
                : "Could not resolve this case. Try again."
            );
          }
        },
      }
    );
  }

  function handleResolve() {
    setDialogError(null);

    if (row.type !== "ADM" && row.completedSessions === 0) {
      setDialogError("Finish at least one clinic session before marking this case done.");
      return;
    }
    runStatus("resolved", summary.trim() ? summary.trim() : undefined);
  }

  function handleNote() {
    if (!row.anecdotalId) return;
    if (!note.trim()) {
      setDialogError("Write the note first.");
      return;
    }
    setDialogError(null);
    noteMutation.mutate(note.trim(), {
      onError: () => {
        setDialogError(
          noteMutation.error
            ? apiErrorMessage(noteMutation.error, "Could not save the note. Try again.")
            : "Could not save the note. Try again."
        );
      },
    });
  }

  const isAdm = row.type === "ADM";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${row.student}'s case`}
            aria-busy={statusPending || notePending || undefined}
            disabled={statusPending || notePending}
          >
            {statusPending || notePending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <MoreHorizontal aria-hidden />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {viewOnly ? (
            <>
              {isAdm && (
                <DropdownMenuItem
                  className={styles.menuItem}
                  onSelect={() => setTrackOpen(true)}
                >
                  <Route aria-hidden />
                  Track ADM referral
                </DropdownMenuItem>
              )}
              {viewFormHref && (
                <DropdownMenuItem asChild className={styles.menuItem}>
                  <Link href={viewFormHref}>
                    <FileText aria-hidden />
                    View referral form
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className={styles.menuItem}
                disabled={!row.anecdotalId && !isEndorsedRow}
                onSelect={openReport}
              >
                <FileText aria-hidden />
                View anecdotal report
              </DropdownMenuItem>
              {seeMoreHref && (
                <DropdownMenuItem asChild className={styles.menuItem}>
                  <Link href={seeMoreHref}>
                    <Eye aria-hidden />
                    See more
                  </Link>
                </DropdownMenuItem>
              )}
            </>
          ) : (
          <>
          {(seeMoreHref || viewFormHref) && (
            <>
              {seeMoreHref && (
                <DropdownMenuItem asChild>
                  <Link href={seeMoreHref}>
                    <Eye aria-hidden />
                    See more…
                  </Link>
                </DropdownMenuItem>
              )}
              {viewFormHref && (
                <DropdownMenuItem asChild>
                  <Link href={viewFormHref}>
                    <FileText aria-hidden />
                    View referral form…
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {isAdm && (
            <DropdownMenuItem
              disabled={notePending}
              onSelect={() => setTrackOpen(true)}
            >
              <Route aria-hidden />
              Track ADM referral
            </DropdownMenuItem>
          )}
          {!isAdm && (
            <>
              {(row.status === "pending" || row.status === "escalated") && !hiddenItems.includes("start") && (
                <DropdownMenuItem disabled={statusPending} onSelect={() => setStartOpen(true)}>
                  <Play aria-hidden />
                  Start handling…
                </DropdownMenuItem>
              )}
              {QUICK_ACTIONS.filter((a) => a.status !== row.status).map((action) => (
                <DropdownMenuItem
                  key={action.status}
                  disabled={statusPending}
                  onSelect={() => runStatus(action.status)}
                >
                  <Info aria-hidden />
                  {statusPending ? "Updating…" : action.label}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuItem disabled={notePending || !row.anecdotalId} onSelect={openReport}>
            <FileText aria-hidden />
            View anecdotal report…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={notePending || !row.anecdotalId} onSelect={() => setNoteOpen(true)}>
            <MessageSquarePlus aria-hidden />
            Add follow-up note…
          </DropdownMenuItem>
          {!isAdm && !hiddenItems.includes("resolve") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={statusPending} onSelect={() => setResolveOpen(true)}>
                <CheckCircle2 aria-hidden />
                Resolve case…
              </DropdownMenuItem>
            </>
          )}
          </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <NurseStartHandlingDialog
        row={row}
        open={startOpen}
        onClose={() => {
          setStartOpen(false);
          setDialogError(null);
        }}
        onChanged={onChanged}
      />

      {resolveOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !statusPending) {
              setResolveOpen(false);
              setDialogError(null);
              statusMutation.reset();
            }
          }}
        >
          <DialogContent aria-busy={statusPending || undefined}>
            <DialogHeader>
              <DialogTitle>Resolve case</DialogTitle>
              <DialogDescription>
                Close {row.student}&rsquo;s case. Done needs at least one finished clinic session — photos stay optional.
              </DialogDescription>
            </DialogHeader>
            {row.type !== "ADM" && row.completedSessions === 0 ? (
              <p className={styles.dialogError} role="alert">
                Not ready yet — finish at least one clinic session first, then come back to close.
              </p>
            ) : null}
            <div className={styles.dialogField}>
              <Label htmlFor={`resolve-${row.id}`}>Closing summary (optional)</Label>
              <Textarea
                id={`resolve-${row.id}`}
                className={styles.dialogTextarea}
                placeholder="What was done? What was the outcome…"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            {dialogError || statusMutation.error ? (
              <p className={styles.dialogError} role="alert">
                {dialogError ??
                  apiErrorMessage(statusMutation.error, "Could not resolve this case. Try again.")}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="destructive" className={styles.btnRed} onClick={() => setResolveOpen(false)} disabled={statusPending}>
                Cancel
              </Button>
              <Button
                onClick={() => handleResolve()}
                disabled={statusPending || (row.type !== "ADM" && row.completedSessions === 0)}
                aria-busy={statusPending || undefined}
              >
                {statusPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {statusPending ? "Resolving…" : "Resolve case"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {noteOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !notePending) {
              setNoteOpen(false);
              setDialogError(null);
              noteMutation.reset();
            }
          }}
        >
          <DialogContent aria-busy={notePending || undefined}>
            <DialogHeader>
              <DialogTitle>Add follow-up note</DialogTitle>
              <DialogDescription>
                Saved on {row.student}&apos;s underlying report for the care team to see.
              </DialogDescription>
            </DialogHeader>
            <div className={styles.dialogField}>
              <Label htmlFor={`note-${row.id}`}>Note</Label>
              <Textarea
                id={`note-${row.id}`}
                className={styles.dialogTextarea}
                placeholder="What changed? What happens next…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {dialogError || noteMutation.error ? (
              <p className={styles.dialogError} role="alert">
                {dialogError ??
                  apiErrorMessage(noteMutation.error, "Could not save the note. Try again.")}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="destructive" className={styles.btnRed} onClick={() => setNoteOpen(false)} disabled={notePending}>
                Cancel
              </Button>
              <Button
                onClick={() => handleNote()}
                disabled={notePending}
                aria-busy={notePending || undefined}
              >
                {notePending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {notePending ? "Saving…" : "Save note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {previewId && (
        <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
      )}
      {isAdm && trackOpen && (
        <AdmTrackDialog
          open={trackOpen}
          onClose={() => setTrackOpen(false)}
          caseInfo={{
            student: row.student,
            lrn: row.lrn,
            section: row.section,
            reason: row.reason,
          }}
          track={{
            referralStatus: row.status,
            consultReviewer: row.consultReviewer ?? "nurse",
            referredBy: "Adviser",
            anecdotalDate: row.anecdotal?.observedAt ?? row.referredAt,
            referredDate: row.referredAt,
          }}
        />
      )}
      <PrivacyNoticeDialog
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        studentName={row.student}
      />
      <PrivacyNoticeDialog
        open={endorsedOpen}
        onClose={() => setEndorsedOpen(false)}
        studentName={row.student}
        reason="endorsed"
      />
    </>
  );
}
