"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GuidanceAdmCase } from "@/services/guidance/adm.types";
import styles from "./guidance-adm.module.css";
export function GuidanceAdmRejectDialog({
  rejectId,
  activeReject,
  rejectReason,
  onReasonChange,
  pending,
  onClose,
  onSubmit,
}: {
  rejectId: string | null;
  activeReject: GuidanceAdmCase | null;
  rejectReason: string;
  onReasonChange: (v: string) => void;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={rejectId !== null} onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent aria-busy={pending || undefined}>
        <DialogHeader>
          <DialogTitle>
            Reject from ADM{activeReject ? ` — ${activeReject.student}` : ""}
          </DialogTitle>
          <DialogDescription>
            The case closes without further ADM action. Please say why, so
            there is a record.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="quickRejectReason">Why is this being rejected?</Label>
          <Textarea
            id="quickRejectReason"
            value={rejectReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Explain why this case doesn't warrant ADM…"
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className={styles.btnRed}
            disabled={pending || !rejectReason.trim()}
            aria-busy={pending || undefined}
            onClick={onSubmit}
          >
            {pending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {pending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
