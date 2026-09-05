"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, PenLine, Printer, Trash2 } from "lucide-react";
import { OcForm01Print } from "./OcForm01Print";
import { SignaturePad } from "./SignaturePad";
import styles from "./OcForm01PreviewDialog.module.css";
import {
  downloadOcForm01,
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

/**
 * Shared OCForm-01 preview overlay: official A4 sheet with Print/Download
 * plus the per-record drawn-signature flow (sign on the pad, remove with
 * confirm), used wherever a record opens as a preview.
 */
export function OcForm01PreviewDialog({
  recordId,
  onClose,
}: OcForm01PreviewDialogProps) {
  const [detail, setDetail] = useState<OcForm01Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [mySignatureUrl, setMySignatureUrl] = useState<string | null>(null);
  const [mySigLoading, setMySigLoading] = useState(false);

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
          // The pad stays available — saving a signature fixes this too.
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
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    resetDialog();
    if (recordId) void refreshDetail(recordId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [recordId, refreshDetail, resetDialog]);

  async function handleDownload() {
    if (!recordId || downloading) return;
    setDownloading(true);
    try {
      await downloadOcForm01(recordId);
    } finally {
      setDownloading(false);
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
    <Dialog
      open={recordId !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        style={{ maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }}
        className={styles.dialog}
      >
        <DialogHeader>
          <DialogTitle>GCForm-01 — Anecdotal Report</DialogTitle>
          <DialogDescription>
            Official template preview (GCForm-01). Prints to A4 portrait.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex flex-col gap-2 py-4" aria-busy="true">
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
                <p className={styles.signedLine}>
                  <Badge variant="default">Signed</Badge>
                  <span>
                    {detail.signature.by} ·{" "}
                    {new Date(detail.signature.at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </p>
              ) : null}
              <OcForm01Print detail={detail} />
              {signError ? (
                <p className="text-sm text-destructive" role="alert">
                  {signError}
                </p>
              ) : null}
              <div className="flex gap-2 justify-end pt-4 print:hidden">
                {detail.canSign && !detail.signature && mySignatureUrl ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={applying}
                      onClick={() => void handleApplySignature()}
                    >
                      <PenLine aria-hidden />
                      {applying ? "Applying…" : "Apply my signature"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSignError(null);
                        setSigning(true);
                      }}
                    >
                      Replace
                    </Button>
                  </>
                ) : null}
                {detail.canSign && !detail.signature && !mySignatureUrl && !mySigLoading ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSignError(null);
                      setSigning(true);
                    }}
                  >
                    <PenLine aria-hidden />
                    Create my signature
                  </Button>
                ) : null}
                {detail.canSign && detail.signature ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={confirmingRemove ? styles.dangerBtn : undefined}
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
                  onClick={() => window.print()}
                >
                  <Printer aria-hidden />
                  Print
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={downloading}
                  onClick={() => void handleDownload()}
                >
                  <Download aria-hidden />
                  {downloading ? "Preparing…" : "Download .xlsx"}
                </Button>
              </div>
            </>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
