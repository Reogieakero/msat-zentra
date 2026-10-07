"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Loader2, Printer } from "lucide-react";
import { fetchOcForm01Detail } from "@/components/ocform01/ocform01";
import { CONCERN_OPTIONS, type GcForm03Data } from "@/services/guidance/gcform03.types";
import { buildGcForm03Data } from "@/services/guidance/gcform03.service";
import type { GuidanceAdmCase } from "@/services/guidance/adm.types";
import sheetStyles from "@/app/guidance/adm/components/GcForm03PreviewDialog.module.css";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  forwardNurseAdmCase,
  parseSavedNurseAdmForm,
  updateNurseReferralStatus,
} from "@/services/nurse/referrals.service";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { useNurseMutation } from "../../overview/components/use-nurse-mutation";
import type { DialogProps } from "./NurseSessionDialogs";
import styles from "./NurseReferralDialogs.module.css";
export function ResolveCaseDialog({
  row,
  open,
  onClose,
  onChanged,
}: DialogProps & { row: NurseQueueRow }) {
  const [summary, setSummary] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const resolveMutation = useNurseMutation({
    mutationFn: (resolutionSummary?: string) =>
      updateNurseReferralStatus(row.id, "resolved", resolutionSummary),
    successTitle: "Case closed",
    successDescription: () => `${row.student}'s case is resolved.`,
    errorFallback: "Could not resolve this case. Try again.",
    silentError: true,
    sourceId: row.id,
    onSuccessExtra: () => {
      onClose();
      setSummary("");
      setError(null);
      onChanged();
    },
  });
  const acting = resolveMutation.isPending;
  const serverError = resolveMutation.error
    ? apiErrorMessage(resolveMutation.error, "Could not resolve this case. Try again.")
    : null;

  if (!open) return null;

  // Proper clinic close-out: review → accept → ≥1 completed session → done.
  // Docs stay optional — only the completed session gates Done.
  const completed = row.sessions.filter((s) => s.status === "completed").length;
  const docCount = row.sessions.reduce((n, s) => n + (s.attachments?.length ?? 0), 0);
  const canResolve = completed > 0;

  function save() {
    if (!canResolve) {
      setError("Finish at least one clinic session before marking this case done — schedule one, mark it done, then come back.");
      return;
    }
    setError(null);
    resolveMutation.mutate(summary.trim() ? summary.trim() : undefined);
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !acting) { onClose(); setError(null); resolveMutation.reset(); } }}>
      <DialogContent className={styles.dialogScrollHidden} aria-busy={acting || undefined}>
        <DialogHeader>
          <DialogTitle>Finish &amp; close</DialogTitle>
          <DialogDescription>
            Step 4 — close {row.student}&rsquo;s case. A closing summary is optional but recommended.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <div className={styles.errorBlock} style={{ borderStyle: "solid" }} aria-live="polite">
              <p className={styles.errorText} style={{ fontWeight: 600 }}>
                {canResolve
                  ? `Ready to close — ${completed} session${completed === 1 ? "" : "s"} done${docCount > 0 ? ` · ${docCount} photo${docCount === 1 ? "" : "s"} filed` : " · no photos filed (optional)"}.`
                  : "Not ready yet — finish at least one clinic session first. Photos are optional."}
              </p>
            </div>
          </div>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-resolve-${row.id}`}>Closing summary (optional)</Label>
            <Textarea
              id={`nurse-resolve-${row.id}`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What was done? What was the outcome…"
            />
          </div>
        </div>
        {error || serverError ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error ?? serverError}</p></div>) : null}
        <DialogFooter>
          <Button variant="destructive" className={styles.btnRed} onClick={onClose} disabled={acting}>
            Cancel
          </Button>
          <Button onClick={() => save()} disabled={acting || !canResolve} aria-busy={acting || undefined}>
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {acting ? "Closing…" : "Finish & close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* Map saved concern labels back onto the template's checkboxes. "Others: …"
   and unknown labels land in the Others text so nothing saved is lost. */
function savedConcernsRecord(labels: string[]): GcForm03Data["concerns"] {
  const record: GcForm03Data["concerns"] = {
    absences: false,
    academic: false,
    personal: false,
    family: false,
    peer: false,
    others: false,
    othersText: "",
  };
  const extras: string[] = [];
  for (const label of labels) {
    if (label.startsWith("Others:")) {
      record.others = true;
      const text = label.slice("Others:".length).trim();
      if (text) extras.push(text);
      continue;
    }
    const opt = CONCERN_OPTIONS.find((c) => c.label === label);
    if (opt && opt.key !== "others") {
      record[opt.key] = true;
    } else if (opt) {
      record.others = true;
    } else {
      record.others = true;
      extras.push(label);
    }
  }
  if (extras.length > 0) record.othersText = extras.join(", ");
  return record;
}
/**
 * Read-only view of a confirmed referral form: the saved answers are
 * autofilled onto the official GCForm-03 template (the same sheet preview
 * the confirm flow shows) — nothing here is editable because the fill-up is
 * done. For the rare form-ready case that is still pending (saved before
 * auto-endorse existed), the footer offers Confirm & endorse instead.
 */
export function NurseReferralFormViewModal({
  row,
  open,
  onClose,
  onChanged,
}: DialogProps & { row: NurseQueueRow }) {
  const [built, setBuilt] = React.useState<GcForm03Data | null>(null);
  const [sheetHtml, setSheetHtml] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const endorseMutation = useNurseMutation({
    mutationFn: () => forwardNurseAdmCase(row.id),
    successTitle: "Case endorsed",
    successDescription: () => `${row.student}'s case moves to the ADM coordinator.`,
    errorFallback: "Could not endorse this case. Try again.",
    silentError: true,
    sourceId: row.id,
    onSuccessExtra: () => {
      onClose();
      onChanged();
    },
  });
  const endorsing = endorseMutation.isPending;
  const endorseError = endorseMutation.error
    ? apiErrorMessage(endorseMutation.error, "Could not endorse this case. Try again.")
    : null;
  const [downloadPending, setDownloadPending] = React.useState(false);

  // Legacy state only: saved (form ready) but never forwarded, because the
  // save predates auto-endorse. New confirms never land here.
  const needsEndorse = row.status === "pending" && row.referralReady;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Fresh mount per case (caller keys by row id), so the initial nulls
    // above already render the loading state — no sync resets here.
    void (async () => {
      try {
        const saved = parseSavedNurseAdmForm(row.notes);
        let report = null;
        if (row.anecdotalId) {
          try {
            report = await fetchOcForm01Detail(row.anecdotalId);
          } catch {
            report = null;
          }
        }
        const adapter: GuidanceAdmCase = {
          id: row.id,
          student: row.student,
          lrn: row.lrn,
          section: row.section,
          grade: row.grade,
          stage: "consultation",
          stageLabel: "Consultation and referral",
          eligibility: "pending",
          referralId: row.id,
          referralStatus: row.status,
          reason: row.reason,
          referredBy: "",
          preparedBy: "",
          date: row.date,
          meetingAttended: null,
          hasHomeVisit: false,
          approved: false,
          approvedAt: null,
          anecdotalId: row.anecdotalId ?? undefined,
          category: row.category,
          anecdotalExcerpt: row.anecdotal?.incident ?? "",
          recommendations: row.anecdotal?.notes ?? "",
        };
        const base = buildGcForm03Data(adapter, report, saved?.recommendation ?? "", "");
        const data: GcForm03Data = saved
          ? {
              ...base,
              concerns: savedConcernsRecord(saved.concerns),
              detailsOfConcern: saved.details || base.detailsOfConcern,
              referrerActions: saved.actions
                ? [
                    { date: row.date, action: saved.actions },
                    { date: "", action: "" },
                    { date: "", action: "" },
                  ]
                : base.referrerActions,
              guidanceRecommendations: saved.recommendation || base.guidanceRecommendations,
              followUp: saved.followUp || base.followUp,
            }
          : base;
        const [{ buildFilledGcForm03Workbook }, { renderGcForm03SheetHtml }] =
          await Promise.all([
            import("@/app/guidance/adm/components/gcform03-workbook"),
            import("@/app/guidance/adm/components/gcform03-sheet-html"),
          ]);
        const wb = await buildFilledGcForm03Workbook(data);
        if (!cancelled) {
          setBuilt(data);
          setSheetHtml(renderGcForm03SheetHtml(wb));
        }
      } catch {
        if (!cancelled) {
          setLoadError("The referral form could not be prepared. Check your connection and try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row]);

  if (!open) return null;

  async function download() {
    if (!built || downloadPending) return;
    setDownloadPending(true);
    setDownloadError(null);
    try {
      const { downloadGcForm03 } = await import(
        "@/app/guidance/adm/components/gcform03-workbook"
      );
      await downloadGcForm03(built);
    } catch {
      setDownloadError("The .xlsx could not be prepared. Check your connection and try again.");
    } finally {
      setDownloadPending(false);
    }
  }

  function endorse() {
    endorseMutation.mutate();
  }

  const loading = !sheetHtml && !loadError;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !endorsing) { onClose(); } }}>
      <DialogContent className={styles.dialogScrollHidden} style={{ maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }} aria-busy={endorsing || undefined}>
        <DialogHeader>
          <DialogTitle>Referral form — {row.student}</DialogTitle>
          <DialogDescription>
            {needsEndorse
              ? "Saved answers, autofilled on the official template. Confirm below to endorse to the ADM coordinator."
              : "Confirmed referral, autofilled on the official template. Read-only."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div
            aria-busy="true"
            role="status"
            aria-label="Loading referral form"
          >
            {/* Mirrors the GCForm-03 sheet surface: white bordered panel,
                DepEd-style header, label/field pairs, checkbox block,
                wide content rows — same proportions as the filled sheet. */}
            <div
              className={`gcform03-print-sheet ${sheetStyles.sheetWrap}`}
              aria-hidden="true"
            >
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <Skeleton style={{ width: "9rem", height: "2rem", flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
                  <Skeleton style={{ width: "70%", height: "1.125rem" }} />
                  <Skeleton style={{ width: "50%", height: "0.875rem" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                    <Skeleton style={{ width: "38%", height: "0.8125rem", flexShrink: 0 }} />
                    <Skeleton style={{ width: "58%", height: "1.25rem" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} style={{ width: "7rem", height: "1.375rem", borderRadius: "4px" }} />
                ))}
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <Skeleton style={{ width: "45%", height: "0.8125rem" }} />
                <Skeleton style={{ width: "100%", height: "4.5rem", marginTop: "0.3125rem" }} />
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <Skeleton style={{ width: "55%", height: "0.8125rem" }} />
                <Skeleton style={{ width: "100%", height: "4.5rem", marginTop: "0.3125rem" }} />
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <Skeleton style={{ width: "60%", height: "0.8125rem" }} />
                <Skeleton style={{ width: "100%", height: "1.5rem", marginTop: "0.3125rem" }} />
              </div>
            </div>
          </div>
        ) : null}
        {loadError ? (
          <p className={styles.errorText} role="alert">{loadError}</p>
        ) : null}
        {sheetHtml ? (
          <div
            className={`gcform03-print-sheet ${sheetStyles.sheetWrap}`}
            dangerouslySetInnerHTML={{ __html: sheetHtml }}
          />
        ) : null}

        {downloadError ? (
          <p className={styles.errorText} role="alert">{downloadError}</p>
        ) : null}
        {endorseError ? (
          <p className={styles.errorText} role="alert">{endorseError}</p>
        ) : null}

        <DialogFooter>
          <div className="flex gap-2 justify-end pt-4 print:hidden" style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", width: "100%" }}>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={endorsing}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={!built || !sheetHtml}
            >
              <Printer aria-hidden />
              Print
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!built || downloadPending}
              onClick={() => void download()}
            >
              <Download aria-hidden />
              {downloadPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {downloadPending ? "Preparing…" : "Download .xlsx"}
            </Button>
            {needsEndorse ? (
              <Button type="button" size="sm" disabled={endorsing} onClick={() => endorse()} aria-busy={endorsing || undefined}>
                {endorsing ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {endorsing ? "Endorsing…" : "Confirm & endorse"}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
