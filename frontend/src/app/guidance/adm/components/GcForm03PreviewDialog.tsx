"use client";

import * as React from "react";
import { FileDown, ImageDown, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanModal } from "@/components/ui/kanban-modal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { gcForm03Filename } from "./gcform03-workbook";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
import styles from "./GcForm03PreviewDialog.module.css";

interface GcForm03PreviewDialogProps {
  open: boolean;
  data: GcForm03Data | null;
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;

  viewOnly?: boolean;
}

export function GcForm03PreviewDialog({
  open,
  data,
  confirming,
  onClose,
  onConfirm,
  viewOnly = false,
}: GcForm03PreviewDialogProps) {
  const [exporting, setExporting] = React.useState<"png" | "jpg" | "pdf" | null>(
    null,
  );
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [sheetHtml, setSheetHtml] = React.useState<string | null>(null);
  const [sheetError, setSheetError] = React.useState<string | null>(null);
  /* Export box (sheet + 16px gutters). Captured as PNG/JPG/PDF. */
  const exportRef = React.useRef<HTMLDivElement | null>(null);

  function handleClose() {
    setExportError(null);
    setExporting(null);
    setSheetHtml(null);
    setSheetError(null);
    onClose();
  }

  React.useEffect(() => {
    if (!open || !data) return;
    let cancelled = false;
    void (async () => {
      try {
        const [{ buildFilledGcForm03Workbook }, { renderGcForm03SheetHtml }] =
          await Promise.all([
            import("./gcform03-workbook"),
            import("./gcform03-sheet-html"),
          ]);
        const wb = await buildFilledGcForm03Workbook(data);
        if (!cancelled) setSheetHtml(renderGcForm03SheetHtml(wb));
      } catch {
        if (!cancelled) {
          setSheetError(
            "The Excel preview could not be prepared. Check your connection and try again."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  // Renders the export box (sheet + 16px gutters) to a PNG data URL.
  // Shared by the PNG/JPG download and the PDF download so all three stay
  // intact and identical — same treatment as the GCForm-01 overlay.
  async function renderExportPng(): Promise<{
    dataUrl: string;
    pxW: number;
    pxH: number;
  }> {
    const node = exportRef.current;
    if (!node) throw new Error("Export node not ready");
    try {
      await document.fonts?.ready;
    } catch {
      /* Fonts are best-effort — the sheet uses Calibri/Arial fallbacks. */
    }
    const { toPng } = await import("html-to-image");
    // Full content size so the sheet is captured intact with its 16px
    // gutters and nothing cut. `style.margin` resets the centering margin
    // (`margin: 0 auto`) that html-to-image would otherwise copy from the
    // live page onto the export clone and shift the sheet right.
    const width = node.scrollWidth || node.offsetWidth || 852;
    const height = node.scrollHeight || node.offsetHeight || undefined;
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width,
      height,
      style: { margin: "0" },
    });
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not read export image"));
      img.src = dataUrl;
    });
    return { dataUrl, pxW: size.w, pxH: size.h };
  }

  async function handleSaveImage(format: "png" | "jpg") {
    const node = exportRef.current;
    if (!node || exporting || !data) return;
    setExporting(format);
    setExportError(null);
    try {
      const { dataUrl } = await renderExportPng();
      let downloadUrl = dataUrl;
      if (format === "jpg") {
        const { toJpeg } = await import("html-to-image");
        const width = node.scrollWidth || node.offsetWidth || 852;
        const height = node.scrollHeight || node.offsetHeight || undefined;
        downloadUrl = await toJpeg(node, {
          cacheBust: true,
          pixelRatio: 2,
          quality: 0.95,
          backgroundColor: "#ffffff",
          width,
          height,
          style: { margin: "0" },
        });
      }
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = gcForm03Filename(data.studentName, format);
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
    if (!exportRef.current || exporting || !data) return;
    setExporting("pdf");
    setExportError(null);
    try {
      const { dataUrl, pxW, pxH } = await renderExportPng();
      const { jsPDF } = await import("jspdf");
      // A4 portrait with the same 16px gutters as the PNG/JPG export
      // (16px at 96dpi = 4.233mm). The intact sheet image is fitted inside,
      // shrunk only if a very long detail overflows one page.
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
      doc.save(gcForm03Filename(data.studentName, "pdf"));
    } catch {
      setExportError("The PDF could not be saved. Try again.");
    } finally {
      setExporting(null);
    }
  }

  const loadingSheet = open && data && !sheetHtml && !sheetError;

  return (
    <KanbanModal
      open={open}
      onClose={handleClose}
      title={
        <>
          GCForm-03 — Referral Form
          {data ? ` — ${data.studentName}` : null}
        </>
      }
      description="Official Excel file preview (GCForm-03). Prints to A4 portrait."
      size="xl"
      dismissable={!confirming && exporting === null}
      footer={
        <TooltipProvider delayDuration={100}>
          <span className="inline-flex flex-wrap items-center justify-end gap-2 print:hidden">
            {exportError ? (
              <span className="text-sm text-destructive" role="alert">
                {exportError}
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => window.print()}
                  disabled={!data || !sheetHtml}
                >
                  <Printer size={14} aria-hidden />
                  Print
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Print the referral form (A4 portrait)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  disabled={!data || !sheetHtml || exporting !== null}
                  onClick={() => void handleSaveImage("png")}
                  aria-busy={exporting === "png" || undefined}
                >
                  {exporting === "png" ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <ImageDown size={14} aria-hidden />
                  )}
                  {exporting === "png" ? "Saving…" : "Save PNG"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Save the filled sheet as a PNG image (16px gutters)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  disabled={!data || !sheetHtml || exporting !== null}
                  onClick={() => void handleSaveImage("jpg")}
                  aria-busy={exporting === "jpg" || undefined}
                >
                  {exporting === "jpg" ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <ImageDown size={14} aria-hidden />
                  )}
                  {exporting === "jpg" ? "Saving…" : "Save JPG"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Save the filled sheet as a JPG image (16px gutters)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  disabled={!data || !sheetHtml || exporting !== null}
                  onClick={() => void handleSavePdf()}
                  aria-busy={exporting === "pdf" || undefined}
                >
                  {exporting === "pdf" ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <FileDown size={14} aria-hidden />
                  )}
                  {exporting === "pdf" ? "Saving…" : "Save PDF"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Save the filled sheet as a PDF (A4 portrait)
              </TooltipContent>
            </Tooltip>
            {viewOnly ? null : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    disabled={!data || confirming}
                    onClick={onConfirm}
                    aria-busy={confirming || undefined}
                  >
                    {confirming ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : null}
                    {confirming ? "Creating…" : "Confirm referral"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Create the GCForm-03 referral record
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        </TooltipProvider>
      }
    >
      {loadingSheet ? (
        <div
          className="flex flex-col gap-2 py-4"
          aria-busy="true"
          aria-label="Loading referral form preview"
        >
          <Skeleton className="h-6 w-[40%]" />
          <div className={styles.sheetWrap} aria-hidden="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[55%]" />
          </div>
        </div>
      ) : null}
      {sheetError ? (
        <p className="text-sm text-destructive py-4" role="alert">
          {sheetError}
        </p>
      ) : null}
      {sheetHtml ? (
        /* Official template in the export box — adds exactly 16px gutters
           for the PNG/JPG/PDF exports, matching the GCForm-01 overlay. */
        <div ref={exportRef} className={styles.exportWrap}>
          <div
            className="gcform03-print-sheet"
            dangerouslySetInnerHTML={{ __html: sheetHtml }}
          />
        </div>
      ) : null}
    </KanbanModal>
  );
}
