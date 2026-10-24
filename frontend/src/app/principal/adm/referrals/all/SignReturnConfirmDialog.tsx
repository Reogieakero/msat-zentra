"use client";

import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Spinner } from "@/components/ui/spinner";
import { FormIcon } from "../../../adm/components/FormIcon";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import dialog from "../../../adm/components/admDialog.module.css";
import styles from "./all.module.css";

export function SignReturnConfirmDialog({
  pendingAction,
  busyActionId,
  pendingRow,
  onClose,
  onConfirm,
}: {
  pendingAction: { id: string; type: "sign" | "return" } | null;
  busyActionId: string | null;
  pendingRow: AdmReferralRow | null | undefined;
  onClose: () => void;
  onConfirm: (target: { id: string; type: "sign" | "return" }) => void;
}) {
  return (
    <KanbanOverlay
      open={pendingAction !== null}
      onClose={() => {
        if (busyActionId) return;
        onClose();
      }}
      width="sm"
      title={
        pendingAction?.type === "sign"
          ? "Sign & approve this case?"
          : "Return this case for revision?"
      }
      description={
        pendingAction?.type === "sign"
          ? "You are final-signing this ADM profile. This authorizes module release and moves the case to monitoring."
          : "The case will be sent back to the ADM Coordinator at the eligibility stage."
      }
      dismissable={busyActionId === null}
      busy={busyActionId !== null}
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busyActionId !== null}
          >
            Cancel
          </Button>
          <Button
            variant={pendingAction?.type === "sign" ? "default" : "destructive"}
            disabled={busyActionId !== null}
            aria-busy={busyActionId !== null}
            onClick={() => {
              if (!pendingAction || busyActionId) return;
              onConfirm(pendingAction);
            }}
          >
            {busyActionId !== null ? (
              <>
                <Spinner className="size-4" aria-hidden />
                {pendingAction?.type === "sign" ? "Signing…" : "Returning…"}
              </>
            ) : pendingAction?.type === "sign" ? (
              "Sign & Approve"
            ) : (
              "Confirm Return"
            )}
          </Button>
        </div>
      }
    >
      {pendingRow ? (
        <div className={dialog.dialogDocs}>
          <span className={dialog.dialogDocsName}>
            {pendingRow.student}{" "}
            <span className={styles.mono}>({pendingRow.lrn})</span>
          </span>
          <div className={dialog.dialogDocsRow}>
            {(pendingRow.forms ?? []).map((f, i) => (
              <FormIcon
                key={f.id}
                formType={f.formType}
                title={f.title}
                status={f.status}
                index={i}
              />
            ))}
          </div>
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
