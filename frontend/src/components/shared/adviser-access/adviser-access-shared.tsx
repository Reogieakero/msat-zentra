"use client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type {
  AdviserAccessRequest,
  AffectedAdvisee,
} from "./adviser-access-types";
import { formatRelativeTime } from "./adviser-access-types";
import styles from "./adviser-access-tables.module.css";
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
export function sf10Ready(advisees: AffectedAdvisee[]): number {
  return advisees.filter((a) => a.sf10Status === "validated" || a.sf10Status === "verified").length;
}
export function Sf10Badge({
  status,
  hasRecord,
  checked = true,
  reported = false,
  approved = false,
}: {
  status: AffectedAdvisee["sf10Status"];
  hasRecord?: boolean;
  /** Attached/Missing are check verdicts — before the SF10 check runs, neutral. */
  checked?: boolean;
  /** Desk-reported missing mark (stored + adviser notified). */
  reported?: boolean;
  /** Per-student grant (whole-request approval grants every row). */
  approved?: boolean;
}) {
  if (!checked) return <Badge variant="outline" title="Run the SF10 check first — no verdict yet">Unchecked</Badge>;
  if (approved) return <Badge variant="green" title="Read access granted for this student — file exists">Approved</Badge>;
  if (reported) return <Badge variant="red" title="No filed SF10 record — already reported to the adviser">Reported</Badge>;
  if (status === "validated")
    return <Badge variant="default" title="Filed SF10 record validated">Validated</Badge>;
  if (status === "verified")
    return <Badge variant="secondary" title="Filed SF10 record verified">Verified</Badge>;
  // A filed row exists but is still attached (awaiting validation).
  if (hasRecord) return <Badge variant="outline" title="Filed SF10 row attached — awaiting validation">Attached</Badge>;
  // No SF10 row for this LRN at all.
  return <Badge variant="red" title="No filed SF10 record found by the check — use Report">Missing</Badge>;
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
export function CheckBanner({
  request,
  checking,
}: {
  request: AdviserAccessRequest;
  checking: boolean;
}) {
  const attached = request.affectedAdvisees.filter((a) => a.hasRecord).length;
  const missing = request.affectedAdvisees.length - attached;
  if (checking) {
    return (
      <p className={styles.detailReason} aria-live="polite">
        <strong>Verifying…</strong> matching requested LRNs against filed SF10 records.
      </p>
    );
  }
  if (!request.checkedAt) {
    return (
      <p className={styles.detailReason} aria-live="polite">
        <strong>Not yet checked.</strong> Run the SF10 check first — approve unlocks
        once every requested LRN is marked attached or missing.
      </p>
    );
  }
  return (
    <p className={styles.detailReason} aria-live="polite">
      <strong>Checked {formatRelativeTime(request.checkedAt)}:</strong> {attached}{" "}
      attached · {missing} missing.
      {missing > 0 ? " Missing LRNs have no filed SF10 record." : ""}
    </p>
  );
}

export interface AdviseeRowActions {
  approveLrn: (lrn: string) => void;
  reportLrn: (lrn: string) => void;
  approvingLrn: string | null;
  reportingLrn: string | null;
  acting: boolean;
  approvingLrns?: string[];
  reportingLrns?: string[];
  isRowBusy?: (lrn: string) => boolean;
}

function isBusy(actions: AdviseeRowActions, lrn: string): boolean {
  if (actions.isRowBusy) return actions.isRowBusy(lrn);
  if (actions.approvingLrns || actions.reportingLrns) {
    return (
      (actions.approvingLrns ?? []).includes(lrn) || (actions.reportingLrns ?? []).includes(lrn)
    );
  }
  return actions.approvingLrn === lrn || actions.reportingLrn === lrn;
}

export function AdviseeDetail({
  request,
  actions,
}: {
  request: AdviserAccessRequest;
  /** Per-student one-by-one decisions (pending + checked requests only). */
  actions?: AdviseeRowActions;
}) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <span className={styles.detailTitle}>
          Affected advisees · {request.section}
        </span>
        <span className={styles.detailMeta}>
          <Badge variant="outline">SF10 read · {request.gradeLevel}</Badge>
          <Badge variant="outline">{request.affectedAdvisees.length} learners</Badge>
          {(request.requestedLrns?.length ?? 0) > 0 ? (
            <Badge variant="outline">{request.requestedLrns!.length} selected by adviser</Badge>
          ) : null}
        </span>
      </div>
      {request.reason ? (
        <p className={styles.detailReason}>
          <strong>Request reason:</strong> {request.reason}
        </p>
      ) : null}
      <ul className={styles.adviseeList}>
        {request.affectedAdvisees.map((a) => {
          const isApproved = request.approvedLrns?.includes(a.lrn) ?? false;
          const isReported = request.reportedMissingLrns?.includes(a.lrn) ?? false;
          const actionable = !!actions && request.status === "pending" && !!request.checkedAt;
          const showApprove = actionable && !!a.hasRecord && !isApproved;
          const showReport = actionable && !a.hasRecord && !isReported;
          return (
            <li key={a.lrn} className={styles.adviseeItem}>
              <div className={styles.studentCell}>
                <span className={styles.studentName}>{a.name}</span>
                <span className={styles.studentLrn}>{a.lrn}</span>
              </div>
              <span className={styles.gradeTag}>{a.gradeLevel}</span>
              <Sf10Badge
                status={a.sf10Status}
                hasRecord={a.hasRecord}
                checked={!!request.checkedAt}
                reported={isReported}
                approved={isApproved}
              />
              {actions && showApprove ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-6 shrink-0 border border-transparent bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/30 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700"
                  disabled={isBusy(actions, a.lrn)}
                  onClick={() => actions.approveLrn(a.lrn)}
                  aria-label={`Approve access for ${a.name}`}
                  title="Approve this student only"
                >
                  {actions.approvingLrn === a.lrn || actions.approvingLrns?.includes(a.lrn) ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : null}
                  Approve
                </Button>
              ) : actions && showReport ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-6 shrink-0 bg-red-600 px-2 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                  disabled={isBusy(actions, a.lrn)}
                  onClick={() => actions.reportLrn(a.lrn)}
                  aria-label={`Report ${a.name} as missing`}
                >
                  {actions.reportingLrn === a.lrn || actions.reportingLrns?.includes(a.lrn) ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : null}
                  Report
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {request.decisionReason ? (
        <p className={styles.detailReason} data-status={request.status}>
          <strong>Decision:</strong> {request.decisionReason}
        </p>
      ) : null}
    </div>
  );
}
