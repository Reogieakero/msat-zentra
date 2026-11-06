"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { SignaturePad } from "@/components/ocform01/SignaturePad";
import {
  fetchMySignature,
  saveMySignature,
} from "@/components/ocform01/ocform01";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import styles from "./all.module.css";

function serverMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "response" in e) {
    const data = (e as { response?: { data?: { error?: { message?: unknown } } } })
      .response?.data?.error?.message;
    if (typeof data === "string" && data.trim()) return data;
  }
  return fallback;
}

type PendingAction = { id: string; type: "sign" | "return" };
type ConfirmedAction = PendingAction & { reason?: string };

export function SignReturnConfirmDialog({
  pendingAction,
  busyActionId,
  pendingRow,
  onClose,
  onConfirm,
}: {
  pendingAction: PendingAction | null;
  busyActionId: string | null;
  pendingRow: AdmReferralRow | null | undefined;
  onClose: () => void;
  onConfirm: (target: ConfirmedAction) => void;
}) {
  // Remount the sheet per action so signature state never leaks between cases.
  return (
    <SignReturnConfirmSheet
      key={
        pendingAction ? `${pendingAction.type}:${pendingAction.id}` : "closed"
      }
      pendingAction={pendingAction}
      busyActionId={busyActionId}
      pendingRow={pendingRow}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function SignReturnConfirmSheet({
  pendingAction,
  busyActionId,
  pendingRow,
  onClose,
  onConfirm,
}: {
  pendingAction: PendingAction | null;
  busyActionId: string | null;
  pendingRow: AdmReferralRow | null | undefined;
  onClose: () => void;
  onConfirm: (target: ConfirmedAction) => void;
}) {
  const signing = pendingAction?.type === "sign";
  // Same flow as the adviser's OCForm-01: the case is signed with the staff
  // master signature, drawn once and reused. A principal without one is taken
  // straight to the pad before the approve button unlocks.
  const [signatureUrl, setSignatureUrl] = React.useState<string | null>(null);
  const [loadingSignature, setLoadingSignature] = React.useState(
    pendingAction?.type === "sign",
  );
  const [drawing, setDrawing] = React.useState(false);
  const [savingSignature, setSavingSignature] = React.useState(false);
  const [signatureError, setSignatureError] = React.useState<string | null>(null);
  // The Principal must justify a return; the reason reaches the coordinator,
  // the nurse (when consulted), the audit trail, and the notifications.
  const [returnReason, setReturnReason] = React.useState("");

  React.useEffect(() => {
    if (pendingAction?.type !== "sign") return;
    let cancelled = false;
    fetchMySignature()
      .then(({ imageUrl }) => {
        if (cancelled) return;
        setSignatureUrl(imageUrl);
        setLoadingSignature(false);
        if (!imageUrl) setDrawing(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSignatureError("Could not load your signature. Draw one to continue.");
        setLoadingSignature(false);
        setDrawing(true);
      });
    return () => {
      cancelled = true;
    };
    // Mounted once per action (see the keyed wrapper above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveSignature(dataUrl: string) {
    if (savingSignature) return;
    setSavingSignature(true);
    setSignatureError(null);
    try {
      await saveMySignature(dataUrl);
      const sig = await fetchMySignature();
      setSignatureUrl(sig.imageUrl);
      setDrawing(false);
    } catch (e) {
      setSignatureError(
        serverMessage(e, "Your signature could not be saved. Try drawing again."),
      );
    } finally {
      setSavingSignature(false);
    }
  }

  const canConfirm = signing
    ? signatureUrl !== null &&
      !loadingSignature &&
      !drawing &&
      !savingSignature
    : returnReason.trim().length >= 5;

  return (
    <KanbanOverlay
      open={pendingAction !== null}
      onClose={() => {
        if (busyActionId) return;
        onClose();
      }}
      width="md"
      title={signing ? "Sign & approve this case?" : "Return this case for revision?"}
      description={
        signing
          ? "You are final-signing this ADM profile. Your drawn signature is stamped on the Principal signage folder."
          : "The case will be sent back to the ADM Coordinator at the eligibility stage."
      }
      dismissable={busyActionId === null && !savingSignature}
      busy={busyActionId !== null}
      footer={
        signing && drawing ? undefined : (
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            {signing && signatureUrl ? (
              <Button
                variant="ghost"
                className="h-6"
                disabled={busyActionId !== null}
                onClick={() => {
                  setSignatureError(null);
                  setDrawing(true);
                }}
              >
                Draw a different signature
              </Button>
            ) : null}
            <Button
              variant={signing ? "default" : "destructive"}
              className="h-6"
              disabled={busyActionId !== null || !canConfirm}
              aria-busy={busyActionId !== null}
              onClick={() => {
                if (!pendingAction || busyActionId) return;
                onConfirm(
                  signing
                    ? pendingAction
                    : { ...pendingAction, reason: returnReason.trim() },
                );
              }}
            >
              {busyActionId !== null ? (
                <>
                  <Spinner className="size-4" aria-hidden />
                  {signing ? "Signing…" : "Returning…"}
                </>
              ) : signing ? (
                "Sign & Approve"
              ) : (
                "Confirm Return"
              )}
            </Button>
          </div>
        )
      }
    >
      {pendingRow ? (
        <div className={styles.confirmBody}>
          <div className={styles.studentRow}>
            <StudentMascot
              name={pendingRow.student}
              seed={pendingRow.lrn}
              size={32}
            />
            <div className="flex min-w-0 flex-col items-start gap-1">
              <Pill
                tone="amber"
                label="Student"
                className="min-w-0 max-w-full overflow-hidden"
              >
                <span className="truncate">{pendingRow.student}</span>
              </Pill>
              <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
                <Pill label="LRN" className="tabular-nums">
                  {pendingRow.lrn}
                </Pill>
                {pendingRow.section ? (
                  <Pill tone="amber" label="Section">
                    {pendingRow.section}
                  </Pill>
                ) : null}
                <Pill label="Grade">{pendingRow.grade}</Pill>
              </span>
            </div>
          </div>

          {signing ? (
            <div className={styles.signatureBlock}>
              {drawing ? (
                <SignaturePad
                  onSave={(dataUrl) => void handleSaveSignature(dataUrl)}
                  onCancel={() => {
                    if (signatureUrl) {
                      setDrawing(false);
                      setSignatureError(null);
                    }
                  }}
                  saving={savingSignature}
                  error={signatureError}
                />
              ) : loadingSignature ? (
                <p className={styles.signatureHint}>Loading your signature…</p>
              ) : signatureUrl ? (
                <>
                  <span className={styles.signatureHint}>
                    This signature will be stamped on the case:
                  </span>
                  <img
                    src={signatureUrl}
                    alt="Your saved signature"
                    className={styles.signaturePreview}
                  />
                </>
              ) : null}
              {signatureError && !drawing ? (
                <p className={styles.signatureError} role="alert">
                  {signatureError}
                </p>
              ) : null}
            </div>
          ) : (
            <label className={styles.reasonField}>
              <span className={styles.reasonLabel}>
                Reason for revision <span aria-hidden>*</span>
              </span>
              <Textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Tell the ADM Coordinator what needs to be corrected before re-endorsement…"
                maxLength={1000}
                rows={3}
                disabled={busyActionId !== null}
                aria-required="true"
                aria-invalid={returnReason.trim().length > 0 && returnReason.trim().length < 5}
              />
              <span className={styles.signatureHint}>
                At least 5 characters. The reason is recorded with your return and
                sent to the coordinator.
              </span>
            </label>
          )}

          <p className={styles.confirmNote}>
            {signing
              ? "Signing saves your approval and files a Principal signage folder with this case's documents."
              : "Returning withdraws the signature and removes the Principal signage folder."}
          </p>
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
