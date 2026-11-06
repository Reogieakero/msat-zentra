"use client";
import * as React from "react";
import { ChevronDown, FileSearch, Loader2, ShieldQuestion, X } from "lucide-react";
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
import { AdviseeDetail, CheckBanner, initials, sf10Ready } from "./adviser-access-shared";
import type { AdviserAccessDesk } from "./adviser-access-check-context";

export type ActFn = (id: string, approved: boolean, reason?: string) => Promise<void>;

/**
 * Pending requests — Check is the only primary row action.
 * Whole-request Deny lives as a secondary action inside the expanded
 * detail. Per-student Approve/Report live only in the check dock
 * (bottom-right), never in this table.
 */
export function PendingDecisionTable({
  requests,
  actingId,
  actingApprove,
  onActed,
  onCheck,
  checkingId,
  desk,
  pageSize = 15,
}: {
  requests: AdviserAccessRequest[];
  actingId: string | null;
  actingApprove?: boolean | null;
  onActed: ActFn;
  onCheck: (id: string) => Promise<void>;
  checkingId: string | null;
  desk: AdviserAccessDesk;
  pageSize?: number;
}) {
  void desk;
  void actingApprove;
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [denyFor, setDenyFor] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const pager = usePager(requests.length, pageSize);
  const pageRows = requests.slice((pager.safePage - 1) * pageSize, pager.safePage * pageSize);
  const denyRequest = requests.find((r) => r.id === denyFor) ?? null;
  const denying = denyFor !== null && actingId === denyFor;
  const closeDeny = () => {
    if (denying) return;
    setDenyFor(null);
    setReason("");
  };
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
            Run the SF10 check on each request, then decide per student in the check card.{" "}
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
            <p className={styles.emptyHint}>No adviser access requests awaiting your decision.</p>
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
                  const checking = checkingId === r.id;
                  const rowBusy = actingId !== null || checkingId !== null;
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
                        <TableCell className={styles.cellMuted}>{formatRelativeTime(r.requestedAt)}</TableCell>
                        <TableCell className={styles.cellMuted}>
                          {r.affectedAdvisees.length} learner{r.affectedAdvisees.length === 1 ? "" : "s"}
                        </TableCell>
                        <TableCell>
                          {r.checkedAt ? (
                            <span
                              className={styles.readyPill}
                              title={`${ready} of ${r.affectedAdvisees.length} advisees have SF10 records ready`}
                            >
                              {pct}%
                            </span>
                          ) : (
                            <span className={styles.cellMuted} title="Run the SF10 check first — no verdict yet">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="amber" className={styles.statusBadge}>
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.actionsCell}>
                          <div className={styles.actions}>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={rowBusy}
                              title="Match requested LRNs against filed SF10 records"
                              onClick={() => {
                                void onCheck(r.id);
                              }}
                            >
                              {checking ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <FileSearch aria-hidden />
                              )}
                              {checking ? "Checking…" : "Check"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className={styles.detailRow}>
                          <TableCell colSpan={8}>
                            <CheckBanner request={r} checking={checking} />
                            <AdviseeDetail request={r} />
                            <div className={styles.modalActions}>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={rowBusy}
                                onClick={() => {
                                  setDenyFor(r.id);
                                  setReason("");
                                }}
                              >
                                <X aria-hidden />
                                Deny request
                              </Button>
                            </div>
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
      {denyRequest ? (
        <CardModal
          open={denyFor !== null}
          onClose={closeDeny}
          dismissable={!denying}
          size="sm"
          title="Deny access request"
          description={
            <>
              Deny <strong>{denyRequest.adviserName}</strong> ({denyRequest.section})? Add a reason
              for the denial.
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
            <Button variant="outline" onClick={closeDeny} disabled={denying}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={denying || !reason.trim()}
              onClick={() => {
                if (!reason.trim()) return;
                void onActed(denyRequest.id, false, reason.trim()).finally(() => {
                  setDenyFor(null);
                  setReason("");
                });
              }}
            >
              {denying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {denying ? "Denying…" : "Confirm deny"}
            </Button>
          </div>
        </CardModal>
      ) : null}
    </section>
  );
}
