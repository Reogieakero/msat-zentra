"use client";
import * as React from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  ShieldQuestion,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardModal } from "@/components/ui/CardModal";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdviserAccessRequest } from "./adviser-access-types";
import { formatRelativeTime } from "./adviser-access-types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./adviser-access-tables.module.css";
import { Pager, usePager } from "./table-pager";
import { AdviseeDetail, initials, sf10Ready } from "./adviser-access-shared";
export type ActFn = (id: string, approved: boolean, reason?: string) => Promise<void>;
function ActDialogs({
  request,
  acting,
  dialog,
  reason,
  setReason,
  closeDialog,
  confirmApprove,
  confirmReject,
}: {
  request: AdviserAccessRequest;
  acting: boolean;
  dialog: null | "reject" | "confirm";
  reason: string;
  setReason: (v: string) => void;
  closeDialog: () => void;
  confirmApprove: () => void;
  confirmReject: () => void;
}) {
  return (
    <>
      <CardModal
        open={dialog === "reject"}
        onClose={() => {
          if (!acting) closeDialog();
        }}
        dismissable={!acting}
        size="sm"
        title="Deny access request"
        description={
          <>
            Deny <strong>{request.adviserName}</strong> ({request.section})? Add a
            reason for the denial.
          </>
        }
      >
          <Textarea
            placeholder="Reason for denial (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for denial"
          />
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={closeDialog} disabled={acting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={acting || !reason.trim()}
            >
              {acting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {acting ? "Denying…" : "Confirm deny"}
            </Button>
          </div>
      </CardModal>
      <CardModal
        open={dialog === "confirm"}
        onClose={() => {
          if (!acting) closeDialog();
        }}
        dismissable={!acting}
        size="sm"
        title="Approve SF10 access"
        description={
          <>
            Grant <strong>{request.adviserName}</strong> ({request.section}) SF10
            read access for {request.affectedAdvisees.length} advisee
            {request.affectedAdvisees.length === 1 ? "" : "s"}?
          </>
        }
      >
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={closeDialog} disabled={acting}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} disabled={acting}>
              {acting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {acting ? "Approving…" : "Approve"}
            </Button>
          </div>
      </CardModal>
    </>
  );
}
export function PendingDecisionTable({
  requests,
  actingId,
  actingApprove,
  onActed,
  pageSize = 15,
}: {
  requests: AdviserAccessRequest[];
  actingId: string | null;
  actingApprove?: boolean | null;
  onActed: ActFn;
  pageSize?: number;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<null | "reject" | "confirm">(null);
  const [dialogFor, setDialogFor] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const pager = usePager(requests.length, pageSize);
  const pageRows = requests.slice(
    (pager.safePage - 1) * pageSize,
    pager.safePage * pageSize
  );
  const closeDialog = () => {
    setDialog(null);
    setDialogFor(null);
    setReason("");
  };
  const activeRequest = requests.find((r) => r.id === dialogFor) ?? null;
  const acting = dialogFor !== null && actingId === dialogFor;
  return (
    <section className={assign.card} aria-labelledby="adviser-pending">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="adviser-pending" className="text-base font-semibold">
            Pending Requests
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adviser SF10 read-access requests awaiting your decision —{" "}
            {requests.length} pending.
          </p>
        </div>
      </div>
      <div className={`${styles.content} relative`}>
        {requests.length === 0 ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <ShieldQuestion />
            </span>
            <p className={styles.emptyTitle}>All caught up</p>
            <p className={styles.emptyHint}>
              No adviser access requests awaiting your decision.
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Adviser</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Advisees</TableHead>
                  <TableHead>SF10 Ready</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => {
                  const expanded = expandedId === r.id;
                  const ready = sf10Ready(r.affectedAdvisees);
                  const pct =
                    r.affectedAdvisees.length === 0
                      ? 0
                      : Math.round((ready / r.affectedAdvisees.length) * 100);
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow>
                        <TableCell className={styles.expandCell}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={expanded ? `Collapse ${r.adviserName}` : `Expand ${r.adviserName}`}
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? null : r.id)}
                          >
                            <ChevronDown
                              aria-hidden
                              className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                            />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className={styles.adviserCell}>
                            <Avatar size="sm" className="shrink-0">
                              <AvatarFallback>{initials(r.adviserName)}</AvatarFallback>
                            </Avatar>
                            <div className={styles.studentCell}>
                              <span className={styles.studentName}>{r.adviserName}</span>
                              <span className={styles.studentLrn}>{r.employeeId}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={styles.gradeTag}>
                            {r.gradeLevel} · {r.section}
                          </span>
                        </TableCell>
                        <TableCell className={styles.cellMuted}>
                          {formatRelativeTime(r.requestedAt)}
                        </TableCell>
                        <TableCell className={styles.cellMuted}>
                          {r.affectedAdvisees.length} learner{r.affectedAdvisees.length === 1 ? "" : "s"}
                        </TableCell>
                        <TableCell>
                          <span className={styles.readyPill} title={`${ready} of ${r.affectedAdvisees.length} advisees have SF10 records ready`}>
                            {pct}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="amber" className={styles.statusBadge}>
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.actionsCell}>
                          <div className={styles.actions}>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actingId !== null}
                              onClick={() => {
                                setDialogFor(r.id);
                                setDialog("reject");
                              }}
                            >
                              {actingId === r.id && actingApprove === false ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <X aria-hidden />
                              )}
                              {actingId === r.id && actingApprove === false ? "Denying…" : "Deny"}
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              disabled={actingId !== null}
                              onClick={() => {
                                setDialogFor(r.id);
                                setDialog("confirm");
                              }}
                            >
                              {actingId === r.id && actingApprove !== false ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <Check aria-hidden />
                              )}
                              {actingId === r.id && actingApprove !== false ? "Approving…" : "Approve"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className={styles.detailRow}>
                          <TableCell colSpan={8}>
                            <AdviseeDetail request={r} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {requests.length > 0 && (
        <Pager
          total={requests.length}
          totalPages={pager.totalPages}
          safePage={pager.safePage}
          start={pager.start}
          end={pager.end}
          setPage={pager.setPage}
        />
      )}
      {activeRequest ? (
        <ActDialogs
          request={activeRequest}
          acting={acting}
          dialog={dialog}
          reason={reason}
          setReason={setReason}
          closeDialog={closeDialog}
          confirmApprove={() => {
            void (async () => {
              await onActed(activeRequest.id, true);
              closeDialog();
            })();
          }}
          confirmReject={() => {
            if (!reason.trim()) return;
            void (async () => {
              await onActed(activeRequest.id, false, reason.trim());
              closeDialog();
            })();
          }}
        />
      ) : null}
    </section>
  );
}
