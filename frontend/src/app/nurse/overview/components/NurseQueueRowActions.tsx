"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MoreHorizontal } from "lucide-react";
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
import {
  addNurseFollowUpNote,
  apiErrorMessage,
  updateNurseReferralStatus,
  type NurseQueueRow,
  type NurseReferralStatus,
} from "./nurse-overview-data";
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
  // Hides menu entries the caller already offers as primary buttons
  // (timeline layout).
  hiddenItems?: Array<"start" | "resolve">;
  // Deep-links to the page where this case lives (alerts table): "See
  // more" jumps to the highlighted case, "View referral form" also
  // overlays the filled referral form — no manual hunting.
  seeMoreHref?: string;
  viewFormHref?: string;
  // View-only mode (alerts table): exactly three items — View referral
  // form, View anecdotal report, See more. No status edits, no truncation.
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
    onSuccessExtra: () => onChanged(),
  });
  const noteMutation = useNurseMutation({
    mutationFn: (text: string) => addNurseFollowUpNote(row.anecdotalId!, text),
    successTitle: "Note added",
    successDescription: () => `Follow-up note saved for ${row.student}.`,
    errorFallback: "Could not save the note. Try again.",
    silentError: true,
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
  // Endorsed ADM cases moved to the coordinator with their full report —
  // the anecdotal write-up is no longer viewable on this desk (same rule
  // as the ADM referrals page).
  const isEndorsedRow = isEndorsed(row.type, row.status);

  function openReport() {
    if (isEndorsedRow) {
      setEndorsedOpen(true);
      return;
    }
    if (!row.anecdotalId) return;
    // Same privacy rule as guidance: finished cases keep the full
    // write-up hidden; the summary on this page stays visible.
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
    // Mirror the referrals-page gate: Done needs ≥1 completed clinic
    // session (docs stay optional). The server enforces this too — this
    // is just the friendly early message.
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
          >
            <MoreHorizontal aria-hidden />
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
                  Track ADM referral
                </DropdownMenuItem>
              )}
              {viewFormHref && (
                <DropdownMenuItem asChild className={styles.menuItem}>
                  <Link href={viewFormHref}>View referral form</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className={styles.menuItem}
                disabled={!row.anecdotalId && !isEndorsedRow}
                onSelect={openReport}
              >
                View anecdotal report
              </DropdownMenuItem>
              {seeMoreHref && (
                <DropdownMenuItem asChild className={styles.menuItem}>
                  <Link href={seeMoreHref}>See more</Link>
                </DropdownMenuItem>
              )}
            </>
          ) : (
          <>
          {(seeMoreHref || viewFormHref) && (
            <>
              {seeMoreHref && (
                <DropdownMenuItem asChild>
                  <Link href={seeMoreHref}>See more…</Link>
                </DropdownMenuItem>
              )}
              {viewFormHref && (
                <DropdownMenuItem asChild>
                  <Link href={viewFormHref}>View referral form…</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          {/* ADM cases follow the consultation review pipeline — raw status
              edits are blocked server-side, so only notes stay here. */}
          {isAdm && (
            <DropdownMenuItem
              disabled={notePending}
              onSelect={() => setTrackOpen(true)}
            >
              Track ADM referral
            </DropdownMenuItem>
          )}
          {!isAdm && (
            <>
              {(row.status === "pending" || row.status === "escalated") && !hiddenItems.includes("start") && (
                <DropdownMenuItem disabled={statusPending} onSelect={() => setStartOpen(true)}>
                  Start handling…
                </DropdownMenuItem>
              )}
              {QUICK_ACTIONS.filter((a) => a.status !== row.status).map((action) => (
                <DropdownMenuItem
                  key={action.status}
                  disabled={statusPending}
                  onSelect={() => runStatus(action.status)}
                >
                  {statusPending ? "Updating…" : action.label}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuItem disabled={notePending || !row.anecdotalId} onSelect={openReport}>
            View anecdotal report…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={notePending || !row.anecdotalId} onSelect={() => setNoteOpen(true)}>
            Add follow-up note…
          </DropdownMenuItem>
          {!isAdm && !hiddenItems.includes("resolve") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={statusPending} onSelect={() => setResolveOpen(true)}>
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
            if (!open) {
              setResolveOpen(false);
              setDialogError(null);
              statusMutation.reset();
            }
          }}
        >
          <DialogContent>
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
            if (!open) {
              setNoteOpen(false);
              setDialogError(null);
              noteMutation.reset();
            }
          }}
        >
          <DialogContent>
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
              <Button onClick={() => handleNote()} disabled={notePending}>
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
