"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldQuestion,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AccessRequestStatus,
  AdviserAccessRequest,
  AffectedAdvisee,
} from "./types";
import { formatRelativeTime } from "./types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./adviser-access-tables.module.css";

const PAGE_SIZE = 8;

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

function Sf10Badge({ status }: { status: AffectedAdvisee["sf10Status"] }) {
  if (status === "validated")
    return <Badge variant="default">Validated</Badge>;
  if (status === "verified")
    return <Badge variant="secondary">Verified</Badge>;
  return <Badge variant="amber">Pending</Badge>;
}

type ActFn = (id: string, approved: boolean, reason?: string) => Promise<void>;

function usePager(total: number) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  return { page, setPage, totalPages, safePage, start, end };
}

function Pager({
  total,
  totalPages,
  safePage,
  start,
  end,
  setPage,
}: {
  total: number;
  totalPages: number;
  safePage: number;
  start: number;
  end: number;
  setPage: (p: number | ((p: number) => number)) => void;
}) {
  return (
    <div className={`${styles.footer} relative`}>
      <span className={styles.footerInfo}>
        {total > 0 ? `${start}–${end} of ${total}` : "0 of 0"}
      </span>
      <div className={styles.footerActions}>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage <= 1 || total === 0}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages || total === 0}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className={styles.skelCell} style={{ width: j === 0 ? "70%" : "50%" }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function AdviseeDetail({ request }: { request: AdviserAccessRequest }) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <span className={styles.detailTitle}>
          Affected advisees · {request.section}
        </span>
        <span className={styles.detailMeta}>
          <Badge variant="outline">SF10 read · {request.gradeLevel}</Badge>
          <Badge variant="outline">{request.affectedAdvisees.length} learners</Badge>
        </span>
      </div>
      {request.reason ? (
        <p className={styles.detailReason}>
          <strong>Request reason:</strong> {request.reason}
        </p>
      ) : null}
      <ul className={styles.adviseeList}>
        {request.affectedAdvisees.map((a) => (
          <li key={a.lrn} className={styles.adviseeItem}>
            <div className={styles.studentCell}>
              <span className={styles.studentName}>{a.name}</span>
              <span className={styles.studentLrn}>{a.lrn}</span>
            </div>
            <span className={styles.gradeTag}>{a.gradeLevel}</span>
            <Sf10Badge status={a.sf10Status} />
          </li>
        ))}
      </ul>
      {request.decisionReason ? (
        <p className={styles.detailReason} data-status={request.status}>
          <strong>Decision:</strong> {request.decisionReason}
        </p>
      ) : null}
    </div>
  );
}

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
      <Dialog open={dialog === "reject"} onOpenChange={(o) => { if (!o && !acting) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny access request</DialogTitle>
            <DialogDescription>
              Deny <strong>{request.adviserName}</strong> ({request.section})? Add a
              reason for the denial.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for denial (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for denial"
          />
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "confirm"} onOpenChange={(o) => { if (!o && !acting) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve SF10 access</DialogTitle>
            <DialogDescription>
              Grant <strong>{request.adviserName}</strong> ({request.section}) SF10
              read access for {request.affectedAdvisees.length} advisee
              {request.affectedAdvisees.length === 1 ? "" : "s"}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={acting}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} disabled={acting}>
              {acting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {acting ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PendingDecisionTable({
  requests,
  actingId,
  actingApprove,
  onActed,
}: {
  requests: AdviserAccessRequest[];
  actingId: string | null;
  actingApprove?: boolean | null;
  onActed: ActFn;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<null | "reject" | "confirm">(null);
  const [dialogFor, setDialogFor] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");

  const pager = usePager(requests.length);
  const pageRows = requests.slice(
    (pager.safePage - 1) * PAGE_SIZE,
    pager.safePage * PAGE_SIZE
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
            // Await the server confirm before closing: the dialog must never
            // vanish while the decision is still processing. On failure the
            // promise rejects and we stay open.
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

function historyBadge(status: AccessRequestStatus) {
  if (status === "approved") return <Badge variant="default">Approved</Badge>;
  return <Badge variant="destructive">Denied</Badge>;
}

export function HistoryTable({
  requests,
}: {
  requests: AdviserAccessRequest[];
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const pager = usePager(requests.length);
  const pageRows = requests.slice(
    (pager.safePage - 1) * PAGE_SIZE,
    pager.safePage * PAGE_SIZE
  );

  return (
    <section className={assign.card} aria-labelledby="adviser-history">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="adviser-history" className="text-base font-semibold">
            Decision History
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved and denied SF10 access requests — {requests.length} decided.
          </p>
        </div>
      </div>

      <div className={`${styles.content} relative`}>
        {requests.length === 0 ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <ShieldQuestion />
            </span>
            <p className={styles.emptyTitle}>No decisions yet</p>
            <p className={styles.emptyHint}>
              Approved and denied requests will appear here.
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
                  <TableHead>Decision</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => {
                  const expanded = expandedId === r.id;
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
                        <TableCell>{historyBadge(r.status)}</TableCell>
                        <TableCell className={styles.reasonCell}>
                          {r.decisionReason ?? "—"}
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className={styles.detailRow}>
                          <TableCell colSpan={5}>
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
    </section>
  );
}
