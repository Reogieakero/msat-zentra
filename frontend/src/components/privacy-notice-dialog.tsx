"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";

interface PrivacyNoticeDialogProps {
  open: boolean;
  onClose: () => void;
  studentName?: string;

  reason?: "finished" | "endorsed" | "principal";
}

export function PrivacyNoticeDialog({
  open,
  onClose,
  studentName,
  reason = "finished",
}: PrivacyNoticeDialogProps) {
  const endorsed = reason === "endorsed";
  const principal = reason === "principal";
  const notice = endorsed ? (
    <>
      {studentName
        ? `The full report for ${studentName} can't be opened because this case was endorsed to the ADM coordinator. `
        : "This full report can't be opened because the case was endorsed to the ADM coordinator. "}
      It moved with the case and is no longer viewable on this
      desk. The summary shown on this page is all that remains
      visible.
    </>
  ) : principal ? (
    <>
      {studentName
        ? `The full report for ${studentName} can't be opened. `
        : "This full report can't be opened. "}
      It stays hidden to protect the student&apos;s privacy — the
      principal has nothing to do with these cases unless an open
      case is forwarded to the principal. The summary shown on this
      page is all that remains visible.
    </>
  ) : (
    <>
      {studentName
        ? `The full report for ${studentName} can't be opened because this case is finished. `
        : "This full report can't be opened because the case is finished. "}
      It stays hidden to protect the student&apos;s privacy. The summary
      shown on this page is all that remains visible.
    </>
  );
  return (
    <CardModal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" />
          {endorsed ? "With the ADM coordinator" : "Kept private"}
        </span>
      }
      description={notice}
    >
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onClose}>
          Understood
        </Button>
      </div>
    </CardModal>
  );
}
