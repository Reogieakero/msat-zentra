import * as React from "react";
import { ShieldQuestion, Check, X, ChevronDown, FileCheck2, Clock } from "lucide-react";
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
import type { AdviserAccessRequest, AffectedAdvisee } from "./types";
import { formatRelativeTime } from "./types";
import styles from "./request-card.module.css";

type Props = {
  request: AdviserAccessRequest;
  acting: boolean;
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

export function RequestCard({ request, acting, onActed }: Props) {
  const [expanded, setExpanded] = React.useState(request.status !== "pending");
  const [dialog, setDialog] = React.useState<null | "approve" | "reject">(null);
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
    <article className={`${styles.card} ${expanded ? styles.cardOpen : ""}`}>
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

      {expanded ? (
        <div className={styles.expanded}>
          <div className={styles.adviseeHead}>
            <span className={styles.adviseeTitle}>Affected advisees</span>
            <Badge variant="outline">{request.affectedAdvisees.length}</Badge>
          </div>
          <ul className={styles.adviseeList}>
            {request.affectedAdvisees.map((a) => (
              <AdviseeRow key={a.lrn} advisee={a} />
            ))}
          </ul>

          {isProcessed && request.decisionReason ? (
            <p className={styles.decisionReason}>{request.decisionReason}</p>
          ) : null}
        </div>
      ) : null}

      <footer className={styles.footer}>
        <Button
          variant="outline"
          size="sm"
          className={styles.ghostBtn}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "View"} advisees
          <ChevronDown
            className={`${styles.chev} ${expanded ? styles.chevOpen : ""}`}
          />
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
              onClick={() => setDialog("approve")}
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

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          {dialog === "approve" ? (
            <>
              <DialogHeader>
                <DialogTitle>Grant SF10 access</DialogTitle>
                <DialogDescription>
                  Approve <strong>{request.adviserName}</strong> ({request.section}) for
                  read access to their advisees&apos; SF10 records (Grade 11–12)? The
                  adviser will be notified.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={acting}>
                  Cancel
                </Button>
                <Button variant="default" onClick={confirmApprove} disabled={acting}>
                  {acting ? "Approving…" : "Confirm approve"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}

function AdviseeRow({ advisee }: { advisee: AffectedAdvisee }) {
  return (
    <li className={styles.advisee}>
      <div className={styles.adviseeIdentity}>
        <span className={styles.adviseeName}>{advisee.name}</span>
        <span className={styles.adviseeLrn}>{advisee.lrn}</span>
      </div>
      <div className={styles.adviseeMeta}>
        <span className={styles.grade}>{advisee.gradeLevel}</span>
        <Sf10Badge status={advisee.sf10Status} />
      </div>
    </li>
  );
}

function Sf10Badge({ status }: { status: AffectedAdvisee["sf10Status"] }) {
  if (status === "validated")
    return <Badge variant="default" className={styles.sf10Validated}>Validated</Badge>;
  if (status === "verified")
    return <Badge variant="secondary">Verified</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}
