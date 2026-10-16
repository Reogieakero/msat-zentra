"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { KanbanModal } from "@/components/ui/kanban-modal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageDown, Loader2, PenLine, Printer, Trash2 } from "lucide-react";
import { OcForm01Print } from "./OcForm01Print";
import { SignaturePad } from "./SignaturePad";
import styles from "./OcForm01PreviewDialog.module.css";
import {
  buildOcForm01ImageFilename,
  fetchMySignature,
  fetchOcForm01Detail,
  saveMySignature,
  applyMySignature,
  unsignRecord,
  type OcForm01Detail,
} from "./ocform01";

interface OcForm01PreviewDialogProps {
  recordId: string | null;
  onClose: () => void;
}

export function OcForm01PreviewDialog({
  recordId,
  onClose,
}: OcForm01PreviewDialogProps) {
  const [detail, setDetail] = useState<OcForm01Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"png" | "jpg" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [mySignatureUrl, setMySignatureUrl] = useState<string | null>(null);
  const [mySigLoading, setMySigLoading] = useState(false);
  /* Visible export box (sheet + 16px gutters). Captured as PNG/JPG. */
  const exportRef = useRef<HTMLDivElement | null>(null);

  const refreshDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const d = await fetchOcForm01Detail(id);
      setDetail(d);
      if (d.canSign) {
        setMySigLoading(true);
        try {
          const sig = await fetchMySignature();
          setMySignatureUrl(sig.imageUrl);
        } catch {

        } finally {
          setMySigLoading(false);
        }
      }
    } catch {
      setError("The official form could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const resetDialog = useCallback(() => {
    setDetail(null);
    setError(null);
    setSigning(false);
    setSignError(null);
    setConfirmingRemove(false);
    setMySignatureUrl(null);
    setExportError(null);
    setExporting(null);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    resetDialog();
    if (recordId) void refreshDetail(recordId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [recordId, refreshDetail, resetDialog]);

  async function handleSaveImage(format: "png" | "jpg") {
    const node = exportRef.current;
    if (!node || exporting || !detail) return;
    setExporting(format);
    setExportError(null);
    try {
      try {
        await document.fonts?.ready;
      } catch {
        /* Fonts are best-effort — the sheet uses Arial fallbacks. */
      }
      const { toPng, toJpeg } = await import("html-to-image");
      const ext = format === "png" ? "png" : "jpg";
      // Full content size so the sheet is captured intact with its 16px
      // gutters and nothing cut. `style.margin` resets the centering margin
      // (`margin: 0 auto`) that html-to-image would otherwise copy from the
      // live page onto the export clone and shift the sheet right.
      const width = node.scrollWidth || node.offsetWidth || 852;
      const height = node.scrollHeight || node.offsetHeight || undefined;
      const dataUrl =
        format === "png"
          ? await toPng(node, {
              cacheBust: true,
              pixelRatio: 2,
              backgroundColor: "#ffffff",
              width,
              height,
              style: { margin: "0" },
            })
          : await toJpeg(node, {
              cacheBust: true,
              pixelRatio: 2,
              quality: 0.95,
              backgroundColor: "#ffffff",
              width,
              height,
              style: { margin: "0" },
            });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = buildOcForm01ImageFilename(
        { studentName: detail.studentName, observationDate: detail.observationDate },
        recordId ?? "record",
        ext,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      setExportError("The image could not be saved. Try again.");
    } finally {
      setExporting(null);
    }
  }

  function serverMessage(e: unknown, fallback: string): string {
    if (e && typeof e === "object" && "response" in e) {
      const data = (e as { response?: { data?: { error?: { message?: unknown } } } })
        .response?.data?.error?.message;
      if (typeof data === "string" && data.trim()) return data;
    }
    return fallback;
  }

  async function handleSaveMySignature(dataUrl: string) {
    if (saving) return;
    setSaving(true);
    setSignError(null);
    try {
      await saveMySignature(dataUrl);
      const sig = await fetchMySignature();
      setMySignatureUrl(sig.imageUrl);
      setSigning(false);
    } catch (e) {
      setSignError(serverMessage(e, "Your signature could not be saved. Try drawing again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleApplySignature() {
    if (!recordId || applying) return;
    setApplying(true);
    setSignError(null);
    try {
      await applyMySignature(recordId);
      await refreshDetail(recordId);
    } catch (e) {
      setSignError(serverMessage(e, "Your signature could not be applied. Try again."));
    } finally {
      setApplying(false);
    }
  }

  async function handleRemoveSignature() {
    if (!recordId) return;
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    setConfirmingRemove(false);
    try {
      await unsignRecord(recordId);
      await refreshDetail(recordId);
    } catch (e) {
      setError(serverMessage(e, "The signature could not be removed. Try again."));
    }
  }

  return (
    <KanbanModal
      open={recordId !== null}
      onClose={onClose}
      title="GCForm-01 — Anecdotal Report"
      description="Official template preview (GCForm-01). Prints to A4 portrait. Save as PNG/JPG (16px gutters)."
      size="xl"
      dismissable={!applying && !saving && exporting === null}
      footer={
        signing ? undefined : (
        <span className="inline-flex flex-wrap items-center justify-end gap-2 print:hidden">
          {signError || exportError ? (
            <span className="text-sm text-destructive" role="alert">
              {signError ?? exportError}
            </span>
          ) : null}
          {detail && !signing && detail.canSign && !detail.signature && mySignatureUrl ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px]"
                disabled={applying}
                onClick={() => void handleApplySignature()}
              >
                {applying ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <PenLine aria-hidden />
                )}
                {applying ? "Applying…" : "Apply my signature"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  setSignError(null);
                  setSigning(true);
                }}
              >
                Replace
              </Button>
            </>
          ) : null}
          {detail && !signing && detail.canSign && !detail.signature && !mySignatureUrl && !mySigLoading ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                setSignError(null);
                setSigning(true);
              }}
            >
              <PenLine aria-hidden />
              Create my signature
            </Button>
          ) : null}
          {detail && !signing && detail.canSign && detail.signature ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-[11px] ${confirmingRemove ? styles.dangerBtn : ""}`}
              onClick={() => void handleRemoveSignature()}
              onBlur={() => setConfirmingRemove(false)}
            >
              <Trash2 aria-hidden />
              {confirmingRemove ? "Confirm remove" : "Remove signature"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => window.print()}
            disabled={!detail}
          >
            <Printer aria-hidden />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            disabled={!detail || exporting !== null}
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
            variant="default"
            size="sm"
            className="h-6 px-2 text-[11px]"
            disabled={!detail || exporting !== null}
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
        </span>
        )
      }
    >
      {loading ? (
        <div className="flex flex-col gap-2 py-4" aria-busy="true" aria-label="Loading official template">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[55%]" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive py-4">{error}</p>
      ) : detail ? (
        signing ? (
          <SignaturePad
            onSave={(dataUrl) => void handleSaveMySignature(dataUrl)}
            onCancel={() => {
              setSigning(false);
              setSignError(null);
            }}
            saving={saving}
            error={signError}
          />
        ) : (
          <>
            {detail.signature ? (
              <p className={`${styles.signedLine} print:hidden`}>
                <span>
                  {detail.signature.by} ·{" "}
                  {new Date(detail.signature.at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <Badge variant="green" className="rounded-md">Signed</Badge>
              </p>
            ) : null}
            {/* Official template — export box adds exactly 16px gutters for PNG/JPG. */}
            <div ref={exportRef} className={styles.exportWrap}>
              <OcForm01Print detail={detail} />
            </div>
            {signError || exportError ? (
              <p className="text-sm text-destructive print:hidden" role="alert">
                {signError ?? exportError}
              </p>
            ) : null}
          </>
        )
      ) : null}
    </KanbanModal>
  );
}
