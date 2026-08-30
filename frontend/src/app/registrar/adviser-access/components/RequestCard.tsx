import * as React from "react";
import { ShieldQuestion, Check, X, PanelRight, FileCheck2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { AdviserAccessRequest } from "./types";
import { formatRelativeTime } from "./types";
import { Sf10ConfirmModal } from "./Sf10ConfirmModal";
import styles from "./request-card.module.css";

type Props = {
  request: AdviserAccessRequest;
  acting: boolean;
  selected?: boolean;
  onViewAdvisees: () => void;
  onActed: (id: string, approved: boolean, reason?: string) => void;
};

function statusBadge(status: AdviserAccessRequest["status"]) {
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  if (status === "approved") return <Badge variant="default">Approved</Badge>;
  return <Badge variant="destructive">Denied</Badge>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function RequestCard({
  request,
  acting,
  selected,
  onViewAdvisees,
  onActed,
}: Props) {
  const [dialog, setDialog] = React.useState<null | "reject" | "confirm" | "approve">(null);
  const [reason, setReason] = React.useState("");

  const isProcessed = request.status !== "pending";
  const closeDialog = () => {
    setDialog(null);
    setReason("");
  };
  const confirmApprove = () => {
    onActed(request.id, true);
    closeDialog();
  };
  const confirmReject = () => {
    if (!reason.trim()) return;
    onActed(request.id, false, reason.trim());
    closeDialog();
  };

  return (
    <article className={`${styles.card} ${selected ? styles.cardSelected : ""}`}>
      <header className={styles.header}>
        <span className={styles.avatar}>{initials(request.adviserName)}</span>
        <div className={styles.identity}>
          <span className={styles.name}>{request.adviserName}</span>
          <span className={styles.sub}>
            {request.employeeId} · {request.section}
          </span>
        </div>
        {statusBadge(request.status)}
      </header>

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <ShieldQuestion className={styles.metaIcon} />
          SF10 read · {request.gradeLevel}
        </span>
        <span className={styles.metaItem}>
          <FileCheck2 className={styles.metaIcon} />
          {request.affectedAdvisees.length} advisees
        </span>
        <span className={styles.metaItem}>
          <Clock className={styles.metaIcon} />
          {formatRelativeTime(request.requestedAt)}
        </span>
      </div>

      <p className={styles.reason}>{request.reason}</p>

      {isProcessed && request.decisionReason ? (
        <p className={styles.decisionReason}>{request.decisionReason}</p>
      ) : null}

      <footer className={styles.footer}>
        <Button
          variant="outline"
          size="sm"
          className={styles.ghostBtn}
          onClick={onViewAdvisees}
        >
          <PanelRight className={styles.actionIcon} />
          View advisees
        </Button>

        {isProcessed ? (
          <span className={styles.processedLabel}>
            {request.status === "approved" ? "Access granted" : "Request denied"}
          </span>
        ) : (
          <div className={styles.actions}>
              <Button
                variant="default"
                size="sm"
                disabled={acting}
                onClick={() => setDialog("confirm")}
              >
                <Check className={styles.actionIcon} />
                {acting ? "…" : "Approve"}
              </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={acting}
              onClick={() => setDialog("reject")}
            >
              <X className={styles.actionIcon} />
              Deny
            </Button>
          </div>
        )}
      </footer>

      <Dialog open={dialog === "reject"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny access request</DialogTitle>
            <DialogDescription>
              Deny <strong>{request.adviserName}</strong> ({request.section})? Add a
              reason for the denial.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogBody}>
            <Textarea
              placeholder="Reason for denial (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={styles.reasonInput}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={acting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={acting || !reason.trim()}
            >
              {acting ? "Denying…" : "Confirm deny"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sf10ConfirmModal
        requestId={request.id}
        adviserName={request.adviserName}
        section={request.section}
        open={dialog === "confirm"}
        acting={acting}
        onOpenChange={(o) => !o && closeDialog()}
        onConfirm={confirmApprove}
      />
    </article>
  );
}
