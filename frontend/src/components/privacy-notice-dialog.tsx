"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PrivacyNoticeDialogProps {
  open: boolean;
  onClose: () => void;
  studentName?: string;
  // "finished" = case is closed, report kept private. "endorsed" = case
  // was endorsed to the ADM coordinator: the full report moved with the
  // case and is no longer viewable on this desk.
  reason?: "finished" | "endorsed";
}

/**
 * Shown instead of the official report when a case is finished (full
 * write-up hidden to protect privacy) or endorsed to ADM (report moved
 * with the case). The folder stays visible so staff know a record
 * exists, but the full write-up never opens — the summary on the page
 * is all that remains visible.
 */
export function PrivacyNoticeDialog({
  open,
  onClose,
  studentName,
  reason = "finished",
}: PrivacyNoticeDialogProps) {
  const endorsed = reason === "endorsed";
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" />
            {endorsed ? "With the ADM coordinator" : "Kept private"}
          </DialogTitle>
          <DialogDescription>
            {endorsed ? (
              <>
                {studentName
                  ? `The full report for ${studentName} can't be opened because this case was endorsed to the ADM coordinator. `
                  : "This full report can't be opened because the case was endorsed to the ADM coordinator. "}
                It moved with the case and is no longer viewable on this
                desk. The summary shown on this page is all that remains
                visible.
              </>
            ) : (
              <>
                {studentName
                  ? `The full report for ${studentName} can't be opened because this case is finished. `
                  : "This full report can't be opened because the case is finished. "}
                It stays hidden to protect the student&apos;s privacy. The summary
                shown on this page is all that remains visible.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
