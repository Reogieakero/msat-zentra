"use client";

import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Spinner } from "@/components/ui/spinner";
import { FormIcon } from "../../../adm/components/FormIcon";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import dialog from "../../../adm/components/admDialog.module.css";
import styles from "./all.module.css";
import formStyles from "../../../academics/assign/components/form.module.css";

/** Sign/return confirmation for an endorsed ADM case. Pure render — the
 *  parent owns the pending target, the in-flight id, and the submit. */
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
    <CardModal
      open={pendingAction !== null}
      onClose={() => {
        if (busyActionId) return;
        onClose();
      }}
      size="sm"
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
      watchKey={pendingAction?.id}
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
      <div className={formStyles.dialogFooter}>
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
    </CardModal>
  );
}
