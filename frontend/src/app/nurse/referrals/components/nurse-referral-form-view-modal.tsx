"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { KanbanModal } from "@/components/ui/kanban-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, ImageDown, Loader2, Printer } from "lucide-react";
import { fetchOcForm01Detail } from "@/components/ocform01/ocform01";
import { CONCERN_OPTIONS, type GcForm03Data } from "@/services/guidance/gcform03.types";
import { buildGcForm03Data } from "@/services/guidance/gcform03.service";
import type { GuidanceAdmCase } from "@/services/guidance/adm.types";
import sheetStyles from "@/app/guidance/adm/components/GcForm03PreviewDialog.module.css";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  forwardNurseAdmCase,
  parseSavedNurseAdmForm,
} from "@/services/nurse/referrals.service";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { useNurseMutation } from "../../overview/components/use-nurse-mutation";
import type { DialogProps } from "./NurseSessionDialogs";
import styles from "./NurseReferralDialogs.module.css";
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
/** File name for the exported PNG/JPG/PDF of the referral form. */
function exportFilename(
  studentName: string,
  extension: "png" | "jpg" | "pdf"
): string {
  const safe =
    (studentName ?? "")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "referral";
  const date = new Date().toISOString().slice(0, 10);
  return `GCForm-03_${safe}_${date}.${extension}`;
}
export function NurseReferralFormViewModal({
  row,
  open,
  onClose,
  onChanged,
}: DialogProps & { row: NurseQueueRow }) {
  const [built, setBuilt] = React.useState<GcForm03Data | null>(null);
  const [sheetHtml, setSheetHtml] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
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
  const [exporting, setExporting] = React.useState<"png" | "jpg" | "pdf" | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  /* Visible export box (sheet + 16px white gutters) captured for PNG/JPG/PDF. */
  const exportRef = React.useRef<HTMLDivElement | null>(null);
  const needsEndorse = row.status === "pending" && row.referralReady;
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
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
  function endorse() {
    // Close at once — the shared Dock reports the endorsement until it settles.
    onClose();
    endorseMutation.mutate();
  }
  // Renders the export box (sheet + 16px gutters) to a 2× PNG/JPG data URL.
  // Shared by the PNG/JPG downloads and the PDF download so all three stay
  // intact and identical — same treatment as the anecdotal record.
  async function renderExportNode(
    format: "png" | "jpg"
  ): Promise<{ dataUrl: string; pxW: number; pxH: number }> {
    const node = exportRef.current;
    if (!node) throw new Error("Export node not ready");
    try {
      await document.fonts?.ready;
    } catch {
      /* Fonts are best-effort — the sheet falls back to Calibri/Arial. */
    }
    const width = node.scrollWidth || node.offsetWidth || 852;
    const height = node.scrollHeight || node.offsetHeight || undefined;
    // `style.margin` resets the centering margin (`margin: 0 auto`) that
    // html-to-image would otherwise copy onto the export clone.
    const base = {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width,
      height,
      style: { margin: "0" },
    };
    let dataUrl: string;
    if (format === "jpg") {
      const { toJpeg } = await import("html-to-image");
      dataUrl = await toJpeg(node, { ...base, quality: 0.95 });
    } else {
      const { toPng } = await import("html-to-image");
      dataUrl = await toPng(node, base);
    }
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not read export image"));
      img.src = dataUrl;
    });
    return { dataUrl, pxW: size.w, pxH: size.h };
  }
  async function handleSaveImage(format: "png" | "jpg") {
    if (exporting || !built || !sheetHtml) return;
    setExporting(format);
    setExportError(null);
    try {
      const { dataUrl } = await renderExportNode(format);
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = exportFilename(row.student, format);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      setExportError("The image could not be saved. Try again.");
    } finally {
      setExporting(null);
    }
  }
  async function handleSavePdf() {
    if (exporting || !built || !sheetHtml) return;
    setExporting("pdf");
    setExportError(null);
    try {
      const { dataUrl, pxW, pxH } = await renderExportNode("png");
      const { jsPDF } = await import("jspdf");
      // A4 portrait with the same 16px gutters as the PNG/JPG export
      // (16px at 96dpi = 4.233mm). The intact sheet image is fitted inside.
      const GUTTER_MM = (16 * 25.4) / 96;
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const boxW = pageW - GUTTER_MM * 2;
      const boxH = pageH - GUTTER_MM * 2;
      const aspect = pxW / pxH;
      let fitW = boxW;
      let fitH = fitW / aspect;
      if (fitH > boxH) {
        fitH = boxH;
        fitW = fitH * aspect;
      }
      doc.addImage(dataUrl, "PNG", (pageW - fitW) / 2, (pageH - fitH) / 2, fitW, fitH);
      doc.save(exportFilename(row.student, "pdf"));
    } catch {
      setExportError("The PDF could not be saved. Try again.");
    } finally {
      setExporting(null);
    }
  }
  const loading = !sheetHtml && !loadError;
  return (
    <KanbanModal
      open={open}
      onClose={onClose}
      title={`Referral form — ${row.student}`}
      description={
        needsEndorse
          ? "Saved answers, autofilled on the official template. Confirm below to endorse to the ADM coordinator."
          : "Confirmed referral, autofilled on the official template. Read-only."
      }
      size="xl"
      dismissable={!endorsing}
      footer={
        <span className="inline-flex flex-wrap items-center justify-end gap-2 print:hidden">
          {endorseError || exportError ? (
            <span className="text-sm text-destructive" role="alert">
              {endorseError ?? exportError}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
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
            className="h-6 px-2 text-[11px]"
            disabled={!built || !sheetHtml || exporting !== null}
            onClick={() => void handleSaveImage("png")}
            aria-busy={exporting === "png" || undefined}
          >
            {exporting === "png" ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <ImageDown aria-hidden />
            )}
            {exporting === "png" ? "Saving…" : "Save PNG"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            disabled={!built || !sheetHtml || exporting !== null}
            onClick={() => void handleSaveImage("jpg")}
            aria-busy={exporting === "jpg" || undefined}
          >
            {exporting === "jpg" ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <ImageDown aria-hidden />
            )}
            {exporting === "jpg" ? "Saving…" : "Save JPG"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            disabled={!built || !sheetHtml || exporting !== null}
            onClick={() => void handleSavePdf()}
            aria-busy={exporting === "pdf" || undefined}
          >
            {exporting === "pdf" ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <FileDown aria-hidden />
            )}
            {exporting === "pdf" ? "Saving…" : "Save PDF"}
          </Button>
          {needsEndorse ? (
            <Button
              type="button"
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={endorsing}
              onClick={() => endorse()}
              aria-busy={endorsing || undefined}
            >
              {endorsing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
              {endorsing ? "Endorsing…" : "Confirm & endorse"}
            </Button>
          ) : null}
        </span>
      }
    >
        {loading ? (
          <div
            aria-busy="true"
            role="status"
            aria-label="Loading referral form"
          >
            <div
              className={`gcform03-print-sheet ${sheetStyles.exportWrap}`}
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
          <div ref={exportRef} className={sheetStyles.exportWrap}>
            <div
              className="gcform03-print-sheet"
              dangerouslySetInnerHTML={{ __html: sheetHtml }}
            />
          </div>
        ) : null}
    </KanbanModal>
  );
}
