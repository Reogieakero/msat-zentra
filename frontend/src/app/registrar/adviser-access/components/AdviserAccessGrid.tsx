import * as React from "react";
import { Check, X, Users, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdviserAccessRequest, AffectedAdvisee } from "./types";
import { formatRelativeTime } from "./types";
import styles from "./adviser-access-grid.module.css";

type Props = {
  requests: AdviserAccessRequest[];
  actingId: string | null;
  onViewAdvisees: (id: string) => void;
  onActed: (id: string, approved: boolean, reason?: string) => void;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function sf10Ready(advisees: AffectedAdvisee[]): number {
  return advisees.filter((a) => a.sf10Status === "validated" || a.sf10Status === "verified").length;
}

export function AdviserAccessGridSkeleton() {
  return (
    <div className={styles.grid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`${styles.card} ${styles.skelCard}`}>
          <div className={styles.skelTop}>
            <Skeleton className={styles.skelAvatar} />
            <div className={styles.skelLines}>
              <Skeleton className={styles.skelTitle} />
              <Skeleton className={styles.skelSub} />
            </div>
          </div>
          <Skeleton className={styles.skelBar} />
          <div className={styles.skelFoot}>
            <Skeleton className={styles.skelChip} />
            <Skeleton className={styles.skelChip} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdviserAccessGrid({ requests, actingId, onViewAdvisees, onActed }: Props) {
  return (
    <div className={styles.grid}>
      {requests.map((r) => (
        <GridCard
          key={r.id}
          request={r}
          acting={actingId === r.id}
          onViewAdvisees={onViewAdvisees}
          onActed={onActed}
        />
      ))}
    </div>
  );
}

function statusBadge(status: AdviserAccessRequest["status"]) {
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  if (status === "approved") return <Badge variant="success">Approved</Badge>;
  return <Badge variant="destructive">Denied</Badge>;
}

function GridCard({
  request,
  acting,
  onViewAdvisees,
  onActed,
}: {
  request: AdviserAccessRequest;
  acting: boolean;
  onViewAdvisees: (id: string) => void;
  onActed: (id: string, approved: boolean, reason?: string) => void;
}) {
  const [dialog, setDialog] = React.useState<null | "reject" | "confirm">(null);
  const [reason, setReason] = React.useState("");

  const isProcessed = request.status !== "pending";
  const advisees = request.affectedAdvisees;
  const ready = sf10Ready(advisees);
  const pct = advisees.length === 0 ? 0 : Math.round((ready / advisees.length) * 100);
  const shownAvatars = advisees.slice(0, 4);

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
    <article
      className={styles.card}
      data-status={request.status}
      onClick={() => onViewAdvisees(request.id)}
    >
      <header className={styles.header}>
        <span className={styles.avatar}>
          {initials(request.adviserName)}
        </span>
        <div className={styles.headText}>
          <h3 className={styles.title}>{request.adviserName}</h3>
          <p className={styles.sub}>{request.employeeId}</p>
        </div>
        {statusBadge(request.status)}
      </header>

      <div className={styles.categoryRow}>
        <span className={styles.category}>
          {request.gradeLevel} · {request.section}
        </span>
        <span className={styles.when}>
          <Clock3 className={styles.whenIcon} />
          {formatRelativeTime(request.requestedAt)}
        </span>
      </div>

      <div className={styles.advisees}>
        <div className={styles.progressRow}>
          <span className={styles.progressLabel}>SF10 ready</span>
          <span className={styles.progressValue}>{pct}%</span>
        </div>
        <div className={styles.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={styles.barFill}
            data-status={request.status}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={styles.adviseesMeta}>
          <div className={styles.avatarStack}>
            {shownAvatars.map((a) => (
              <Avatar key={a.lrn} size="sm" className={styles.stacked}>
                <AvatarFallback className={styles.stackedFallback}>
                  {initials(a.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {advisees.length > shownAvatars.length ? (
              <span className={styles.more}>+{advisees.length - shownAvatars.length}</span>
            ) : null}
          </div>
          <span className={styles.adviseesCount}>
            <Users className={styles.countIcon} />
            {advisees.length} advisee{advisees.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <p className={styles.reason}>{request.reason}</p>

      {request.decisionReason ? (
        <p className={styles.decisionReason} data-status={request.status}>
          {request.decisionReason}
        </p>
      ) : null}

      <footer className={styles.footer}>
        <Button
          variant="ghost"
          size="sm"
          className={styles.viewBtn}
          onClick={(e) => {
            e.stopPropagation();
            onViewAdvisees(request.id);
          }}
        >
          <Users className={styles.footerIcon} />
          Advisees
        </Button>

        {isProcessed ? (
          <span className={styles.processedLabel}>
            {request.status === "approved" ? "Access granted" : "Access not granted"}
          </span>
        ) : (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className={styles.denyBtn}
              disabled={acting}
              onClick={() => setDialog("reject")}
            >
              <X className={styles.footerIcon} />
              Deny
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={acting}
              onClick={() => setDialog("confirm")}
            >
              <Check className={styles.footerIcon} />
              {acting ? "…" : "Approve"}
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

      <Dialog open={dialog === "confirm"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve SF10 access</DialogTitle>
            <DialogDescription>
              Grant <strong>{request.adviserName}</strong> ({request.section}) SF10
              read access for {advisees.length} advisee
              {advisees.length === 1 ? "" : "s"}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={acting}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} disabled={acting}>
              {acting ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
