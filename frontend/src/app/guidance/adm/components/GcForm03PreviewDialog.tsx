"use client";

import * as React from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadGcForm03 } from "./gcform03-workbook";
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
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [sheetHtml, setSheetHtml] = React.useState<string | null>(null);
  const [sheetError, setSheetError] = React.useState<string | null>(null);

  function handleClose() {
    setDownloadError(null);
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

  async function handleDownload() {
    if (!data || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadGcForm03(data);
    } catch {
      setDownloadError(
        "The .xlsx could not be prepared. Check your connection and try again."
      );
    } finally {
      setDownloading(false);
    }
  }

  const loadingSheet = open && data && !sheetHtml && !sheetError;

  return (
    <CardModal
      open={open}
      onClose={handleClose}
      title={
        <>
          GCForm-03 — Referral Form
          {data ? ` — ${data.studentName}` : null}
        </>
      }
      description="Official Excel file preview (GCForm-03). Prints to A4 portrait."
      size="lg"
      watchKey={sheetHtml ? "ready" : "loading"}
    >

        {loadingSheet ? (
          <div className="flex flex-col gap-2 py-4" aria-busy="true" aria-label="Loading referral form preview">

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
          <div
            className={`gcform03-print-sheet ${styles.sheetWrap}`}

            dangerouslySetInnerHTML={{ __html: sheetHtml }}
          />
        ) : null}

        {downloadError ? (
          <p className="text-sm text-destructive pt-2" role="alert">
            {downloadError}
          </p>
        ) : null}

        <div className="flex gap-2 justify-end pt-4 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={confirming}
          >
            {viewOnly ? "Close" : "Back to questions"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={!data || !sheetHtml}
          >
            <Printer aria-hidden />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data || downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Download aria-hidden />
            )}
            {downloading ? "Preparing…" : "Download .xlsx"}
          </Button>
          {viewOnly ? null : (
            <Button
              type="button"
              size="sm"
              disabled={!data || confirming}
              onClick={onConfirm}
            >
              {confirming ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {confirming ? "Creating…" : "Confirm referral"}
            </Button>
          )}
        </div>
    </CardModal>
  );
}
