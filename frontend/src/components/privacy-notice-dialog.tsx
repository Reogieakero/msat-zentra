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
}

/**
 * Shown instead of the official report when a case is finished. The folder
 * stays visible so staff know a record exists, but the full write-up is
 * hidden to protect the student's privacy.
 */
export function PrivacyNoticeDialog({
  open,
  onClose,
  studentName,
}: PrivacyNoticeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" />
            Kept private
          </DialogTitle>
          <DialogDescription>
            {studentName
              ? `The full report for ${studentName} can't be opened because this case is finished. `
              : "This full report can't be opened because the case is finished. "}
            It stays hidden to protect the student&apos;s privacy. The summary
            shown on this page is all that remains visible.
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
